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
 * specific language governing limitations under the License.
 */

import React, { useMemo, useCallback, useState } from 'react';
import { css, useTheme, t } from '@superset-ui/core';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  PageHeaderWithActions,
  PageHeaderWithActionsProps,
} from '@superset-ui/core/components/PageHeaderWithActions';
import { useDispatch } from 'react-redux';
import { CustomizableHeader } from '../components/CustomizableHeader';
import { HeaderSlotEditor } from '../components/HeaderSlotEditor';
import { useStandaloneMode } from '../hooks/useStandaloneMode';
import { useHeaderPreview } from '../hooks/useHeaderPreview';
import { HeaderLayout, getDefaultHeaderLayout } from '../types';
import {
  setDashboardMetadata,
  setUnsavedChanges,
} from 'src/dashboard/actions/dashboardState';
import '../styles/header-custom.css';

export interface HeaderAdapterProps extends PageHeaderWithActionsProps {
  dashboardInfo?: {
    id?: number;
    dashboard_title?: string;
    metadata?: {
      headerLayout?: HeaderLayout;
    };
  };
  editMode?: boolean;
  isEmbedded?: boolean;
  onPreviewToggle?: (preview: boolean) => void;
}

/**
 * Non-intrusive adapter for custom header rendering.
 * 
 * This adapter wraps Superset's PageHeaderWithActions and conditionally
 * renders the custom header when enabled and in standalone/preview mode.
 * 
 * @example
 * ```tsx
 * <HeaderAdapter
 *   dashboardInfo={dashboardInfo}
 *   editMode={false}
 *   isEmbedded={false}
 *   {...pageHeaderProps}
 * />
 * ```
 */
