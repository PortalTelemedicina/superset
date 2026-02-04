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

import { FC, useMemo, useState } from 'react';
import {
  DataMaskStateWithId,
  isDefined,
  isNativeFilter,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import { Icons, Loading } from '@superset-ui/core/components';
import { useSelector } from 'react-redux';
import FilterBarSettings from 'src/dashboard/components/nativeFilters/FilterBar/FilterBarSettings';
import FilterControls from 'src/dashboard/components/nativeFilters/FilterBar/FilterControls/FilterControls';
import {
  getFilterBarTestId,
  useChartsVerboseMaps,
} from 'src/dashboard/components/nativeFilters/FilterBar/utils';
import { HorizontalBarProps } from 'src/dashboard/components/nativeFilters/FilterBar/types';
import crossFiltersSelector from 'src/dashboard/components/nativeFilters/FilterBar/CrossFilters/selectors';
import { extractLabel } from 'src/dashboard/components/nativeFilters/selectors';
import { RootState } from 'src/dashboard/types';
import { useChartIds } from 'src/dashboard/util/charts/useChartIds';
import { useChartLayoutItems } from 'src/dashboard/util/useChartLayoutItems';

const HorizontalBar = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    background: ${theme.colorBgBase};
    box-shadow: inset 0px -2px 2px -1px ${theme.colorSplit};
    position: relative;
    /* Stable height so loading/expanded/collapsed don't cause layout shift when toggling */
    min-height: ${theme.sizeUnit * 20}px;
  `}
`;

const HorizontalBarContent = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-start;
    /* Match expanded filter row height so bar doesn't jump when expanding */
    min-height: ${theme.sizeUnit * 14}px;
    .loading {
      margin: ${theme.sizeUnit * 2}px auto ${theme.sizeUnit * 2}px;
      padding: 0;
    }
  `}
`;

const FilterBarEmptyStateContainer = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    padding-left: ${theme.sizeUnit * 2}px;
  `}
`;

const AppliedFiltersRow = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    flex-wrap: wrap;
    line-height: 1.2;
    width: 100%;
  `}
`;

const AppliedFilterChip = styled.div<{ $bg: string; $fg: string }>`
  ${({ theme, $bg, $fg }) => `
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit * 1.5}px;
    padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 3}px;
    background: ${$bg};
    color: ${$fg};
    border-radius: ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${theme.fontWeightStrong};
    white-space: nowrap;
  `}
`;

const ToggleButton = styled.button`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: ${theme.sizeUnit * 6}px;
    height: ${theme.sizeUnit * 6}px;
    min-width: ${theme.sizeUnit * 6}px;
    min-height: ${theme.sizeUnit * 6}px;
    border: none;
    border-radius: ${theme.sizeUnit * 2}px;
    background: transparent;
    cursor: pointer;
    margin-right: ${theme.sizeUnit * 2}px;
    color: ${theme.colorText};
    flex-shrink: 0;
    &:hover {
      background: ${theme.colorFillTertiary};
    }
    &:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 2px;
    }
  `}
