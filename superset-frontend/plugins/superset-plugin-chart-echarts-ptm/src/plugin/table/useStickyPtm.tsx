/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/**
 * PTM variant of useSticky: column widths for <colgroup> are taken from a
 * sizer table that only includes thead (+ a single row of empty body cells),
 * not real cell content. The stock hook measures <th> after the full table
 * layout, so wide body cells inflate column widths; PTM wants columns to
 * start at the header/title width so body text wraps inside that width.
 *
 * Full table height is still measured from a second hidden sizer with the real
 * tbody/tfoot for correct vertical scroll sizing.
 */
import {
  Children,
  cloneElement,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
  ReactNode,
  ReactElement,
  ComponentPropsWithRef,
  CSSProperties,
  UIEventHandler,
} from 'react';
import { TableInstance, Hooks } from 'react-table';
import { useTheme, css } from '@superset-ui/core';
import getScrollBarSize from '../../../../plugin-chart-table/src/DataTable/utils/getScrollBarSize';
import needScrollBar from '../../../../plugin-chart-table/src/DataTable/utils/needScrollBar';
import useMountedMemo from '../../../../plugin-chart-table/src/DataTable/utils/useMountedMemo';

type ReactElementWithChildren<
  T extends keyof JSX.IntrinsicElements,
  C extends ReactNode = ReactNode,
> = ReactElement<ComponentPropsWithRef<T> & { children: C }, T>;

type Th = ReactElementWithChildren<'th'>;
type TrWithTh = ReactElementWithChildren<'tr', Th[]>;
type TrWithTd = ReactElementWithChildren<'tr', any>;
type Thead = ReactElementWithChildren<'thead', TrWithTh>;
type Tbody = ReactElementWithChildren<'tbody', TrWithTd>;
type Tfoot = ReactElementWithChildren<'tfoot', TrWithTd>;
type Col = ReactElementWithChildren<'col', null>;
type ColGroup = ReactElementWithChildren<'colgroup', Col>;

type Table = ReactElementWithChildren<
  'table',
  (Thead | Tbody | Tfoot | ColGroup)[]
>;
type TableRenderer = () => Table;
type GetTableSize = () => Partial<StickyState> | undefined;
type SetStickyState = (size?: Partial<StickyState>) => void;

export enum ReducerActions {
  Init = 'init',
  SetStickyState = 'setStickyState',
}

export type ReducerAction<
  T extends string,
  P extends Record<string, unknown>,
> = P & { type: T };

export type ColumnWidths = number[];

export interface StickyState {
  width?: number;
  height?: number;
  realHeight?: number;
  bodyHeight?: number;
  tableHeight?: number;
  columnWidths?: ColumnWidths;
  hasHorizontalScroll?: boolean;
  hasVerticalScroll?: boolean;
  rendering?: boolean;
  setStickyState?: SetStickyState;
}

export type UseStickyState = {
  sticky: StickyState;
};

const sum = (a: number, b: number) => a + b;
const mergeStyleProp = (
  node: ReactElement<{ style?: CSSProperties }>,
  style: CSSProperties,
) => ({
  style: {
    ...node.props.style,
    ...style,
  },
});
const fixedTableLayout: CSSProperties = { tableLayout: 'fixed' };

