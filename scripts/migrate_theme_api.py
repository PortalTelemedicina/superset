#!/usr/bin/env python3
"""
Script to migrate Superset 5.0 theme API to 6.0 (Ant Design tokens)
"""
import re
import sys
from pathlib import Path

# Mapping from old theme API to new Ant Design tokens
THEME_MAPPINGS = [
    # Grid/Size units
    (r'theme\.gridUnit', 'theme.sizeUnit'),
    
    # Grayscale colors
    (r'theme\.colors\.grayscale\.light5', 'theme.colorBgContainer'),
    (r'theme\.colors\.grayscale\.light4', 'theme.colorBgLayout'),
    (r'theme\.colors\.grayscale\.light3', 'theme.colorBorder'),
    (r'theme\.colors\.grayscale\.light2', 'theme.colorBorderSecondary'),
    (r'theme\.colors\.grayscale\.light1', 'theme.colorFill'),
    (r'theme\.colors\.grayscale\.base', 'theme.colorText'),
    (r'theme\.colors\.grayscale\.dark1', 'theme.colorTextSecondary'),
    (r'theme\.colors\.grayscale\.dark2', 'theme.colorBgElevated'),
    
    # Status colors
    (r'theme\.colors\.success\.base', 'theme.colorSuccess'),
    (r'theme\.colors\.success\.light1', 'theme.colorSuccessBg'),
    (r'theme\.colors\.success\.dark1', 'theme.colorSuccessActive'),
    (r'theme\.colors\.error\.base', 'theme.colorError'),
    (r'theme\.colors\.error\.light1', 'theme.colorErrorBg'),
    (r'theme\.colors\.error\.dark1', 'theme.colorErrorActive'),
    (r'theme\.colors\.warning\.base', 'theme.colorWarning'),
    (r'theme\.colors\.warning\.light1', 'theme.colorWarningBg'),
    (r'theme\.colors\.warning\.dark1', 'theme.colorWarningActive'),
    (r'theme\.colors\.info\.base', 'theme.colorInfo'),
    (r'theme\.colors\.info\.light1', 'theme.colorInfoBg'),
    (r'theme\.colors\.info\.dark1', 'theme.colorInfoActive'),
    (r'theme\.colors\.primary\.base', 'theme.colorPrimary'),
    (r'theme\.colors\.primary\.light1', 'theme.colorPrimaryBg'),
    (r'theme\.colors\.primary\.dark1', 'theme.colorPrimaryActive'),
    
    # Typography
    (r'theme\.typography\.sizes\.xs', 'theme.fontSizeXS'),
    (r'theme\.typography\.sizes\.s', 'theme.fontSizeSM'),
    (r'theme\.typography\.sizes\.m', 'theme.fontSize'),
    (r'theme\.typography\.sizes\.l', 'theme.fontSizeLG'),
    (r'theme\.typography\.sizes\.xl', 'theme.fontSizeXL'),
    (r'theme\.typography\.sizes\.xxl', 'theme.fontSizeHeading1'),
    (r'theme\.typography\.weights\.light', '300'),
    (r'theme\.typography\.weights\.normal', 'theme.fontWeightNormal'),
    (r'theme\.typography\.weights\.bold', 'theme.fontWeightStrong'),
    (r'theme\.typography\.families\.sansSerif', 'theme.fontFamily'),
    (r'theme\.typography\.families\.monospace', 'theme.fontFamilyCode'),
    
    # Opacity - these need special handling
    (r'theme\.opacity\.light', '0.75'),
    (r'theme\.opacity\.mediumLight', '0.6'),
    (r'theme\.opacity\.medium', '0.5'),
    (r'theme\.opacity\.mediumHeavy', '0.35'),
    (r'theme\.opacity\.heavy', '0.25'),
    
    # Z-index
    (r'theme\.zIndex\.aboveAll', '1050'),
    (r'theme\.zIndex\.aboveModal', '1040'),
    (r'theme\.zIndex\.modal', '1030'),
    (r'theme\.zIndex\.dropdown', '1020'),
    
    # Transitions
    (r'theme\.transitionTiming', '0.3s'),
    
    # Border radius (keep as is, just update syntax)
    (r'theme\.borderRadius', 'theme.borderRadius'),
]

def migrate_file(filepath: Path) -> tuple[int, list[str]]:
    """Migrate a single file. Returns (count of changes, list of changes made)."""
    content = filepath.read_text()
    original = content
    changes = []
    
    for old_pattern, new_value in THEME_MAPPINGS:
        # Count matches before replacement
        matches = len(re.findall(old_pattern, content))
        if matches > 0:
            content = re.sub(old_pattern, new_value, content)
            changes.append(f"  {old_pattern} -> {new_value} ({matches}x)")
    
    if content != original:
        filepath.write_text(content)
        return len(changes), changes
    return 0, []

def main():
    frontend_dir = Path('/home/pedro/portal/superset/superset-frontend')
    
    # Files to migrate
    files_to_migrate = [
        'plugins/legacy-preset-chart-deckgl-maplibre-ptm/src/components/Legend.tsx',
        'plugins/legacy-preset-chart-deckgl-maplibre-ptm/src/components/Tooltip.tsx',
        'plugins/plugin-chart-flask/FlaskChart.tsx',
        'plugins/superset-plugin-chart-echarts-ptm/src/SupersetPluginChartEchartsPtm.tsx',
        'plugins/superset-plugin-chart-echarts-ptm/src/plugin/bignumber/BigNumberViz.tsx',
        'plugins/superset-plugin-chart-echarts-ptm/src/plugin/bignumber/total/transformProps.ts',
        'plugins/superset-plugin-chart-echarts-ptm/src/plugin/table/Styles.tsx',
        'plugins/superset-plugin-chart-echarts-ptm/src/plugin/table/TableChartPTM.tsx',
        'src/dashboard/components/HeaderSlots/CustomizableHeader.tsx',
        'src/dashboard/components/HeaderSlots/HeaderSlotEditor.tsx',
        'src/dashboard/components/HeaderSlots/SlotRenderer.tsx',
        'src/dashboard/components/nativeFilters/FilterBar/FiltersOutOfScopeCollapsible/index.tsx',
        'src/dashboard/components/nativeFilters/FilterBar/Header/index.tsx',
        'src/extensions/portal/dashboard/header/adapters/HeaderAdapter.tsx',
        'src/extensions/portal/dashboard/header/components/CustomizableHeader.tsx',
        'src/extensions/portal/dashboard/header/components/HeaderSlotEditor.tsx',
        'src/extensions/portal/dashboard/header/components/SlotRenderer.tsx',
    ]
    
    total_changes = 0
    for rel_path in files_to_migrate:
        filepath = frontend_dir / rel_path
        if filepath.exists():
            count, changes = migrate_file(filepath)
            if count > 0:
                print(f"\n✅ {rel_path}: {count} patterns replaced")
                for change in changes:
                    print(change)
                total_changes += count
        else:
            print(f"⚠️  File not found: {rel_path}")
    
    print(f"\n{'='*50}")
    print(f"Total: {total_changes} pattern types replaced across {len(files_to_migrate)} files")

if __name__ == '__main__':
    main()