export const HeaderAdapter: React.FC<HeaderAdapterProps> = ({
  dashboardInfo,
  editMode = false,
  isEmbedded = false,
  onPreviewToggle,
  ...pageHeaderProps
}) => {
  const theme = useTheme() as any;
  const dispatch = useDispatch();
  const [showHeaderEditorModal, setShowHeaderEditorModal] = useState(false);
  const isStandaloneMode = useStandaloneMode(isEmbedded);
  const {
    previewMode,
    togglePreview,
    resetPreview,
  } = useHeaderPreview();

  const headerLayout = useMemo<HeaderLayout>(() => {
    const raw = dashboardInfo?.metadata?.headerLayout || getDefaultHeaderLayout();
    return {
      enabled: Boolean(raw?.enabled),
      slots: Array.isArray(raw?.slots) ? raw.slots : [],
      globalStyle: raw?.globalStyle ?? getDefaultHeaderLayout().globalStyle,
    };
  }, [dashboardInfo?.metadata?.headerLayout]);

  const shouldShowCustomHeader =
    headerLayout.enabled && (isStandaloneMode || previewMode);

  const handlePreviewToggle = useCallback(() => {
    togglePreview();
    onPreviewToggle?.(!previewMode);
  }, [previewMode, togglePreview, onPreviewToggle]);

  const handleSaveHeaderLayout = useCallback(
    (layout: HeaderLayout) => {
      try {
        dispatch(setDashboardMetadata({ headerLayout: layout }));
        dispatch(setUnsavedChanges(true));
        setShowHeaderEditorModal(false);
      } catch (err) {
        console.error('[HeaderAdapter] Failed to save header layout:', err);
        setShowHeaderEditorModal(false);
      }
    },
    [dispatch],
  );

  // Add preview button to title panel when custom header is enabled (view mode only)
  // IMPORTANT: All hooks must be called before any conditional returns
  const enhancedTitlePanelItems = useMemo(() => {
    const originalItems = Array.isArray(pageHeaderProps.titlePanelAdditionalItems) 
      ? pageHeaderProps.titlePanelAdditionalItems 
      : [];
    
    if (!editMode && headerLayout.enabled && !isStandaloneMode) {
      const previewButton = (
        <Button
          key="preview-custom-header"
          buttonStyle="link"
          css={css`
            padding: 0 8px;
            margin-left: 8px;
          `}
          onClick={handlePreviewToggle}
        >
          {previewMode ? (
            <>
              <Icons.EyeInvisibleOutlined iconSize="xl" />
              {t('Hide Preview')}
            </>
          ) : (
            <>
              <Icons.EyeOutlined iconSize="xl" />
              {t('Preview')}
            </>
          )}
        </Button>
      );

      return [...originalItems, previewButton];
    }
    
    return originalItems;
  }, [
    editMode,
    headerLayout.enabled,
    isStandaloneMode,
    previewMode,
    pageHeaderProps.titlePanelAdditionalItems,
    handlePreviewToggle,
    t,
  ]);

  // Add "Customize header" button to right panel when in edit mode (so user can enable/edit header)
  const enhancedRightPanelItems = useMemo(() => {
    const original = pageHeaderProps.rightPanelAdditionalItems;
    if (editMode) {
      const customizeButton = (
        <Button
          key="customize-header"
          buttonStyle="secondary"
          buttonSize="small"
          onClick={() => setShowHeaderEditorModal(true)}
          css={css`
            margin-right: ${theme.sizeUnit * 2}px;
          `}
          data-test="customize-header-button"
          aria-label={t('Customize header')}
        >
          <Icons.SettingOutlined iconSize="m" />
          {t('Customize header')}
        </Button>
      );
      return (
        <>
          {customizeButton}
          {original}
        </>
      );
    }
    return original;
  }, [editMode, pageHeaderProps.rightPanelAdditionalItems, theme.sizeUnit]);

  // Render preview banner when in preview mode (not standalone)
  const PreviewBanner = previewMode && !isStandaloneMode ? (
    <div
      css={css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px;
        background-color: ${theme.colorPrimary};
        color: white;
        font-size: ${theme.fontSizeSM}px;
      `}
      className="portal-header-preview-banner"
    >
      <span>{t('Preview Mode: Custom Header')}</span>
      <Button
        buttonStyle="link"
        css={css`
          color: white !important;
          padding: 0 8px;
          height: auto;
          font-size: ${theme.fontSizeSM}px;
          &:hover {
            color: ${theme.colorBgContainer} !important;
          }
        `}
        onClick={resetPreview}
      >
        <Icons.CloseOutlined iconSize="m" />
        {t('Exit Preview')}
      </Button>
    </div>
  ) : null;

  // Now we can do conditional returns after all hooks are called
  if (shouldShowCustomHeader) {
    return (
      <div className="dashboard-header-container">
        {PreviewBanner}
        <CustomizableHeader
          headerLayout={headerLayout}
          dashboardTitle={dashboardInfo?.dashboard_title}
          dashboardId={dashboardInfo?.id}
        />
      </div>
    );
  }

  // Fallback to original header (with optional "Customize header" button and inline editor)
  return (
    <>
      <PageHeaderWithActions
        {...pageHeaderProps}
        titlePanelAdditionalItems={enhancedTitlePanelItems}
        rightPanelAdditionalItems={enhancedRightPanelItems}
      />
      {showHeaderEditorModal && (
        <div
          data-test="header-layout-editor-inline"
          css={css`
            margin: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 4}px ${theme.sizeUnit * 4}px ${theme.sizeUnit * 4}px;
            padding: ${theme.sizeUnit * 4}px;
            background: ${theme.colorBgContainer};
            border: 1px solid ${theme.colorBorder};
            border-radius: ${theme.sizeUnit * 2}px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          `}
        >
          <HeaderSlotEditor
            headerLayout={headerLayout}
            dashboardTitle={dashboardInfo?.dashboard_title}
            onSave={handleSaveHeaderLayout}
            onCancel={() => setShowHeaderEditorModal(false)}
          />
        </div>
      )}
    </>
  );
};

