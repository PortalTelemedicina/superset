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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, useTheme } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Icons,
  Input,
  Modal,
  Radio,
  Select,
  Table,
  Tag,
  Upload,
} from '@superset-ui/core/components';
import {
  TableSize,
  type ColumnsType,
} from '@superset-ui/core/components/Table';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { fetchPaginatedData } from 'src/utils/fetchOptions';
import {
  USER_IMPORT_ACCEPT,
  ImportResult,
  ImportRow,
  PlanStatus,
  RowStatus,
  UserImportError,
  buildReportCsv,
  downloadCsv,
  importUsers,
  rowReasonText,
  statusLabel,
  statusTagColor,
  warningLabel,
} from './userImport';

enum Step {
  Upload = 'upload',
  Preview = 'preview',
  Result = 'result',
}

type StatusFilter = 'all' | RowStatus;

type RoleRecord = { id: number; name: string };

export interface UserImportModalProps {
  show: boolean;
  onHide: () => void;
  /** Chamado quando o commit termina, para a lista recarregar. */
  onImported?: () => void;
}

const ADMIN_ROLE = 'admin';
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx'];

const hasAllowedExtension = (name: string) =>
  ALLOWED_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));

const fullName = (row: ImportRow) =>
  [row.first_name, row.last_name].filter(Boolean).join(' ');