`;


const getChipColors = (theme: ReturnType<typeof useTheme>) => ({
  bg: theme.colorFillTertiary ?? theme.colorBgLayout,
  fg: theme.colorText,
});

/**
 * Portal replacement for horizontal filter bar: collapsible + chips when collapsed.
 * All UI lives in the extension; core stays minimal (get + simple default).
 */
export const FilterBarAdapter: FC<HorizontalBarProps> = ({
  actions,
  dataMaskSelected,
  filterValues,
  isInitialized,
  onSelectionChange,
  clearAllTriggers,
  onClearAllComplete,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const theme = useTheme();
  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );
  const chartIds = useChartIds();
  const chartLayoutItems = useChartLayoutItems();
  const verboseMaps = useChartsVerboseMaps();

  const selectedCrossFilters = useMemo(
    () =>
      crossFiltersSelector({
        dataMask,
        chartIds,
        chartLayoutItems,
        verboseMaps,
      }),
    [chartIds, chartLayoutItems, dataMask, verboseMaps],
  );

  const hasFilters = filterValues.length > 0 || selectedCrossFilters.length > 0;

  const appliedNativeFilterChips = useMemo(() => {
    const nativeFilters = filterValues.filter(isNativeFilter);
    return nativeFilters
      .map(filter => {
        const filterState = dataMask?.[filter.id]?.filterState;
        const value = extractLabel(filterState);
        if (!value) return null;
        const label = filter.name ? `${filter.name}: ${value}` : value;
        return {
          key: `native:${filter.id}`,
          label,
          IconComponent: Icons.FilterOutlined,
        };
      })
      .filter(Boolean) as Array<{
      key: string;
      label: string;
      IconComponent: typeof Icons.FilterOutlined;
    }>;
  }, [dataMask, filterValues]);

  const appliedCrossFilterChips = useMemo(
    () =>
      selectedCrossFilters
        .map(filter => {
          if (!isDefined(filter.value)) return null;
          const filterName = filter.name || filter.column;
          const value = String(filter.value);
          const label = filterName ? `${filterName}: ${value}` : value;
          return {
            key: `cross:${filter.emitterId}:${filter.column ?? filter.name}`,
            label,
            IconComponent: Icons.FilterOutlined,
          };
        })
        .filter(Boolean) as Array<{
        key: string;
        label: string;
        IconComponent: typeof Icons.FilterOutlined;
      }>,
    [selectedCrossFilters],
  );

  const appliedChips = useMemo(
    () => {
      const allChips = [...appliedNativeFilterChips, ...appliedCrossFilterChips];
      // Deduplicate chips with identical labels
      const seenLabels = new Set<string>();
      const chips = allChips.filter(chip => {
        if (seenLabels.has(chip.label)) return false;
        seenLabels.add(chip.label);
        return true;
      });
      return chips;
    },
    [appliedNativeFilterChips, appliedCrossFilterChips],
  );

  const chipColors = getChipColors(theme);

  return (
    <HorizontalBar {...getFilterBarTestId()}>
      <HorizontalBarContent>
        <ToggleButton
          type="button"
          aria-label={
            isExpanded ? t('Collapse filter bar') : t('Expand filter bar')
          }
          onClick={() => setIsExpanded(v => !v)}
          data-test="horizontal-filterbar-toggle"
        >
          {isExpanded ? (
            <Icons.UpOutlined iconSize="xs" />
          ) : (
            <Icons.DownOutlined iconSize="xs" />
          )}
        </ToggleButton>
        {!isInitialized ? (
          <Loading position="inline-centered" />
        ) : isExpanded ? (
          <>
            <FilterBarSettings />
            {!hasFilters && (
              <FilterBarEmptyStateContainer data-test="horizontal-filterbar-empty">
                {t('No filters are currently added to this dashboard.')}
              </FilterBarEmptyStateContainer>
            )}
            {hasFilters && (
              <FilterControls
                dataMaskSelected={dataMaskSelected}
                onFilterSelectionChange={onSelectionChange}
                clearAllTriggers={clearAllTriggers}
                onClearAllComplete={onClearAllComplete}
              />
            )}
            {actions}
          </>
        ) : (
          <AppliedFiltersRow data-test="horizontal-filterbar-applied-chips">
            {appliedChips.length ? (
              appliedChips.map(chip => (
                <AppliedFilterChip
                  key={chip.key}
                  $bg={chipColors.bg}
                  $fg={chipColors.fg}
                >
                  <chip.IconComponent iconSize="s" />
                  <span>{chip.label}</span>
                </AppliedFilterChip>
              ))
            ) : (
              <span
                style={{
                  color:
                    theme.colorTextTertiary ?? theme.colorTextSecondary,
                }}
              >
                {t('No applied filters')}
              </span>
            )}
          </AppliedFiltersRow>
        )}
      </HorizontalBarContent>
    </HorizontalBar>
  );
};
