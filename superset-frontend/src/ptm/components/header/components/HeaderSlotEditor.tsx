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
import React, { useState, useCallback } from 'react';
import {
  styled,
  t,
  SupersetClient,
  getClientErrorObject,
} from '@superset-ui/core';
import {
  Button,
  Modal,
  Select,
  Input,
  InputNumber,
  Switch,
  Upload,
  Form,
  message,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  DragOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getThemeTokens } from 'src/ptm/shared/themeTokens';
import {
  HeaderLayout,
  HeaderSlot,
  SlotType,
  SlotPosition,
  createDefaultSlot,
  getDefaultHeaderLayout,
  LogoSlot,
  TitleSlot,
  TextSlot,
  DateSlot,
  DataFreshnessSlot,
  BadgeSlot,
} from '../types';
import CustomizableHeader from './CustomizableHeader';

const EditorContainer = styled.div`
  padding: 24px;
  background: ${({ theme }) => getThemeTokens(theme).colorBgLayout};
  border-radius: 8px;
`;

const PreviewSectionLabel = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${getThemeTokens(theme).colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const PreviewBarFrame = styled.div`
  ${({ theme }) => `
    min-height: 64px;
    background: ${getThemeTokens(theme).colorBgContainer};
    border: 1px solid ${getThemeTokens(theme).colorBorder};
    border-radius: 8px;
    box-sizing: border-box;
    padding: 0 8px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  `}
`;

const PreviewBarInner = styled.div`
  width: 100%;
  min-width: 0;
  /* CustomizableHeader provides its own padding; constrain width for modal */
  max-width: 100%;
`;

const EditorLayout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
`;

const EditorContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const EditorActions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const SlotList = styled.div`
  display: flex;
  flex-direction: row;
  gap: 12px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
`;

const SlotItem = styled.div<{ isDragging?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: white;
  border: 1px solid ${({ theme }) => getThemeTokens(theme).colorBorder};
  border-radius: 6px;
  opacity: ${({ isDragging }) => (isDragging ? 0.5 : 1)};
  cursor: grab;
  min-width: 260px;
  max-width: 320px;
  overflow: hidden;

  &:hover {
    border-color: ${({ theme }) => getThemeTokens(theme).colorPrimary};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;

const SlotInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SlotTypeLabel = styled.div`
  font-weight: 600;
  color: ${({ theme }) => getThemeTokens(theme).colorTextHeading};
`;

const SlotDetails = styled.div`
  font-size: 12px;
  color: ${({ theme }) => getThemeTokens(theme).colorTextSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
`;

/** Wrapper so Form.Item injects value/onChange but Upload receives fileList (antd expects fileList, not value). */
const LogoUrlUpload: React.FC<{
  value?: string;
  onUpload: (file: File) => void;
  uploading: boolean;
}> = ({ value, onUpload, uploading }) => (
  <Upload
    accept="image/*"
    fileList={value ? [{ uid: 'logo', name: 'logo', url: value }] : []}
    showUploadList={false}
    beforeUpload={file => {
      onUpload(file as File);
      return false;
    }}
    disabled={uploading}
  >
    <Button icon={<PictureOutlined />} loading={uploading} type="default" block>
      {uploading ? t('Uploading...') : t('Upload Image')}
    </Button>
  </Upload>
);

interface HeaderSlotEditorProps {
  headerLayout: HeaderLayout;
  dashboardTitle?: string;
  onSave: (layout: HeaderLayout) => void;
  onCancel: () => void;
}

export const HeaderSlotEditor: React.FC<HeaderSlotEditorProps> = ({
  headerLayout: initialLayout,
  dashboardTitle,
  onSave,
  onCancel,
}) => {
  const [layout, setLayout] = useState<HeaderLayout>(
    initialLayout.enabled ? initialLayout : getDefaultHeaderLayout(),
  );
  const [editingSlot, setEditingSlot] = useState<HeaderSlot | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [currentSlotType, setCurrentSlotType] = useState<SlotType | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const previewLayout: HeaderLayout = {
    ...layout,
    enabled: true,
    globalStyle: {
      ...layout.globalStyle,
      // Provide breathing room inside the preview frame so right edge never clips logos.
      padding: '0 16px',
    },
  };

  const handleDragEnd = useCallback(
    (result: any) => {
      if (!result.destination) return;

      const newSlots = Array.from(layout.slots);
      const [removed] = newSlots.splice(result.source.index, 1);
      newSlots.splice(result.destination.index, 0, removed);

      // Update order
      const reorderedSlots = newSlots.map((slot, index) => ({
        ...slot,
        order: index,
      }));

      setLayout({ ...layout, slots: reorderedSlots });
    },
    [layout],
  );

  const handleAddSlot = useCallback(() => {
    const newSlot = createDefaultSlot(SlotType.LOGO, SlotPosition.LEFT);
    newSlot.order = layout.slots.length;
    setEditingSlot(newSlot);
    setCurrentSlotType(SlotType.LOGO);
    setIsModalVisible(true);
  }, [layout.slots.length]);

  const handleEditSlot = useCallback((slot: HeaderSlot) => {
    setEditingSlot(slot);
    setCurrentSlotType(slot.type);
    setUploadedImageUrl(
      slot.type === SlotType.LOGO ? (slot as LogoSlot).url || null : null,
    );
    setIsModalVisible(true);
  }, []);

  const handleDeleteSlot = useCallback(
    (slotId: string) => {
      setLayout({
        ...layout,
        slots: layout.slots.filter(s => s.id !== slotId),
      });
      message.success(t('Element removed'));
    },
    [layout],
  );

  const handleToggleVisibility = useCallback(
    (slotId: string) => {
      setLayout({
        ...layout,
        slots: layout.slots.map(s =>
          s.id === slotId ? { ...s, visible: !s.visible } : s,
        ),
      });
    },
    [layout],
  );

  const handleTypeChange = useCallback(
    (newType: SlotType) => {
      if (!editingSlot) return;

      // Create new slot with the new type, preserving position and order
      const newSlot = createDefaultSlot(newType, editingSlot.position);
      newSlot.id = editingSlot.id; // Keep same ID
      newSlot.order = editingSlot.order; // Keep same order
      newSlot.visible = editingSlot.visible; // Keep visibility

      setEditingSlot(newSlot);
      setCurrentSlotType(newType);

      // Reset form and set new values
      form.resetFields();
      form.setFieldsValue({
        type: newType,
        position: newSlot.position,
        visible: newSlot.visible,
      });

      // Set type-specific initial values
      switch (newType) {
        case SlotType.LOGO:
          form.setFieldsValue({
            size: { maxHeight: 40 },
          });
          break;
        case SlotType.TITLE:
          form.setFieldsValue({
            fontSize: 20,
          });
          break;
        case SlotType.DATE:
          form.setFieldsValue({
            format: 'DD/MM/YYYY',
            showTime: false,
          });
          break;
        case SlotType.DATA_FRESHNESS:
          form.setFieldsValue({
            label: 'Última atualização',
            timezone: 'America/Sao_Paulo',
            showTime: true,
            aggregation: 'min',
            formatPreset: 'pt_long',
            showDetails: false,
          });
          break;
        case SlotType.BADGE:
          form.setFieldsValue({
            badgeType: 'default',
          });
          break;
      }
    },
    [editingSlot, form],
  );

  const handleModalOk = useCallback(() => {
    form.validateFields().then(values => {
      // If type changed, create new slot with new type
      let updatedSlot: HeaderSlot;
      if (values.type && values.type !== editingSlot!.type) {
        updatedSlot = createDefaultSlot(
          values.type,
          values.position || editingSlot!.position,
        );
        updatedSlot.id = editingSlot!.id; // Keep same ID
        updatedSlot.order = editingSlot!.order; // Keep same order
        updatedSlot.visible = editingSlot!.visible; // Keep visibility
        // Merge other values
        updatedSlot = {
          ...updatedSlot,
          ...values,
        };
      } else {
        updatedSlot = {
          ...editingSlot!,
          ...values,
        };
      }

      const existingIndex = layout.slots.findIndex(
        s => s.id === updatedSlot.id,
      );
      const newSlots =
        existingIndex >= 0
          ? layout.slots.map(s => (s.id === updatedSlot.id ? updatedSlot : s))
          : [...layout.slots, updatedSlot];

      setLayout({ ...layout, slots: newSlots });
      setIsModalVisible(false);
      setEditingSlot(null);
      setCurrentSlotType(null);
      form.resetFields();
      message.success(t('Element saved'));
    });
  }, [editingSlot, form, layout]);

  const handleSave = useCallback(() => {
    onSave({ ...layout, enabled: true });
    message.success(t('Header layout saved'));
  }, [layout, onSave]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await SupersetClient.post({
          endpoint: '/api/v1/dashboard/upload_header_image/',
          body: formData,
          headers: { Accept: 'application/json' },
        });

        const { url } = response.json.result;
        form.setFieldsValue({ url });
        setUploadedImageUrl(url);
        message.success(t('Image uploaded successfully'));
        return false; // Prevent default upload
      } catch (error) {
        getClientErrorObject(error).then(errorObj => {
          const errorMessage =
            errorObj.message || errorObj.error || t('Unknown error');
          message.error(t('Failed to upload image: ') + errorMessage);
          console.error('Upload error:', errorObj);
        });
        return false;
      } finally {
        setUploading(false);
      }
    },
    [form],
  );

  const renderSlotForm = () => {
    if (!editingSlot || !currentSlotType) return null;

    const commonFields = (
      <>
        <Form.Item
          name="position"
          label={t('Position')}
          initialValue={editingSlot.position}
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value={SlotPosition.LEFT}>{t('Left')}</Select.Option>
            <Select.Option value={SlotPosition.CENTER}>
              {t('Center')}
            </Select.Option>
            <Select.Option value={SlotPosition.RIGHT}>
              {t('Right')}
            </Select.Option>
          </Select>
        </Form.Item>

        <Divider
          orientation="left"
          style={{ margin: '12px 0', fontSize: 12, color: '#999' }}
        >
          {t('Layout Controls (Advanced)')}
        </Divider>

        <Form.Item
          name="align"
          label={t('Alignment within section')}
          initialValue={editingSlot.align || undefined}
          extra={t('Fine-tune position within the selected section')}
        >
          <Select allowClear placeholder={t('Auto')}>
            <Select.Option value="start">{t('Start (Left)')}</Select.Option>
            <Select.Option value="center">{t('Center')}</Select.Option>
            <Select.Option value="end">{t('End (Right)')}</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="flexShrink"
          label={t('Shrink behavior')}
          initialValue={editingSlot.flexShrink ?? 0}
          extra={t('Can element shrink if space is limited?')}
        >
          <Select>
            <Select.Option value={0}>{t('Fixed - Keep size')}</Select.Option>
            <Select.Option value={1}>
              {t('Flexible - Can shrink')}
            </Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="flexGrow"
          label={t('Grow behavior')}
          initialValue={editingSlot.flexGrow ?? 0}
          extra={t('Can element grow to fill space?')}
        >
          <Select>
            <Select.Option value={0}>{t('Fixed - Keep size')}</Select.Option>
            <Select.Option value={1}>{t('Flexible - Can grow')}</Select.Option>
          </Select>
        </Form.Item>
      </>
    );

    switch (currentSlotType) {
      case SlotType.LOGO:
        const logoSlot =
          currentSlotType === editingSlot.type
            ? (editingSlot as LogoSlot)
            : null;
        return (
          <>
            {commonFields}
            <Form.Item
              name="url"
              label={t('Logo Image')}
              initialValue={logoSlot?.url || ''}
              rules={[
                { required: true, message: t('Please upload an image file') },
              ]}
              extra={t(
                'Upload an image file (PNG, JPG, SVG, GIF, or WebP, max 2MB)',
              )}
            >
              <LogoUrlUpload
                onUpload={handleImageUpload}
                uploading={uploading}
              />
            </Form.Item>
            {/* Show preview of uploaded/selected image */}
            {(uploadedImageUrl || logoSlot?.url) && (
              <div
                style={{ marginTop: 16, marginBottom: 16, textAlign: 'center' }}
              >
                <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
                  {t('Preview')}:
                </div>
                <img
                  src={uploadedImageUrl || logoSlot?.url}
                  alt="Logo preview"
                  style={{
                    maxHeight: 100,
                    maxWidth: 200,
                    objectFit: 'contain',
                    border: '1px solid #d9d9d9',
                    borderRadius: 4,
                    padding: 8,
                    backgroundColor: '#fafafa',
                  }}
                  onError={e => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <Form.Item
              name={['size', 'maxHeight']}
              label={t('Max Height (px)')}
              initialValue={logoSlot?.size?.maxHeight || 40}
            >
              <InputNumber min={20} max={200} />
            </Form.Item>
            <Form.Item
              name="openInNewTab"
              label={t('Open link in new tab')}
              initialValue={logoSlot?.openInNewTab || false}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </>
        );

      case SlotType.TITLE:
        const titleSlot = editingSlot as TitleSlot;
        return (
          <>
            {commonFields}
            <Form.Item
              name="content"
              label={t('Custom Title')}
              initialValue={titleSlot.content}
              extra={t('Leave empty to use dashboard title')}
            >
              <Input placeholder={dashboardTitle || 'Dashboard'} />
            </Form.Item>
            <Form.Item
              name="fontSize"
              label={t('Font Size')}
              initialValue={titleSlot.fontSize || 20}
            >
              <InputNumber min={12} max={48} />
            </Form.Item>
          </>
        );

      case SlotType.TEXT:
        const textSlot = editingSlot as TextSlot;
        return (
          <>
            {commonFields}
            <Form.Item
              name="content"
              label={t('Text Content')}
              initialValue={textSlot.content}
              rules={[{ required: true }]}
              extra={t('Use {date}, {time}, {datetime} for dynamic values')}
            >
              <Input.TextArea rows={3} placeholder={t('Enter text...')} />
            </Form.Item>
            <Form.Item
              name="supportsDynamicContent"
              label={t('Enable dynamic content')}
              initialValue={textSlot.supportsDynamicContent}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </>
        );

      case SlotType.DATE:
        const dateSlot = editingSlot as DateSlot;
        return (
          <>
            {commonFields}
            <Form.Item
              name="format"
              label={t('Date Format')}
              initialValue={dateSlot.format || 'DD/MM/YYYY'}
            >
              <Input placeholder="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item
              name="showTime"
              label={t('Show Time')}
              initialValue={dateSlot.showTime}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </>
        );

      case SlotType.DATA_FRESHNESS:
        const freshnessSlot = editingSlot as DataFreshnessSlot;
        return (
          <>
            {commonFields}
            <Form.Item
              name="label"
              label={t('Label')}
              initialValue={freshnessSlot.label || 'Última atualização'}
            >
              <Input placeholder={t('Última atualização')} />
            </Form.Item>
            <Form.Item
              name="timezone"
              label={t('Timezone')}
              initialValue={freshnessSlot.timezone || 'America/Sao_Paulo'}
            >
              <Input placeholder="America/Sao_Paulo" />
            </Form.Item>
            <Form.Item
              name="showTime"
              label={t('Show Time')}
              initialValue={freshnessSlot.showTime ?? true}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="aggregation"
              label={t('Aggregation')}
              initialValue={freshnessSlot.aggregation || 'min'}
            >
              <Select>
                <Select.Option value="min">{t('Minimum')}</Select.Option>
                <Select.Option value="max">{t('Maximum')}</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="formatPreset"
              label={t('Date format')}
              initialValue={freshnessSlot.formatPreset || 'pt_long'}
            >
              <Select>
                <Select.Option value="pt_full">
                  {t('Português (completo)')}
                </Select.Option>
                <Select.Option value="pt_long">
                  {t('Português (longo)')}
                </Select.Option>
                <Select.Option value="pt_medium">
                  {t('Português (médio)')}
                </Select.Option>
                <Select.Option value="pt_short">
                  {t('Português (curto)')}
                </Select.Option>
                <Select.Option value="numeric_date">
                  {t('Data numérica (14/01/2025)')}
                </Select.Option>
                <Select.Option value="iso_date">
                  {t('ISO (2025-01-14)')}
                </Select.Option>
                <Select.Option value="iso_datetime">
                  {t('ISO data e hora (2025-01-14 15:04:05)')}
                </Select.Option>
                <Select.Option value="time_hms">
                  {t('Hora (15:04:05)')}
                </Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="showDetails"
              label={t('Show details')}
              initialValue={freshnessSlot.showDetails}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </>
        );

      case SlotType.BADGE:
        const badgeSlot = editingSlot as BadgeSlot;
        return (
          <>
            {commonFields}
            <Form.Item
              name="label"
              label={t('Label')}
              initialValue={badgeSlot.label}
              rules={[{ required: true }]}
            >
              <Input placeholder="Status" />
            </Form.Item>
            <Form.Item
              name="value"
              label={t('Value (optional)')}
              initialValue={badgeSlot.value}
            >
              <Input placeholder="Active" />
            </Form.Item>
            <Form.Item
              name="badgeType"
              label={t('Type')}
              initialValue={badgeSlot.badgeType || 'default'}
            >
              <Select>
                <Select.Option value="default">{t('Default')}</Select.Option>
                <Select.Option value="success">{t('Success')}</Select.Option>
                <Select.Option value="warning">{t('Warning')}</Select.Option>
                <Select.Option value="error">{t('Error')}</Select.Option>
                <Select.Option value="info">{t('Info')}</Select.Option>
              </Select>
            </Form.Item>
          </>
        );

      default:
        return commonFields;
    }
  };

  const getSlotDisplayInfo = (slot: HeaderSlot) => {
    switch (slot.type) {
      case SlotType.LOGO:
        return { type: 'Logo', details: (slot as LogoSlot).url || 'No URL' };
      case SlotType.TITLE:
        return {
          type: 'Title',
          details:
            (slot as TitleSlot).content || dashboardTitle || 'Dashboard Title',
        };
      case SlotType.TEXT:
        return { type: 'Text', details: (slot as TextSlot).content };
      case SlotType.DATE:
        return {
          type: 'Date',
          details: (slot as DateSlot).format || 'DD/MM/YYYY',
        };
      case SlotType.DATA_FRESHNESS:
        return {
          type: 'Data Freshness',
          details: (slot as DataFreshnessSlot).label || 'Última atualização',
        };
      case SlotType.BADGE:
        return { type: 'Badge', details: (slot as BadgeSlot).label };
      case SlotType.SPACER:
        return { type: 'Spacer', details: 'Empty space' };
      case SlotType.DIVIDER:
        return { type: 'Divider', details: 'Separator line' };
      default:
        return { type: 'Unknown', details: '' };
    }
  };

  return (
    <EditorContainer>
      <h3 style={{ marginBottom: 16 }}>{t('Header Layout Editor')}</h3>

      <EditorLayout>
        <EditorContent>
          <div>
            <PreviewSectionLabel>{t('Preview')}</PreviewSectionLabel>
            <PreviewBarFrame>
              <PreviewBarInner>
                <CustomizableHeader
                  headerLayout={previewLayout}
                  dashboardTitle={dashboardTitle}
                />
              </PreviewBarInner>
            </PreviewBarFrame>
          </div>

          <div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddSlot}
              style={{ marginBottom: 12 }}
            >
              {t('Add Element')}
            </Button>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="slots" direction="horizontal">
                {provided => (
                  <SlotList
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                  >
                    {layout.slots.map((slot, index) => {
                      const displayInfo = getSlotDisplayInfo(slot);
                      return (
                        <Draggable
                          key={slot.id}
                          draggableId={slot.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <SlotItem
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              isDragging={snapshot.isDragging}
                            >
                              <DragOutlined
                                style={{
                                  fontSize: 16,
                                  color: '#999',
                                  cursor: 'grab',
                                }}
                              />
                              <SlotInfo>
                                <SlotTypeLabel>
                                  {displayInfo.type}
                                </SlotTypeLabel>
                                <SlotDetails>{displayInfo.details}</SlotDetails>
                              </SlotInfo>
                              <ButtonGroup>
                                <Button
                                  size="small"
                                  icon={
                                    slot.visible ? (
                                      <EyeOutlined />
                                    ) : (
                                      <EyeInvisibleOutlined />
                                    )
                                  }
                                  onClick={() =>
                                    handleToggleVisibility(slot.id)
                                  }
                                />
                                <Button
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => handleEditSlot(slot)}
                                />
                                <Button
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => handleDeleteSlot(slot.id)}
                                />
                              </ButtonGroup>
                            </SlotItem>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </SlotList>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </EditorContent>

        <EditorActions>
          <Button onClick={onCancel}>{t('Cancel')}</Button>
          <Button type="primary" onClick={handleSave}>
            {t('Save Layout')}
          </Button>
        </EditorActions>
      </EditorLayout>

      {/* Edit Modal */}
      <Modal
        title={t('Edit Element')}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingSlot(null);
          setCurrentSlotType(null);
          setUploadedImageUrl(null);
          form.resetFields();
        }}
        width={600}
      >
        {editingSlot && (
          <Form form={form} layout="vertical">
            <Form.Item
              name="type"
              label={t('Element Type')}
              initialValue={editingSlot.type}
            >
              <Select onChange={handleTypeChange}>
                <Select.Option value={SlotType.LOGO}>{t('Logo')}</Select.Option>
                <Select.Option value={SlotType.TITLE}>
                  {t('Title')}
                </Select.Option>
                <Select.Option value={SlotType.TEXT}>{t('Text')}</Select.Option>
                <Select.Option value={SlotType.DATE}>{t('Date')}</Select.Option>
                <Select.Option value={SlotType.DATA_FRESHNESS}>
                  {t('Data Freshness')}
                </Select.Option>
                <Select.Option value={SlotType.BADGE}>
                  {t('Badge')}
                </Select.Option>
                <Select.Option value={SlotType.SPACER}>
                  {t('Spacer')}
                </Select.Option>
                <Select.Option value={SlotType.DIVIDER}>
                  {t('Divider')}
                </Select.Option>
              </Select>
            </Form.Item>
            {renderSlotForm()}
          </Form>
        )}
      </Modal>
    </EditorContainer>
  );
};

export default HeaderSlotEditor;
