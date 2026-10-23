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
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';

export const USER_IMPORT_ENDPOINT = '/api/v1/security/users/import';
export const USER_IMPORT_ACCEPT = '.csv,.xlsx';

export type PlanStatus = 'criar' | 'ja_existe' | 'segurada';
export type RowStatus = PlanStatus | 'criado' | 'falha';

export type ImportRow = {
  line: number;
  username: string;
  status: RowStatus;
  reason: string | null;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  senha_normalizada?: boolean;
  existing_username?: string;
  related_lines?: number[];
  secondary_reasons?: string[];
};

export type ImportSummary = {
  total: number;
  criar?: number;
  criado?: number;
  ja_existe: number;
  segurada: number;
  falha: number;
};

export type ImportResult = {
  dry_run: boolean;
  summary: ImportSummary;
  rows: ImportRow[];
  plan_token?: string;
  expires_in?: number;
  default_role?: string;
  warnings?: string[];
  audit_id?: string;
};

export type ImportUsersParams = {
  file: File;
  defaultRole: string;
  dryRun: boolean;
  planToken?: string;
};

export class UserImportError extends Error {
  status?: number;

  missingColumns: string[];

  constructor(message: string, status?: number, missingColumns: string[] = []) {
    super(message);
    this.name = 'UserImportError';
    this.status = status;
    this.missingColumns = missingColumns;
  }

  /** Token inválido ou expirado: o fluxo precisa voltar ao passo 1. */
  get isPlanInvalid() {
    return this.status === 409;
  }
}

type ErrorBody = { message?: unknown; missing_columns?: unknown };

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];

/**
 * Mensagens por status vêm do front para ficarem traduzidas; o texto do
 * servidor só entra no 400, onde ele diz o que está errado no arquivo.
 */
export function buildImportError(
  status: number | undefined,
  body: ErrorBody | null,
): UserImportError {
  const serverMessage =
    body && typeof body.message === 'string' ? body.message : '';
  const missing = asStringList(body?.missing_columns);
  switch (status) {
    case 400:
      if (missing.length > 0) {
        return new UserImportError(
          t('Required columns missing from the file: %s', missing.join(', ')),
          status,
          missing,
        );
      }
      return new UserImportError(
        serverMessage || t('The file or the selected role is invalid.'),
        status,
      );
    case 401:
      return new UserImportError(
        t('Your session has expired. Sign in again.'),
        status,
      );
    case 403:
      return new UserImportError(
        t('You do not have permission to import users.'),
        status,
      );
    case 404:
      return new UserImportError(
        t('User import is not enabled in this environment.'),
        status,
      );
    case 409:
      return new UserImportError(
        t('The preview is invalid or has expired. Run the preview again.'),
        status,
      );
    case 413:
      return new UserImportError(
        t('The file is larger than the allowed limit.'),
        status,
      );
    case 422:
      return new UserImportError(
        serverMessage ||
          t(
            'The file could not be read: it is empty, unreadable or over the row limit.',
          ),
        status,
      );
    case 429:
      return new UserImportError(
        t('Too many requests. Wait a moment and try again.'),
        status,
      );
    default:
      return new UserImportError(
        t('Unexpected error while importing users.'),
        status,
      );
  }
}

async function readErrorBody(err: unknown): Promise<ErrorBody | null> {
  const response =
    err instanceof Response
      ? err
      : (err as { response?: Response } | null)?.response;
  if (!response || typeof response.json !== 'function') return null;
  try {
    return (await response.clone().json()) as ErrorBody;
  } catch {
    return null;
  }
}

export async function importUsers({
  file,
  defaultRole,
  dryRun,
  planToken,
}: ImportUsersParams): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('default_role', defaultRole);
  formData.append('dry_run', dryRun ? 'true' : 'false');
  if (!dryRun && planToken) {
    formData.append('plan_token', planToken);
  }
  try {
    const response = await SupersetClient.post({
      endpoint: USER_IMPORT_ENDPOINT,
      postPayload: formData,
      parseMethod: 'json',
    });
    return (response.json as { result: ImportResult }).result;
  } catch (err) {
    const response =
      err instanceof Response
        ? err
        : (err as { response?: Response } | null)?.response;
    const status =
      response?.status ?? (err as { status?: number } | null)?.status;
    throw buildImportError(status, await readErrorBody(err));
  }
}

export function statusLabel(status: RowStatus): string {
  switch (status) {
    case 'criar':
      return t('To create');
    case 'criado':
      return t('Created');
    case 'ja_existe':
      return t('Already exists');
    case 'segurada':
      return t('Held');
    case 'falha':
      return t('Failed');
    default:
      return String(status);
  }
}

