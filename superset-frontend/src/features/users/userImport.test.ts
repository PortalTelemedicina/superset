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
import fetchMock from 'fetch-mock';
import {
  CSV_BOM,
  ImportRow,
  USER_IMPORT_ENDPOINT,
  UserImportError,
  buildReportCsv,
  importUsers,
  reasonLabel,
  rowReasonText,
  sanitizeCsvCell,
} from './userImport';

const importUrl = `glob:*${USER_IMPORT_ENDPOINT}`;

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

const row = (overrides: Partial<ImportRow>): ImportRow => ({
  line: 2,
  username: '01234567890',
  status: 'criado',
  reason: null,
  ...overrides,
});

test('sanitizeCsvCell prefixa valores que começam como fórmula', () => {
  expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
  expect(sanitizeCsvCell('+55')).toBe("'+55");
  expect(sanitizeCsvCell('-10')).toBe("'-10");
  expect(sanitizeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  expect(sanitizeCsvCell('\t=1')).toBe("'\t=1");
  expect(sanitizeCsvCell('\r=1')).toBe("'\r=1");
  expect(sanitizeCsvCell('  =1')).toBe("'  =1");
});

test('sanitizeCsvCell não altera texto comum nem zeros à esquerda', () => {
  expect(sanitizeCsvCell('01234567890')).toBe('01234567890');
  expect(sanitizeCsvCell('maria@x.com')).toBe('maria@x.com');
  expect(sanitizeCsvCell('')).toBe('');
});

test('buildReportCsv tem BOM, CRLF, aspas e preserva zeros do username', () => {
  const csv = buildReportCsv([
    row({}),
    row({
      line: 5,
      username: '11122233344',
      status: 'falha',
      reason: 'erro_criacao',
    }),
  ]);
  expect(csv.startsWith(CSV_BOM)).toBe(true);
  const lines = csv.slice(CSV_BOM.length).split('\r\n');
  expect(lines[0]).toBe('"Line","Username","Status","Reason code","Reason"');
  expect(lines[1]).toContain('"01234567890"');
  expect(lines[2]).toContain('"erro_criacao"');
  expect(lines[3]).toBe('');
});

test('buildReportCsv sanitiza injeção e escapa aspas', () => {
  const csv = buildReportCsv([
    row({ username: '=cmd|calc', reason: 'email_invalido' }),
    row({ line: 3, username: 'a"b' }),
  ]);
  expect(csv).toContain('"\'=cmd|calc"');
  expect(csv).toContain('"a""b"');
});

test('buildReportCsv não tem coluna nem valor de senha', () => {
  const csv = buildReportCsv([
    // um campo de senha inesperado vindo do servidor não pode vazar
    { ...row({}), password: 'Segredo123' } as ImportRow,
  ]);
  expect(csv.toLowerCase()).not.toContain('senha');
  expect(csv.toLowerCase()).not.toContain('password,');
  expect(csv).not.toContain('Segredo123');
});

test('reasonLabel traduz todos os códigos do contrato', () => {
  const codes = [
    'duplicado_no_arquivo_username',
    'duplicado_no_arquivo_email',
    'existe_username',
    'existe_sem_zero_a_esquerda',
    'existe_email',
    'existe_inativo',
    'conflito_com_varios_existentes',
    'email_invalido',
    'senha_invalida',
    'role_invalida',
    'role_nao_permitida',
    'nome_incompleto',
    'username_invalido',
    'celula_muito_longa',
    'nome_muito_longo',
    'erro_criacao',
  ];
  codes.forEach(code => {
    expect(reasonLabel(code)).not.toBe('');
    expect(reasonLabel(code)).not.toContain('Unrecognized');
  });
  expect(reasonLabel('campo_obrigatorio:email')).toBe(
    'Required field is empty: Email',
  );
  expect(reasonLabel('campo_obrigatorio:usuario')).toBe(
    'Required field is empty: Username',
  );
  expect(reasonLabel('campo_obrigatorio:nome')).toBe(
    'Required field is empty: Name',
  );
  expect(reasonLabel(null)).toBe('');
  expect(reasonLabel('codigo_novo')).toContain('codigo_novo');
});

test('rowReasonText inclui existente, linhas relacionadas e aviso de senha', () => {
  const text = rowReasonText(
    row({
      status: 'segurada',
      reason: 'duplicado_no_arquivo_username',
      related_lines: [7, 12],
      existing_username: '0123',
      senha_normalizada: true,
    }),
  );
  expect(text).toContain('Existing username: 0123');
  expect(text).toContain('Lines: 7, 12');
  expect(text).toContain('accents removed');
});

test('importUsers envia multipart com file, default_role e dry_run', async () => {
  fetchMock.post(importUrl, {
    result: {
      dry_run: true,
      plan_token: 'tok',
      summary: { total: 1, criar: 1, ja_existe: 0, segurada: 0, falha: 0 },
      rows: [],
    },
  });
  const file = new File(['a'], 'u.csv', { type: 'text/csv' });
  const result = await importUsers({
    file,
    defaultRole: 'Gamma',
    dryRun: true,
  });
  expect(result.plan_token).toBe('tok');
  const body = fetchMock.callHistory.lastCall(importUrl)?.options
    .body as FormData;
  expect(body).toBeInstanceOf(FormData);
  expect(body.get('default_role')).toBe('Gamma');
  expect(body.get('dry_run')).toBe('true');
  expect(body.get('plan_token')).toBeNull();
  expect((body.get('file') as File).name).toBe('u.csv');
});

test('importUsers envia plan_token no commit', async () => {
  fetchMock.post(importUrl, {
    result: {
      dry_run: false,
      summary: { total: 0, criado: 0, ja_existe: 0, segurada: 0, falha: 0 },
      rows: [],
    },
  });
  await importUsers({
    file: new File(['a'], 'u.csv'),
    defaultRole: 'Gamma',
    dryRun: false,
    planToken: 'tok',
  });
  const body = fetchMock.callHistory.lastCall(importUrl)?.options
    .body as FormData;
  expect(body.get('dry_run')).toBe('false');
  expect(body.get('plan_token')).toBe('tok');
});

test.each([401, 403, 404, 409, 413, 422, 429])(
  'importUsers converte HTTP %s em UserImportError',
  async status => {
    fetchMock.post(importUrl, { status, body: { message: 'x' } });
    const promise = importUsers({
      file: new File(['a'], 'u.csv'),
      defaultRole: 'Gamma',
      dryRun: true,
    });
    await expect(promise).rejects.toBeInstanceOf(UserImportError);
    await expect(promise).rejects.toMatchObject({ status });
  },
);

test('importUsers 400 lista as colunas ausentes', async () => {
  fetchMock.post(importUrl, {
    status: 400,
    body: { message: 'm', missing_columns: ['EMAIL', 'SENHA'] },
  });
  await expect(
    importUsers({
      file: new File(['a'], 'u.csv'),
      defaultRole: 'Gamma',
      dryRun: true,
    }),
  ).rejects.toMatchObject({
    status: 400,
    missingColumns: ['EMAIL', 'SENHA'],
    message: expect.stringContaining('EMAIL, SENHA'),
  });
});

test('importUsers 409 marca o plano como inválido', async () => {
  fetchMock.post(importUrl, { status: 409, body: { message: 'x' } });
  await expect(
    importUsers({
      file: new File(['a'], 'u.csv'),
      defaultRole: 'Gamma',
      dryRun: false,
      planToken: 'old',
    }),
  ).rejects.toMatchObject({ isPlanInvalid: true });
});