export default function UserImportModal({
  show,
  onHide,
  onImported,
}: UserImportModalProps) {
  const theme = useTheme();
  const { addDangerToast, addSuccessToast, addWarningToast } = useToasts();
  const [step, setStep] = useState<Step>(Step.Upload);
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetAll = useCallback(() => {
    setStep(Step.Upload);
    setFile(null);
    setRole(undefined);
    setPreview(null);
    setResult(null);
    setFilter('all');
    setConfirmText('');
    setSubmitting(false);
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    if (!show) return;
    setLoadingRoles(true);
    fetchPaginatedData({
      endpoint: '/api/v1/security/roles/',
      setData: (data: RoleRecord[]) =>
        setRoles(data.filter(r => r.name.trim().toLowerCase() !== ADMIN_ROLE)),
      setLoadingState: setLoadingRoles,
      loadingKey: 'roles',
      addDangerToast,
      errorMessage: t('Error while fetching roles'),
    });
  }, [show, addDangerToast]);

  const handleHide = () => {
    resetAll();
    onHide();
  };

  // Arquivo ou role novos tornam o plano anterior inválido no servidor.
  const invalidatePlan = () => {
    setPreview(null);
    setConfirmText('');
    setErrorMessage(null);
  };

  const handleFileSelected = (selected: File) => {
    if (!hasAllowedExtension(selected.name)) {
      setErrorMessage(t('Only .csv and .xlsx files are accepted.'));
      return;
    }
    invalidatePlan();
    setFile(selected);
  };

  const handleRoleChange = (value: string) => {
    invalidatePlan();
    setRole(value);
  };

  const handlePreview = async () => {
    if (!file || !role) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const data = await importUsers({
        file,
        defaultRole: role,
        dryRun: true,
      });
      setPreview(data);
      setFilter('all');
      setConfirmText('');
      setStep(Step.Preview);
    } catch (err) {
      setErrorMessage(
        err instanceof UserImportError
          ? err.message
          : t('Unexpected error while importing users.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toCreate = preview?.summary.criar ?? 0;
  const canConfirm =
    step === Step.Preview &&
    !!preview?.plan_token &&
    toCreate > 0 &&
    confirmText.trim() === String(toCreate) &&
    !submitting;

  const handleConfirm = async () => {
    if (!file || !role || !preview?.plan_token) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const data = await importUsers({
        file,
        defaultRole: role,
        dryRun: false,
        planToken: preview.plan_token,
      });
      setResult(data);
      setPreview(null);
      setFilter('all');
      setStep(Step.Result);
      const created = data.summary.criado ?? 0;
      if (created === 0) {
        addDangerToast(t('Import finished, but no users were created.'));
      } else if ((data.summary.falha ?? 0) > 0) {
        addWarningToast(
          t(
            'Import finished: %s users created, %s lines failed.',
            created,
            data.summary.falha,
          ),
        );
      } else {
        addSuccessToast(t('Import finished: %s users created.', created));
      }
      onImported?.();
    } catch (err) {
      if (err instanceof UserImportError && err.isPlanInvalid) {
        addDangerToast(err.message);
        invalidatePlan();
        setStep(Step.Upload);
      } else {
        setErrorMessage(
          err instanceof UserImportError
            ? err.message
            : t('Unexpected error while importing users.'),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    invalidatePlan();
    setStep(Step.Upload);
  };

  const handleDownload = () => {
    if (!result) return;
    downloadCsv('users_import_report.csv', buildReportCsv(result.rows));
  };

  const activeData = step === Step.Result ? result : preview;
  const visibleRows = useMemo(() => {
    const rows = activeData?.rows ?? [];
    return filter === 'all' ? rows : rows.filter(r => r.status === filter);
  }, [activeData, filter]);

  const columns: ColumnsType<ImportRow> = useMemo(
    () => [
      { title: t('Line'), dataIndex: 'line', key: 'line', width: 70 },
      { title: t('Username'), dataIndex: 'username', key: 'username' },
      {
        title: t('Email'),
        dataIndex: 'email',
        key: 'email',
        render: (value?: string) => value ?? '',
      },
      {
        title: t('Name'),
        key: 'name',
        render: (_: unknown, row: ImportRow) => fullName(row),
      },
      {
        title: t('Role'),
        dataIndex: 'role',
        key: 'role',
        render: (value?: string) => value ?? '',
      },
      {
        title: t('Status'),
        dataIndex: 'status',
        key: 'status',
        render: (status: RowStatus) => (
          <Tag color={statusTagColor(status)}>{statusLabel(status)}</Tag>
        ),
      },
      {
        title: t('Reason'),
        key: 'reason',
        render: (_: unknown, row: ImportRow) => rowReasonText(row),
      },
    ],
    [],
  );

  const filterOptions: { label: string; value: StatusFilter }[] =
    useMemo(() => {
      const base: { label: string; value: StatusFilter }[] = [
        { label: t('All'), value: 'all' },
      ];
      const statuses: RowStatus[] =
        step === Step.Result
          ? ['criado', 'ja_existe', 'segurada', 'falha']
          : (['criar', 'ja_existe', 'segurada'] as PlanStatus[]);
      return [
        ...base,
        ...statuses.map(s => ({ label: statusLabel(s), value: s })),
      ];
    }, [step]);

  const renderCounters = (data: ImportResult) => {
    const { summary } = data;
    const items: { key: string; label: string; value: number }[] =
      step === Step.Result
        ? [
            { key: 'total', label: t('Total'), value: summary.total },
            {
              key: 'criado',
              label: statusLabel('criado'),
              value: summary.criado ?? 0,
            },
            {
              key: 'ja_existe',
              label: statusLabel('ja_existe'),
              value: summary.ja_existe,
            },
            {
              key: 'segurada',
              label: statusLabel('segurada'),
              value: summary.segurada,
            },
            { key: 'falha', label: statusLabel('falha'), value: summary.falha },
          ]
        : [
            { key: 'total', label: t('Total'), value: summary.total },
            {
              key: 'criar',
              label: statusLabel('criar'),
              value: summary.criar ?? 0,
            },
            {
              key: 'ja_existe',
              label: statusLabel('ja_existe'),
              value: summary.ja_existe,
            },
            {
              key: 'segurada',
              label: statusLabel('segurada'),
              value: summary.segurada,
            },
          ];
    return (
      <div
        data-test="import-users-counters"
        css={css`
          display: flex;
          gap: ${theme.sizeUnit * 4}px;
          flex-wrap: wrap;
          margin-bottom: ${theme.sizeUnit * 3}px;
        `}
      >
        {items.map(item => (
          <span key={item.key} data-test={`import-users-count-${item.key}`}>
            {item.label}: <strong>{item.value}</strong>
          </span>
        ))}
      </div>
    );
  };

  const renderRowsTable = () => (
    <>
      <div
        css={css`
          margin-bottom: ${theme.sizeUnit * 3}px;
        `}
      >
        <Radio.GroupWrapper
          data-test="import-users-status-filter"
          optionType="button"
          size="small"
          value={filter}
          onChange={e => setFilter(e.target.value as StatusFilter)}
          options={filterOptions}
        />
      </div>
      <Table<ImportRow>
        data-test="import-users-table"
        columns={columns}
        data={visibleRows}
        rowKey="line"
        size={TableSize.Small}
        defaultPageSize={10}
        pageSizeOptions={['10', '25', '50']}
      />
    </>
  );

  const renderUploadStep = () => (
    <div data-test="import-users-step-upload">
      <p>
        {t(
          'Upload a CSV or XLSX file with the columns NAME, USERNAME, PASSWORD and EMAIL. Nothing is created until you review the preview.',
        )}
      </p>
      <div
        css={css`
          margin-bottom: ${theme.sizeUnit * 4}px;
        `}
      >
        <Upload
          name="usersFile"
          data-test="import-users-file-input"
          accept={USER_IMPORT_ACCEPT}
          maxCount={1}
          disabled={submitting}
          fileList={
            file
              ? [{ uid: 'import-file', name: file.name, status: 'done' }]
              : []
          }
          beforeUpload={selected => {
            handleFileSelected(selected);
            return false;
          }}
          onRemove={() => {
            invalidatePlan();
            setFile(null);
          }}
        >
          <Button icon={<Icons.UploadOutlined />}>{t('Select file')}</Button>
        </Upload>
      </div>
      <div>
        <div
          css={css`
            margin-bottom: ${theme.sizeUnit}px;
          `}
        >
          {t('Default role')}
        </div>
        <Select
          ariaLabel={t('Default role')}
          data-test="import-users-role-select"
          placeholder={t('Select a role')}
          loading={loadingRoles}
          disabled={submitting}
          value={role}
          onChange={value => handleRoleChange(value as string)}
          options={roles.map(r => ({ label: r.name, value: r.name }))}
          css={css`
            width: 100%;
          `}
        />
      </div>
      {errorMessage && (
        <Alert
          type="error"
          showIcon
          data-test="import-users-error"
          message={errorMessage}
          css={css`
            margin-top: ${theme.sizeUnit * 4}px;
          `}
        />
      )}
    </div>
  );

  const renderPreviewStep = () =>
    preview && (
      <div data-test="import-users-step-preview">
        {renderCounters(preview)}
        {(preview.warnings ?? []).map(warning => (
          <Alert
            key={warning}
            type="warning"
            showIcon
            message={warningLabel(warning)}
            css={css`
              margin-bottom: ${theme.sizeUnit * 3}px;
            `}
          />
        ))}
        <Alert
          type="info"
          showIcon
          message={t(
            'Lines marked as existing or held will not be changed. Held lines need to be fixed in the file and imported again.',
          )}
          css={css`
            margin-bottom: ${theme.sizeUnit * 3}px;
          `}
        />
        {renderRowsTable()}
        <div
          css={css`
            margin-top: ${theme.sizeUnit * 4}px;
          `}
        >
          <div
            css={css`
              margin-bottom: ${theme.sizeUnit}px;
            `}
          >
            {t(
              'To confirm, type the number of users that will be created (%s)',
              toCreate,
            )}
          </div>
          <Input
            data-test="import-users-confirm-input"
            aria-label={t('Number of users to create')}
            value={confirmText}
            disabled={toCreate === 0}
            onChange={e => setConfirmText(e.target.value)}
          />
        </div>
        {errorMessage && (
          <Alert
            type="error"
            showIcon
            data-test="import-users-error"
            message={errorMessage}
            css={css`
              margin-top: ${theme.sizeUnit * 4}px;
            `}
          />
        )}
      </div>
    );

  const renderResultStep = () =>
    result && (
      <div data-test="import-users-step-result">
        {renderCounters(result)}
        {renderRowsTable()}
      </div>
    );

  const footer = (() => {
    if (step === Step.Upload) {
      return (
        <>
          <Button onClick={handleHide} data-test="import-users-cancel">
            {t('Cancel')}
          </Button>
          <Button
            buttonStyle="primary"
            disabled={!file || !role || submitting}
            loading={submitting}
            onClick={handlePreview}
            data-test="import-users-preview-button"
          >
            {t('Preview')}
          </Button>
        </>
      );
    }
    if (step === Step.Preview) {
      return (
        <>
          <Button onClick={handleBack} data-test="import-users-back">
            {t('Back')}
          </Button>
          <Button
            buttonStyle="primary"
            disabled={!canConfirm}
            loading={submitting}
            onClick={handleConfirm}
            data-test="import-users-confirm-button"
          >
            {t('Confirm')}
          </Button>
        </>
      );
    }
    return (
      <>
        <Button onClick={handleDownload} data-test="import-users-download">
          {t('Download report (CSV)')}
        </Button>
        <Button
          buttonStyle="primary"
          onClick={handleHide}
          data-test="import-users-close"
        >
          {t('Close')}
        </Button>
      </>
    );
  })();

  return (
    <Modal
      show={show}
      onHide={handleHide}
      name="import-users"
      title={
        <ModalTitleWithIcon
          icon={<Icons.UploadOutlined />}
          title={t('Import users')}
        />
      }
      width="900px"
      maskClosable={false}
      destroyOnHidden
      footer={footer}
    >
      {step === Step.Upload && renderUploadStep()}
      {step === Step.Preview && renderPreviewStep()}
      {step === Step.Result && renderResultStep()}
    </Modal>
  );
}
