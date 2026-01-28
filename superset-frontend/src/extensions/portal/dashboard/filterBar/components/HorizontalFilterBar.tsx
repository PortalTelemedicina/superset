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

import { FC, memo, useMemo, useState } from 'react';
import {
  DataMaskStateWithId,
  isDefined,
  isNativeFilter,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import { useSelector } from 'react-redux';
import Loading from 'src/components/Loading';
import Icons from 'src/components/Icons';
import { RootState } from 'src/dashboard/types';
import { useChartLayoutItems } from 'src/dashboard/util/useChartLayoutItems';
import { useChartIds } from 'src/dashboard/util/charts/useChartIds';
import { extractLabel } from 'src/dashboard/components/nativeFilters/selectors';

import FilterControls from 'src/dashboard/components/nativeFilters/FilterBar/FilterControls/FilterControls';
import crossFiltersSelector from 'src/dashboard/components/nativeFilters/FilterBar/CrossFilters/selectors';
import {
  getFilterBarTestId,
  useChartsVerboseMaps,
} from 'src/dashboard/components/nativeFilters/FilterBar/utils';
import { HorizontalBarProps } from 'src/dashboard/components/nativeFilters/FilterBar/types';

import PortalFilterBarSettings from './FilterBarSettings';

const HorizontalBar = styled.div`
  ${({ theme }) => `
    padding: ${theme.gridUnit * 3}px ${theme.gridUnit * 2}px ${
      theme.gridUnit * 3
    }px ${theme.gridUnit * 4}px;
    background: ${theme.colors.grayscale.light5};
    box-shadow: inset 0px -2px 2px -1px ${theme.colors.grayscale.light2};
    position: relative;
    transition: padding 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `}
`;

const HorizontalBarContent = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-start;
    line-height: normal;
    padding-left: ${theme.gridUnit * 8}px;
    position: relative;

    .loading {
      margin: ${theme.gridUnit * 2}px auto ${theme.gridUnit * 2}px;
      padding: 0;
    }
  `}
`;

const ContentWrapper = styled.div`
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: flex-end;
  overflow: visible;
`;

const ExpandedSection = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  width: 100%;
  min-height: 90px;
  overflow: visible;
`;

const ExpandedFiltersArea = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActionsInline = styled.div`
  flex: 0 0 auto;
  margin-left: auto;
  min-width: 0;

  /* PTM stylesheet sets filterbar-action-buttons to width: 100%;
     inside a flex row that collapses the filters area. */
  &[data-test='horizontal-filterbar-actions'] [data-test='filterbar-action-buttons'] {
    width: auto !important;
  }
`;

const AppliedFiltersRow = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.gridUnit * 2}px;
    flex-wrap: wrap;
    line-height: 1.2;
    width: 100%;
  `}
`;

const AppliedFilterChip = styled.div<{
  $bg: string;
  $fg: string;
}>`
  ${({ theme, $bg, $fg }) => `
    display: inline-flex;
    align-items: center;
    gap: ${theme.gridUnit * 1.5}px;
    padding: ${theme.gridUnit * 1.5}px ${theme.gridUnit * 3}px;
    background: ${$bg};
    color: ${$fg};
    border-radius: ${theme.gridUnit * 2}px;
    font-size: ${theme.typography.sizes.s}px;
    font-weight: ${theme.typography.weights.medium};
    white-space: nowrap;
  `}
`;

const ToggleButton = styled.button`
  ${({ theme }) => `
    position: absolute;
    left: ${theme.gridUnit * 2}px;
    top: ${theme.gridUnit * 2}px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: ${theme.gridUnit * 6}px;
    height: ${theme.gridUnit * 6}px;
    border: none;
    border-radius: ${theme.gridUnit * 2}px;
    background: transparent;
    padding: 0;
    cursor: pointer;
    color: ${theme.colors.grayscale.base};
    z-index: 10;
    transition: all 0.2s ease;

    &:hover {
      background: ${theme.colors.grayscale.light4};
      transform: scale(1.05);
    }

    &:active {
      transform: scale(0.95);
    }

    &:focus-visible {
      outline: 2px solid ${theme.colors.primary.dark2};
      outline-offset: 2px;
    }
  `}
`;

const ChevronIcon = styled.div<{ $isExpanded: boolean }>`
  ${({ $isExpanded }) => `
    display: flex;
    align-items: center;
    justify-content: center;
    transform: rotate(${$isExpanded ? 180 : 0}deg);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `}
`;

const FilterBarEmptyStateContainer = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.typography.weights.bold};
    color: ${theme.colors.grayscale.base};
    font-size: ${theme.typography.sizes.s}px;
    padding-left: ${theme.gridUnit * 2}px;
  `}