function StickyWrapPtm({
  sticky = {},
  width: maxWidth,
  height: maxHeight,
  children: table,
  setStickyState,
}: {
  width: number;
  height: number;
  setStickyState: SetStickyState;
  children: Table;
  sticky?: StickyState;
}) {
  const theme = useTheme();

  if (!table || table.type !== 'table') {
    throw new Error('<StickyWrapPtm> must have only one <table> element as child');
  }
  let thead: Thead | undefined;
  let tbody: Tbody | undefined;
  let tfoot: Tfoot | undefined;

  Children.forEach(table.props.children, node => {
    if (!node) {
      return;
    }
    if (node.type === 'thead') {
      thead = node;
    } else if (node.type === 'tbody') {
      tbody = node;
    } else if (node.type === 'tfoot') {
      tfoot = node;
    }
  });
  if (!thead || !tbody) {
    throw new Error(
      '<table> in <StickyWrapPtm> must contain both thead and tbody.',
    );
  }

  const columnCount = useMemo(() => {
    const headerRows = Children.toArray(
      thead?.props.children,
    ).pop() as TrWithTh;
    return headerRows.props.children.length;
  }, [thead]);

  /** Thead used in width-only sizer (measures column widths from header). */
  const theadRef = useRef<HTMLTableSectionElement>(null);
  /** Full table in height sizer (accurate scroll/body height). */
  const heightTableRef = useRef<HTMLTableElement>(null);
  const tfootRef = useRef<HTMLTableSectionElement>(null);

  const scrollHeaderRef = useRef<HTMLDivElement>(null);
  const scrollFooterRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  const scrollBarSize = getScrollBarSize();
  const { bodyHeight, columnWidths, hasVerticalScroll } = sticky;
  const needSizer =
    !columnWidths ||
    sticky.width !== maxWidth ||
    sticky.height !== maxHeight ||
    sticky.setStickyState !== setStickyState;

  const minimalWidthSizerTbody = useMemo(
    () => (
      <tbody key="ptm-sticky-width-sizer-tbody">
        <tr>
          {Array.from({ length: columnCount }, (_, i) => (
            <td
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              style={{
                padding: 0,
                border: 'none',
                height: 1,
                lineHeight: 0,
                fontSize: 0,
              }}
            />
          ))}
        </tr>
      </tbody>
    ),
    [columnCount],
  );

  useLayoutEffect(() => {
    if (!theadRef.current || !heightTableRef.current) {
      return;
    }
    const widthThead = theadRef.current;
    const theadHeight = widthThead.clientHeight;
    if (!theadHeight) {
      return;
    }
    const tfootHeight = tfootRef.current ? tfootRef.current.clientHeight : 0;
    const fullTableHeight = heightTableRef.current.clientHeight;

    const ths = widthThead.childNodes?.[widthThead.childNodes?.length - 1 || 0]
      .childNodes as NodeListOf<HTMLTableHeaderCellElement>;
    const widths = Array.from(ths).map(
      th => th.getBoundingClientRect()?.width || th.clientWidth,
    );

    const [hasVScroll, hasHScroll] = needScrollBar({
      width: maxWidth,
      height: maxHeight - theadHeight - tfootHeight,
      innerHeight: fullTableHeight,
      innerWidth: widths.reduce(sum),
      scrollBarSize,
    });
    const realHeight = Math.min(
      maxHeight,
      hasHScroll ? fullTableHeight + scrollBarSize : fullTableHeight,
    );
    setStickyState({
      hasVerticalScroll: hasVScroll,
      hasHorizontalScroll: hasHScroll,
      setStickyState,
      width: maxWidth,
      height: maxHeight,
      realHeight,
      tableHeight: fullTableHeight,
      bodyHeight: realHeight - theadHeight - tfootHeight,
      columnWidths: widths,
    });
  }, [maxWidth, maxHeight, setStickyState, scrollBarSize, columnCount]);

  let sizerTables: ReactNode = null;
  let headerTable: ReactElement | undefined;
  let footerTable: ReactElement | undefined;
  let bodyTable: ReactElement | undefined;

  const scrollBarStyles = css`
    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    &::-webkit-scrollbar-track {
      background: ${theme.colorFillQuaternary};
    }
    &::-webkit-scrollbar-thumb {
      background: ${theme.colorFillSecondary};
      border-radius: ${theme.borderRadiusSM}px;
      &:hover {
        background: ${theme.colorFillTertiary};
      }
    }
    &::-webkit-scrollbar-corner {
      background: ${theme.colorFillQuaternary};
    }
  `;

  if (needSizer) {
    const theadForWidth = cloneElement(thead, { ref: theadRef });
    const tfootForHeight = tfoot && cloneElement(tfoot, { ref: tfootRef });

    const sizerDivStyle: CSSProperties = {
      height: maxHeight,
      overflow: 'auto',
      visibility: 'hidden',
      scrollbarGutter: 'stable',
    };

    sizerTables = (
      <>
        <div
          key="width-sizer"
          style={sizerDivStyle}
          css={scrollBarStyles}
          role="presentation"
        >
          {cloneElement(
            table,
            { role: 'presentation' },
            theadForWidth,
            minimalWidthSizerTbody,
          )}
        </div>
        <div
          key="height-sizer"
          style={sizerDivStyle}
          css={scrollBarStyles}
          role="presentation"
        >
          {cloneElement(
            table,
            { ref: heightTableRef, role: 'presentation' },
            cloneElement(thead),
            tbody,
            tfootForHeight,
          )}
        </div>
      </>
    );
  }

  const colWidths = columnWidths?.slice(0, columnCount);

  if (colWidths && bodyHeight) {
    const colgroup = (
      <colgroup>
        {colWidths.map((w, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <col key={i} width={w} />
        ))}
      </colgroup>
    );

    const headerContainerWidth = hasVerticalScroll
      ? maxWidth - scrollBarSize
      : maxWidth;

    headerTable = (
      <div
        key="header"
        ref={scrollHeaderRef}
        style={{
          overflow: 'hidden',
          width: headerContainerWidth,
          boxSizing: 'border-box',
        }}
        role="presentation"
      >
        {cloneElement(
          cloneElement(table, { role: 'presentation' }),
          mergeStyleProp(table, fixedTableLayout),
          colgroup,
          thead,
        )}
        {headerTable}
      </div>
    );

    footerTable = tfoot && (
      <div
        key="footer"
        ref={scrollFooterRef}
        style={{
          overflow: 'hidden',
          width: headerContainerWidth,
          boxSizing: 'border-box',
        }}
        role="presentation"
      >
        {cloneElement(
          cloneElement(table, { role: 'presentation' }),
          mergeStyleProp(table, fixedTableLayout),
          colgroup,
          tfoot,
        )}
        {footerTable}
      </div>
    );

    const onScroll: UIEventHandler<HTMLDivElement> = e => {
      if (scrollHeaderRef.current) {
        scrollHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
      if (scrollFooterRef.current) {
        scrollFooterRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
    };
    bodyTable = (
      <div
        key="body"
        ref={scrollBodyRef}
        style={{
          height: bodyHeight,
          overflow: 'auto',
          scrollbarGutter: 'stable',
          width: maxWidth,
          boxSizing: 'border-box',
        }}
        css={scrollBarStyles}
        onScroll={sticky.hasHorizontalScroll ? onScroll : undefined}
        role="presentation"
      >
        {cloneElement(
          cloneElement(table, { role: 'presentation' }),
          mergeStyleProp(table, fixedTableLayout),
          colgroup,
          tbody,
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: maxWidth,
        height: sticky.realHeight || maxHeight,
        overflow: 'hidden',
      }}
      role="table"
    >
      {headerTable}
      {bodyTable}
      {footerTable}
      {sizerTables}
    </div>
  );
}

function useInstance<D extends object>(instance: TableInstance<D>) {
  const {
    dispatch,
    state: { sticky },
    data,
    page,
    rows,
    allColumns,
    getTableSize = () => undefined,
  } = instance;

  const setStickyState = useCallback(
    (size?: Partial<StickyState>) => {
      dispatch({
        type: ReducerActions.SetStickyState,
        size,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, getTableSize, page, rows],
  );

  const useStickyWrap = (renderer: TableRenderer) => {
    const { width, height }: { width?: number; height?: number } =
      useMountedMemo(getTableSize, [getTableSize]) || sticky;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const table = useMemo(renderer, [page, rows, allColumns]);

    useLayoutEffect(() => {
      if (!width || !height) {
        setStickyState();
      }
    }, [width, height]);

    if (!width || !height) {
      return null;
    }
    if (data.length === 0) {
      return table;
    }
    return (
      <StickyWrapPtm
        width={width}
        height={height}
        sticky={sticky}
        setStickyState={setStickyState}
      >
        {table}
      </StickyWrapPtm>
    );
  };

  Object.assign(instance, {
    setStickyState,
    wrapStickyTable: useStickyWrap,
  });
}

export default function useStickyPtm<D extends object>(hooks: Hooks<D>) {
  hooks.useInstance.push(useInstance);
  hooks.stateReducers.push((newState, action_, prevState) => {
    const action = action_ as ReducerAction<
      ReducerActions,
      { size: StickyState }
    >;
    if (action.type === ReducerActions.Init) {
      return {
        ...newState,
        sticky: {
          ...prevState?.sticky,
        },
      };
    }
    if (action.type === ReducerActions.SetStickyState) {
      const { size } = action;
      if (!size) {
        return { ...newState };
      }
      return {
        ...newState,
        sticky: {
          ...prevState?.sticky,
          ...newState?.sticky,
          ...action.size,
        },
      };
    }
    return newState;
  });
}
useStickyPtm.pluginName = 'useStickyPtm';