/** Cor semântica do Tag do antd (resolvida pelo tema, sem cor literal). */
export function statusTagColor(status: RowStatus): string {
  switch (status) {
    case 'criar':
    case 'criado':
      return 'success';
    case 'ja_existe':
      return 'processing';
    case 'segurada':
      return 'warning';
    default:
      return 'error';
  }
}

const REQUIRED_FIELD_PREFIX = 'campo_obrigatorio:';

// O núcleo emite o nome da coluna em português; aqui ele vira rótulo traduzível.
function requiredFieldLabel(field: string): string {
  switch (field) {
    case 'usuario':
      return t('Username');
    case 'nome':
      return t('Name');
    case 'email':
      return t('Email');
    default:
      return field;
  }
}

export function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return '';
  if (reason.startsWith(REQUIRED_FIELD_PREFIX)) {
    return t(
      'Required field is empty: %s',
      requiredFieldLabel(reason.slice(REQUIRED_FIELD_PREFIX.length)),
    );
  }
  switch (reason) {
    case 'duplicado_no_arquivo_username':
      return t('Same username on more than one line of the file');
    case 'duplicado_no_arquivo_email':
      return t('Same email on more than one line of the file');
    case 'existe_username':
      return t('Username already registered');
    case 'existe_sem_zero_a_esquerda':
      return t('Username already registered (differs only by leading zeros)');
    case 'existe_email':
      return t('Email already registered');
    case 'existe_inativo':
      return t('Existing user is inactive; nothing was changed');
    case 'conflito_com_varios_existentes':
      return t('Matches more than one existing user');
    case 'email_invalido':
      return t('Invalid email');
    case 'senha_invalida':
      return t('Invalid password');
    case 'role_invalida':
      return t('Role does not exist');
    case 'role_nao_permitida':
      return t('Role is not allowed');
    case 'nome_incompleto':
      return t('Name must have first and last name');
    case 'username_invalido':
      return t('Invalid username');
    case 'celula_muito_longa':
      return t('A cell exceeds the maximum length');
    case 'nome_muito_longo':
      return t('Name is too long');
    case 'erro_criacao':
      return t('Error while creating the user');
    default:
      return t('Unrecognized reason: %s', reason);
  }
}

export function warningLabel(warning: string): string {
  if (warning === 'username_numerico_xlsx') {
    return t(
      'Numeric usernames in XLSX may have lost leading zeros. Prefer CSV.',
    );
  }
  return t('Warning: %s', warning);
}

/** Texto completo do motivo na linha, com os detalhes que o servidor manda. */
export function rowReasonText(row: ImportRow): string {
  const parts: string[] = [];
  const main = reasonLabel(row.reason);
  if (main) parts.push(main);
  (row.secondary_reasons ?? []).forEach(r => parts.push(reasonLabel(r)));
  if (row.existing_username) {
    parts.push(t('Existing username: %s', row.existing_username));
  }
  if (row.related_lines && row.related_lines.length > 0) {
    parts.push(t('Lines: %s', row.related_lines.join(', ')));
  }
  if (row.senha_normalizada) {
    parts.push(t('Password differs from the file (accents removed)'));
  }
  return parts.join(' | ');
}

/**
 * Neutraliza fórmulas do Excel. O teste de TAB/CR é feito no valor original
 * porque trimStart os remove antes de olhar o primeiro caractere.
 */
export function sanitizeCsvCell(value: string): string {
  const trimmed = value.trimStart();
  if (/^[=+\-@]/.test(trimmed) || /^[\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

const quoteCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

export const CSV_BOM = '﻿';

/**
 * Relatório sem senha, com BOM e CRLF para o Excel. Todas as células vão entre
 * aspas; o Excel ainda pode converter usernames numéricos ao abrir o arquivo.
 */
export function buildReportCsv(rows: ImportRow[]): string {
  const header = [
    t('Line'),
    t('Username'),
    t('Status'),
    t('Reason code'),
    t('Reason'),
  ];
  const lines = [header.map(quoteCsv).join(',')];
  rows.forEach(row => {
    const cells = [
      String(row.line),
      sanitizeCsvCell(String(row.username ?? '')),
      sanitizeCsvCell(statusLabel(row.status)),
      sanitizeCsvCell(row.reason ?? ''),
      sanitizeCsvCell(rowReasonText(row)),
    ];
    lines.push(cells.map(quoteCsv).join(','));
  });
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