`;

type ChipTone = 'blue' | 'purple' | 'green' | 'gray';

const getChipTone = (label: string): ChipTone => {
  const s = label.toLowerCase();
  if (
    s.includes('local') ||
    s.includes('cidade') ||
    s.includes('estado') ||
    s.includes('uf') ||
    s.includes('regi')
  ) {
    return 'blue';
  }
  if (s.includes('categoria') || s.includes('segmento') || s.includes('tag')) {
    return 'purple';
  }
  if (s.includes('tipo') || s.includes('type')) {
    return 'green';
  }
  return 'gray';
};

const getChipIconForTone = (tone: ChipTone) => {
  switch (tone) {
    case 'blue':
      return Icons.LocationFilled;
    case 'purple':
      return Icons.Tag;
    case 'green':
      return Icons.List;
    default:
      return Icons.FilterSmall;
  }
};

type IconComponent = typeof Icons.FilterSmall;

const PortalHorizontalFilterBar: FC<HorizontalBarProps> = ({
  actions,
  dataMaskSelected,
  filterValues,
  isInitialized,
  onSelectionChange,
}) => {
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
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
        const label = extractLabel(dataMask?.[filter.id]?.filterState);
        if (!label) {
          return null;
        }

        const tone = getChipTone(filter.name);
        const isTime =
          filter.name.toLowerCase().includes('data') ||
          filter.name.toLowerCase().includes('date') ||
          filter.name.toLowerCase().includes('tempo');
        const IconComponent = isTime ? Icons.Calendar : getChipIconForTone(tone);

        return {
          key: `native:${filter.id}`,
          label,
          tone,
          IconComponent,
        };
      })
      .filter(Boolean) as Array<{
      key: string;
      label: string;
      tone: ChipTone;
      IconComponent: IconComponent;
    }>;
  }, [dataMask, filterValues]);

  const appliedCrossFilterChips = useMemo(
    () =>
      selectedCrossFilters
        .map(filter => {
          if (!isDefined(filter.value)) {
            return null;
          }
          const tone = getChipTone(String(filter.column ?? filter.name));
          const IconComponent = getChipIconForTone(tone);
          return {
            key: `cross:${filter.emitterId}:${filter.column ?? filter.name}`,
            label: String(filter.value),
            tone,
            IconComponent,
          };
        })
        .filter(Boolean) as Array<{
        key: string;
        label: string;
        tone: ChipTone;
        IconComponent: IconComponent;
      }>,
    [selectedCrossFilters],
  );

  const appliedChips = useMemo(
    () => [...appliedNativeFilterChips, ...appliedCrossFilterChips],
    [appliedCrossFilterChips, appliedNativeFilterChips],
  );

  const getChipColors = (tone: ChipTone) => {
    switch (tone) {
      case 'blue':
        return {
          bg: theme.colors.info?.light2 ?? theme.colors.primary.light5,
          fg: theme.colors.info?.dark2 ?? theme.colors.primary.dark2,
        };
      case 'purple':
        return {
          bg: (theme.colors as any).secondary?.light2 ?? theme.colors.primary.light5,
          fg: (theme.colors as any).secondary?.dark2 ?? theme.colors.primary.dark2,
        };
      case 'green':
        return {
          bg: theme.colors.success?.light2 ?? theme.colors.primary.light5,
          fg: theme.colors.success?.dark2 ?? theme.colors.primary.dark2,
        };
      default:
        return {
          bg: theme.colors.grayscale.light3,
          fg: theme.colors.grayscale.dark1,
        };
    }
  };

  return (
    <HorizontalBar {...getFilterBarTestId()}>
      <HorizontalBarContent>
        {!isInitialized ? (
          <Loading position="inline-centered" />
        ) : (
          <>
            <PortalFilterBarSettings />

            <ContentWrapper>
              {isFilterExpanded ? (
                <ExpandedSection>
                  <ExpandedFiltersArea>
                    {!hasFilters && (
                      <FilterBarEmptyStateContainer data-test="horizontal-filterbar-empty">
                        {t('No filters are currently added to this dashboard.')}
                      </FilterBarEmptyStateContainer>
                    )}
                    {hasFilters && (
                      <FilterControls
                        dataMaskSelected={dataMaskSelected}
                        onFilterSelectionChange={onSelectionChange}
                      />
                    )}
                    <ActionsInline data-test="horizontal-filterbar-actions">
                      {actions}
                    </ActionsInline>
                  </ExpandedFiltersArea>
                </ExpandedSection>
              ) : (
                <AppliedFiltersRow data-test="horizontal-filterbar-applied-chips">
                  {appliedChips.length ? (
                    appliedChips.map(chip => {
                      const { bg, fg } = getChipColors(chip.tone);
                      const IconComponent = chip.IconComponent;
                      return (
                        <AppliedFilterChip key={chip.key} $bg={bg} $fg={fg}>
                          <IconComponent iconSize="s" />
                          <span>{chip.label}</span>
                        </AppliedFilterChip>
                      );
                    })
                  ) : (
                    <span style={{ color: theme.colors.grayscale.light1 }}>
                      {t('No applied filters')}
                    </span>
                  )}
                </AppliedFiltersRow>
              )}
            </ContentWrapper>

            <ToggleButton
              type="button"
              aria-label={
                isFilterExpanded ? t('Collapse filter bar') : t('Expand filter bar')
              }
              onClick={() => setIsFilterExpanded(v => !v)}
              data-test="horizontal-filterbar-toggle"
            >
              <ChevronIcon $isExpanded={isFilterExpanded}>
                <Icons.CaretUp />
              </ChevronIcon>
            </ToggleButton>
          </>
        )}
      </HorizontalBarContent>
    </HorizontalBar>
  );
};

export default memo(PortalHorizontalFilterBar);

