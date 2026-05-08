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
import {
    useCallback,
    useRef,
    ReactNode,
    HTMLProps,
    MutableRefObject,
    CSSProperties,
    DragEvent,
} from 'react';

import {
    useTable,
    usePagination,
    useSortBy,
    useGlobalFilter,
    useColumnOrder,
    PluginHook,
    TableOptions,
    FilterType,
    IdType,
    Row,
} from 'react-table';
import { matchSorter, rankings } from 'match-sorter';
import { typedMemo, usePrevious } from '@superset-ui/core';
import { Input, type InputRef } from '@superset-ui/core/components';
import {
  DoubleLeftOutlined,
  DoubleRightOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';

import { isEqual } from 'lodash';
import GlobalFilter, { GlobalFilterProps } from '../../../../plugin-chart-table/src/DataTable/components/GlobalFilter';
import SelectPageSize, {
  SelectPageSizeProps,
  SelectPageSizeRendererProps,
  SizeOption,
} from '../../../../plugin-chart-table/src/DataTable/components/SelectPageSize';
import useStickyPtm from './useStickyPtm';
import { PAGE_SIZE_OPTIONS } from '../../../../plugin-chart-table/src/consts';
import { sortAlphanumericCaseInsensitive } from '../../../../plugin-chart-table/src/DataTable/utils/sortAlphanumericCaseInsensitive';

/** Incremental id for PTM table global filter (deterministic per mount, SSR-safe). */
let ptmDtIdSeq = 0;

// Re-export types for compatibility with TableChart imports
export type { SearchInputProps } from '../../../../plugin-chart-table/src/DataTable/components/GlobalFilter';
export type { SelectPageSizeRendererProps, SizeOption } from '../../../../plugin-chart-table/src/DataTable/components/SelectPageSize';

const PtmSearchInput = ({
  value,
  onChange,
  onBlur,
  inputRef,
}: {
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: () => void;
  inputRef?: React.Ref<InputRef>;
}) => (
  <div className="ptm-dt-search">
    <Input
      size="small"
      ref={inputRef}
      placeholder="Buscar..."
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      allowClear
      prefix={<SearchOutlined />}
      className="ptm-dt-search-input"
    />
  </div>
);

const PtmSelectPageSizeRenderer = ({
  current,
  options,
  onChange,
}: SelectPageSizeRendererProps) => (
  <select
    className="form-control input-sm"
    value={current}
    onChange={e => onChange(Number((e.target as HTMLSelectElement).value))}
  >
    {options.map(option => {
      const [size, text] = Array.isArray(option) ? option : [option, option];
      return (
        <option key={size} value={size}>
          {text}
        </option>
      );
    })}
  </select>
);

export interface DataTableProps<D extends object> extends TableOptions<D> {
    tableClassName?: string;
    searchInput?: boolean | GlobalFilterProps<D>['searchInput'];
    selectPageSize?: boolean | SelectPageSizeProps['selectRenderer'];
    pageSizeOptions?: SizeOption[]; // available page size options
    maxPageItemCount?: number;
    hooks?: PluginHook<D>[]; // any additional hooks
    width?: string | number;
    height?: string | number;
    serverPagination?: boolean;
    onServerPaginationChange: (pageNumber: number, pageSize: number) => void;
    serverPaginationData: { pageSize?: number; currentPage?: number };
    pageSize?: number;
    noResults?: string | ((filterString: string) => ReactNode);
    sticky?: boolean;
    rowCount: number;
    wrapperRef?: MutableRefObject<HTMLDivElement>;
    onColumnOrderChange: () => void;
    renderGroupingHeaders?: () => JSX.Element;
    renderTimeComparisonDropdown?: () => JSX.Element;
}

export interface RenderHTMLCellProps extends HTMLProps<HTMLTableCellElement> {
    cellContent: ReactNode;
}

const sortTypes = {
    alphanumeric: sortAlphanumericCaseInsensitive,
};

const MINIMAL_PAGE_ITEM_COUNT = 7;

export function generatePageItems(
    total: number,
    current: number,
    width: number,
) {
    if (width < MINIMAL_PAGE_ITEM_COUNT) {
        throw new Error(
            `Must allow at least ${MINIMAL_PAGE_ITEM_COUNT} page items`,
        );
    }
    if (width % 2 === 0) {
        throw new Error(`Must allow odd number of page items`);
    }
    if (total < width) {
        return [...new Array(total).keys()];
    }
    const left = Math.max(
        0,
        Math.min(total - width, current - Math.floor(width / 2)),
    );
    const items: (string | number)[] = new Array(width);
    for (let i = 0; i < width; i += 1) {
        items[i] = i + left;
    }
    // replace non-ending items with placeholders
    if (typeof items[0] === 'number' && items[0] > 0) {
        items[0] = 0;
        items[1] = 'prev-more';
    }
    const lastItem = items[items.length - 1];
    if (typeof lastItem === 'number' && lastItem < total - 1) {
        items[items.length - 1] = total - 1;
        items[items.length - 2] = 'next-more';
    }
    return items;
}
// Be sure to pass our updateMyData and the skipReset option
export default typedMemo(function DataTable<D extends object>({
    tableClassName,
    columns,
    data,
    serverPaginationData,
    width: initialWidth = '100%',
    height: initialHeight = 300,
    pageSize: initialPageSize = 0,
    initialState: initialState_ = {},
    pageSizeOptions = PAGE_SIZE_OPTIONS,
    maxPageItemCount = 9,
    sticky: doSticky,
    searchInput = true,
    onServerPaginationChange,
    rowCount,
    selectPageSize,
    noResults: noResultsText = 'No data found',
    hooks,
    serverPagination,
    wrapperRef: userWrapperRef,
    onColumnOrderChange,
    renderGroupingHeaders,
    renderTimeComparisonDropdown,
    ...moreUseTableOptions
}: DataTableProps<D>): JSX.Element {
    const tableHooks: PluginHook<D>[] = [
        useGlobalFilter,
        useSortBy,
        usePagination,
        useColumnOrder,
        doSticky ? useStickyPtm : [],
        hooks || [],
    ].flat();
    const columnNames = Object.keys(data?.[0] || {});
    const previousColumnNames = usePrevious(columnNames);
    const resultsSize = serverPagination ? rowCount : data.length;
    const sortByRef = useRef([]); // cache initial `sortby` so sorting doesn't trigger page reset
    const pageSizeRef = useRef([initialPageSize, resultsSize]);
    const hasPagination = initialPageSize > 0 && resultsSize > 0; // pageSize == 0 means no pagination
    const hasGlobalControl =
        hasPagination || !!searchInput || renderTimeComparisonDropdown;
    const initialState = {
        ...initialState_,
        // zero length means all pages, the `usePagination` plugin does not
        // understand pageSize = 0
        sortBy: sortByRef.current,
        pageSize: initialPageSize > 0 ? initialPageSize : resultsSize || 10,
    };
    const defaultWrapperRef = useRef<HTMLDivElement>(null);
    const globalControlRef = useRef<HTMLDivElement>(null);
    const paginationRef = useRef<HTMLDivElement>(null);
    const wrapperRef = userWrapperRef || defaultWrapperRef;
    const paginationData = JSON.stringify(serverPaginationData);
    const globalFilterIdRef = useRef(`ptm-dt-${++ptmDtIdSeq}`);

    const defaultGetTableSize = useCallback(() => {
        if (wrapperRef.current) {
            // `initialWidth` and `initialHeight` could be also parameters like `100%`
            // `Number` returns `NaN` on them, then we fallback to computed size
            const width = Number(initialWidth) || wrapperRef.current.clientWidth;
            const height =
                (Number(initialHeight) || wrapperRef.current.clientHeight) -
                (globalControlRef.current?.clientHeight || 0) -
                (paginationRef.current?.clientHeight || 0);
            return { width, height };
        }
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        initialHeight,
        initialWidth,
        wrapperRef,
        hasPagination,
        hasGlobalControl,
        paginationRef,
        resultsSize,
        paginationData,
    ]);

    const defaultGlobalFilter: FilterType<D> = useCallback(
        (rows: Row<D>[], columnIds: IdType<D>[], filterValue: string) => {
            // allow searching by "col1_value col2_value"
            const joinedString = (row: Row<D>) =>
                columnIds.map(x => row.values[x]).join(' ');
            return matchSorter(rows, filterValue, {
                keys: [...columnIds, joinedString],
                threshold: rankings.ACRONYM,
            }) as typeof rows;
        },
        [],
    );

    const {
        getTableProps,
        getTableBodyProps,
        prepareRow,
        headerGroups,
        footerGroups,
        page,
        pageCount,
        gotoPage,
        preGlobalFilteredRows,
        setGlobalFilter,
        setPageSize: setPageSize_,
        wrapStickyTable,
        setColumnOrder,
        allColumns,
        state: { pageIndex, pageSize, globalFilter: filterValue, sticky = {} },
    } = useTable<D>(
        {
            columns,
            data,
            initialState,
            getTableSize: defaultGetTableSize,
            globalFilter: defaultGlobalFilter,
            sortTypes,
            autoResetSortBy: !isEqual(columnNames, previousColumnNames),
            ...moreUseTableOptions,
        },
        ...tableHooks,
    );
    // make setPageSize accept 0
    const setPageSize = (size: number) => {
        if (serverPagination) {
            onServerPaginationChange(0, size);
        }
        // keep the original size if data is empty
        if (size || resultsSize !== 0) {
            setPageSize_(size === 0 ? resultsSize : size);
        }
    };

    const noResults =
        typeof noResultsText === 'function'
            ? noResultsText(filterValue as string)
            : noResultsText;

    const getNoResults = () => <div className="dt-no-results">{noResults}</div>;

    if (!columns || columns.length === 0) {
        return (
            wrapStickyTable ? wrapStickyTable(getNoResults) : getNoResults()
        ) as JSX.Element;
    }

    const shouldRenderFooter = columns.some(x => !!x.Footer);

    let columnBeingDragged = -1;

    const onDragStart = (e: DragEvent) => {
        const el = e.target as HTMLTableCellElement;
        columnBeingDragged = allColumns.findIndex(
            col => col.id === el.dataset.columnName,
        );
        e.dataTransfer.setData('text/plain', `${columnBeingDragged}`);
    };

    const onDrop = (e: DragEvent) => {
        const el = e.target as HTMLTableCellElement;
        const newPosition = allColumns.findIndex(
            col => col.id === el.dataset.columnName,
        );

        if (newPosition !== -1) {
            const currentCols = allColumns.map(c => c.id);
            const colToBeMoved = currentCols.splice(columnBeingDragged, 1);
            currentCols.splice(newPosition, 0, colToBeMoved[0]);
            setColumnOrder(currentCols);
            // toggle value in TableChart to trigger column width recalc
            onColumnOrderChange();
        }
        e.preventDefault();
    };

    const renderTable = () => (
        <table {...getTableProps({ className: tableClassName })}>
            <thead>
                {renderGroupingHeaders ? renderGroupingHeaders() : null}
                {headerGroups.map(headerGroup => {
                    const { key: headerGroupKey, ...headerGroupProps } =
                        headerGroup.getHeaderGroupProps();
                    return (
                        <tr key={headerGroupKey || headerGroup.id} {...headerGroupProps}>
                            {headerGroup.headers.map(column =>
                                column.render('Header', {
                                    key: column.id,
                                    ...column.getSortByToggleProps(),
                                    onDragStart,
                                    onDrop,
                                }),
                            )}
                        </tr>
                    );
                })}
            </thead>
            <tbody {...getTableBodyProps()}>
                {page && page.length > 0 ? (
                    page.map(row => {
                        prepareRow(row);
                        const { key: rowKey, ...rowProps } = row.getRowProps();
                        return (
                            <tr key={rowKey || row.id} {...rowProps} role="row">
                                {row.cells.map(cell =>
                                    cell.render('Cell', { key: cell.column.id }),
                                )}
                            </tr>
                        );
                    })
                ) : (
                    <tr>
                        <td className="dt-no-results" colSpan={columns.length}>
                            {noResults}
                        </td>
                    </tr>
                )}
            </tbody>
            {shouldRenderFooter && (
                <tfoot>
                    {footerGroups.map(footerGroup => {
                        const { key: footerGroupKey, ...footerGroupProps } =
                            footerGroup.getHeaderGroupProps();
                        return (
                            <tr
                                key={footerGroupKey || footerGroup.id}
                                {...footerGroupProps}
                                role="row"
                            >
                                {footerGroup.headers.map(column =>
                                    column.render('Footer', { key: column.id }),
                                )}
                            </tr>
                        );
                    })}
                </tfoot>
            )}
        </table>
    );

    // force update the pageSize when it's been update from the initial state
    if (
        pageSizeRef.current[0] !== initialPageSize ||
        // when initialPageSize stays as zero, but total number of records changed,
        // we'd also need to update page size
        (initialPageSize === 0 && pageSizeRef.current[1] !== resultsSize)
    ) {
        pageSizeRef.current = [initialPageSize, resultsSize];
        setPageSize(initialPageSize);
    }

    // When sticky headers are enabled we hide pagination until sticky sizes are computed,
    // otherwise layout can "jump". If sticky is disabled, always show footer.
    const paginationStyle: CSSProperties = doSticky
        ? sticky.height
          ? {}
          : { visibility: 'hidden' }
        : {};

    let resultPageCount = pageCount;
    let resultCurrentPageSize = pageSize;
    let resultCurrentPage = pageIndex;
    let resultOnPageChange: (page: number) => void = gotoPage;
    if (serverPagination) {
        const serverPageSize = serverPaginationData?.pageSize ?? initialPageSize;
        resultPageCount = Math.ceil(rowCount / serverPageSize);
        if (!Number.isFinite(resultPageCount)) {
            resultPageCount = 0;
        }
        resultCurrentPageSize = serverPageSize;
        const foundPageSizeIndex = pageSizeOptions.findIndex(
            ([option]) => option >= resultCurrentPageSize,
        );
        if (foundPageSizeIndex === -1) {
            resultCurrentPageSize = 0;
        }
        resultCurrentPage = serverPaginationData?.currentPage ?? 0;
        resultOnPageChange = (pageNumber: number) =>
            onServerPaginationChange(pageNumber, serverPageSize);
    }
    return (
        <div
            ref={wrapperRef}
            style={{ width: initialWidth, height: initialHeight }}
        >
            {hasGlobalControl ? (
                <div ref={globalControlRef} className="ptm-dt-toolbar">
                    {searchInput ? (
                        <div className="ptm-dt-toolbar-left">
                            <GlobalFilter<D>
                                searchInput={
                                    typeof searchInput === 'boolean' ? PtmSearchInput : searchInput
                                }
                                preGlobalFilteredRows={preGlobalFilteredRows}
                                id={globalFilterIdRef.current}
                                serverPagination={!!serverPagination}
                                rowCount={rowCount}
                                setGlobalFilter={setGlobalFilter}
                                filterValue={filterValue}
                            />
                        </div>
                    ) : null}
                    {renderTimeComparisonDropdown ? (
                        <div className="ptm-dt-toolbar-right">
                            {renderTimeComparisonDropdown()}
                        </div>
                    ) : null}
                </div>
            ) : null}
            {wrapStickyTable ? wrapStickyTable(renderTable) : renderTable()}
            {hasPagination ? (() => {
                const total = resultsSize;
                const pageSizeValue =
                    resultCurrentPageSize === 0 ? total : resultCurrentPageSize;

                const start = total === 0 ? 0 : resultCurrentPage * pageSizeValue + 1;
                const end =
                    total === 0
                        ? 0
                        : Math.min((resultCurrentPage + 1) * pageSizeValue, total);

                const width = Math.max(7, maxPageItemCount % 2 === 0 ? maxPageItemCount - 1 : maxPageItemCount);
                const items = generatePageItems(resultPageCount, resultCurrentPage, width);

                const isFirst = resultCurrentPage <= 0;
                const isLast = resultCurrentPage >= resultPageCount - 1;

                return (
                    <div ref={paginationRef} style={paginationStyle} className="ptm-dt-footer">
                        <div className="ptm-dt-footer-left">
                            <span className="ptm-dt-page-size-label">Registro por página:</span>
                            <SelectPageSize
                              total={total}
                              current={resultCurrentPageSize}
                              options={pageSizeOptions}
                              selectRenderer={PtmSelectPageSizeRenderer}
                              onChange={setPageSize}
                            />
                        </div>

                        <div className="ptm-dt-footer-center">
                            <span className="ptm-dt-range-bold">{start} - {end}</span>
                            <span className="ptm-dt-range-total"> de {total}</span>
                        </div>

                        <div className="ptm-dt-footer-right">
                            <button
                                type="button"
                                className="ptm-dt-nav-btn"
                                disabled={isFirst}
                                onClick={() => resultOnPageChange(0)}
                                aria-label="Primeira página"
                            >
                                <DoubleLeftOutlined />
                            </button>

                            <button
                                type="button"
                                className="ptm-dt-nav-btn"
                                disabled={isFirst}
                                onClick={() => resultOnPageChange(Math.max(0, resultCurrentPage - 1))}
                                aria-label="Página anterior"
                            >
                                <LeftOutlined />
                            </button>

                            <div className="ptm-dt-pages">
                                {items.map(item =>
                                    typeof item === 'number' ? (
                                        <button
                                            key={item}
                                            type="button"
                                            className={
                                                item === resultCurrentPage
                                                    ? 'ptm-dt-page-btn is-active'
                                                    : 'ptm-dt-page-btn'
                                            }
                                            onClick={() => resultOnPageChange(item)}
                                        >
                                            {item + 1}
                                        </button>
                                    ) : (
                                        <span key={item} className="ptm-dt-ellipsis">…</span>
                                    ),
                                )}
                            </div>

                            <button
                                type="button"
                                className="ptm-dt-nav-btn"
                                disabled={isLast}
                                onClick={() => resultOnPageChange(Math.min(resultPageCount - 1, resultCurrentPage + 1))}
                                aria-label="Próxima página"
                            >
                                <RightOutlined />
                            </button>

                            <button
                                type="button"
                                className="ptm-dt-nav-btn"
                                disabled={isLast}
                                onClick={() => resultOnPageChange(resultPageCount - 1)}
                                aria-label="Última página"
                            >
                                <DoubleRightOutlined />
                            </button>
                        </div>
                    </div>
                );
            })() : null}
        </div>
    );
});
