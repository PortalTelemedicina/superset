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
  fireEvent,
  render,
  screen,
  selectOption,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import UserImportModal from './UserImportModal';
import * as userImport from './userImport';

const mockAddDangerToast = jest.fn();
const mockAddSuccessToast = jest.fn();
const mockAddWarningToast = jest.fn();

jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addDangerToast: mockAddDangerToast,
    addSuccessToast: mockAddSuccessToast,
    addWarningToast: mockAddWarningToast,
  }),
}));

const importUrl = `glob:*${userImport.USER_IMPORT_ENDPOINT}`;
const rolesUrl = 'glob:*/api/v1/security/roles/?*';

const previewResponse = {
  result: {
    dry_run: true,
    plan_token: 'token-1',
    expires_in: 900,
    default_role: 'Gamma',
    summary: { total: 4, criar: 2, ja_existe: 1, segurada: 1, falha: 0 },
    warnings: ['username_numerico_xlsx'],
    rows: [
      {
        line: 2,
        username: '01234567890',
        email: 'maria@x.com',
        first_name: 'Maria',
        last_name: 'da Silva',
        role: 'Gamma',
        status: 'criar',
        reason: null,
        senha_normalizada: true,
      },
      {
        line: 3,
        username: '1234567890',
        status: 'ja_existe',
        reason: 'existe_sem_zero_a_esquerda',
        existing_username: '01234567890',
      },
      {
        line: 4,
        username: '22233344455',
        email: 'jose@x.com',
        first_name: 'Jose',
        last_name: 'Lima',
        role: 'Gamma',
        status: 'criar',
        reason: null,
      },
      {
        line: 7,
        username: '09876543210',
        status: 'segurada',
        reason: 'duplicado_no_arquivo_username',
        related_lines: [7, 12],
      },
    ],
  },
};

const commitResponse = {
  result: {
    dry_run: false,
    audit_id: 'abc',
    summary: { total: 4, criado: 2, ja_existe: 1, segurada: 1, falha: 0 },
    rows: [
      { line: 2, username: '01234567890', status: 'criado', reason: null },
      { line: 4, username: '22233344455', status: 'criado', reason: null },
    ],
  },
};

const onHide = jest.fn();
const onImported = jest.fn();

function setup() {
  return render(
    <UserImportModal show onHide={onHide} onImported={onImported} />,
    { useRedux: true },
  );
}

async function pickFile(name = 'users.csv') {
  const file = new File(['NOME,USUARIO'], name, { type: 'text/csv' });
  fireEvent.change(screen.getByTestId('import-users-file-input'), {
    target: { files: [file] },
  });
  await screen.findByText(name);
  return file;
}

async function goToPreview() {
  setup();
  await pickFile();
  await selectOption('Gamma');
  fireEvent.click(screen.getByTestId('import-users-preview-button'));
  await screen.findByTestId('import-users-step-preview');
}

const mockImport = (response: object) => {
  fetchMock.removeRoutes({ names: ['import'] });
  fetchMock.post(importUrl, response, { name: 'import' });
};

const lastBody = () =>
  fetchMock.callHistory.lastCall(importUrl)?.options.body as FormData;

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  fetchMock.get(rolesUrl, {
    count: 3,
    result: [
      { id: 1, name: 'Admin' },
      { id: 2, name: 'Gamma' },
      { id: 3, name: 'Alpha' },
      { id: 4, name: 'admin' },
    ],
  });
  mockImport(previewResponse);
  mockAddDangerToast.mockClear();
  mockAddSuccessToast.mockClear();
  mockAddWarningToast.mockClear();
  onHide.mockClear();
  onImported.mockClear();
});

test('o botão de pré-visualizar começa desabilitado', async () => {
  setup();
  expect(screen.getByTestId('import-users-preview-button')).toBeDisabled();
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(rolesUrl).length).toBeGreaterThan(0),
  );
});

test('a role não vem pré-selecionada e Admin não aparece na lista', async () => {
  setup();
  await pickFile();
  // só o arquivo não basta: falta a role
  expect(screen.getByTestId('import-users-preview-button')).toBeDisabled();
  await userEvent.click(screen.getByRole('combobox'));
  await screen.findByText('Alpha');
  expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  // a comparação não diferencia caixa
  expect(screen.queryByText('admin')).not.toBeInTheDocument();
});

test('extensão inválida é recusada sem selecionar o arquivo', async () => {
  setup();
  fireEvent.change(screen.getByTestId('import-users-file-input'), {
    target: { files: [new File(['x'], 'users.txt')] },
  });
  expect(await screen.findByTestId('import-users-error')).toBeInTheDocument();
  expect(screen.queryByText('users.txt')).not.toBeInTheDocument();
});

test('o upload dispara o dry-run com file, default_role e dry_run=true', async () => {
  await goToPreview();
  const body = lastBody();
  expect(body.get('default_role')).toBe('Gamma');
  expect(body.get('dry_run')).toBe('true');
  expect(body.get('plan_token')).toBeNull();
  expect((body.get('file') as File).name).toBe('users.csv');
});

test('a pré-visualização mostra contadores, status, motivos e aviso do XLSX', async () => {
  await goToPreview();
  expect(screen.getByTestId('import-users-count-criar')).toHaveTextContent('2');
  expect(screen.getByTestId('import-users-count-segurada')).toHaveTextContent(
    '1',
  );
  expect(
    screen.getByText(/differs only by leading zeros/i),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Same username on more than one line/i),
  ).toBeInTheDocument();
  expect(screen.getByText(/Numeric usernames in XLSX/i)).toBeInTheDocument();
  expect(screen.getByText('Maria da Silva')).toBeInTheDocument();
});

test('o filtro por status esconde as outras linhas', async () => {
  await goToPreview();
  fireEvent.click(screen.getByLabelText('Held'));
  expect(screen.getByText('09876543210')).toBeInTheDocument();
  expect(screen.queryByText('22233344455')).not.toBeInTheDocument();
});

test('Confirmar só habilita ao digitar o número de usuários a criar', async () => {
  await goToPreview();
  const confirm = screen.getByTestId('import-users-confirm-button');
  expect(confirm).toBeDisabled();
  const input = screen.getByTestId('import-users-confirm-input');
  await userEvent.type(input, '3');
  expect(confirm).toBeDisabled();
  await userEvent.clear(input);
  await userEvent.type(input, '2');
  expect(confirm).toBeEnabled();
});

test('sem linhas para criar o Confirmar fica desabilitado', async () => {
  mockImport({
    result: {
      ...previewResponse.result,
      summary: { total: 1, criar: 0, ja_existe: 1, segurada: 0, falha: 0 },
      rows: [previewResponse.result.rows[1]],
    },
  });
  await goToPreview();
  expect(screen.getByTestId('import-users-confirm-input')).toBeDisabled();
  expect(screen.getByTestId('import-users-confirm-button')).toBeDisabled();
});

test('o commit envia dry_run=false com plan_token e mostra o relatório', async () => {
  await goToPreview();
  mockImport(commitResponse);
  await userEvent.type(screen.getByTestId('import-users-confirm-input'), '2');
  fireEvent.click(screen.getByTestId('import-users-confirm-button'));
  await screen.findByTestId('import-users-step-result');
  const body = lastBody();
  expect(body.get('dry_run')).toBe('false');
  expect(body.get('plan_token')).toBe('token-1');
  expect(screen.getByTestId('import-users-count-criado')).toHaveTextContent(
    '2',
  );
  expect(onImported).toHaveBeenCalledTimes(1);
});

test('commit sem nenhum usuário criado avisa com toast de erro, não de sucesso', async () => {
  await goToPreview();
  mockImport({
    result: {
      ...commitResponse.result,
      summary: { total: 2, criado: 0, ja_existe: 0, segurada: 0, falha: 2 },
      rows: [
        {
          line: 2,
          username: '01234567890',
          status: 'falha',
          reason: 'erro_criacao',
        },
        {
          line: 4,
          username: '22233344455',
          status: 'falha',
          reason: 'erro_criacao',
        },
      ],
    },
  });
  await userEvent.type(screen.getByTestId('import-users-confirm-input'), '2');
  fireEvent.click(screen.getByTestId('import-users-confirm-button'));
  await screen.findByTestId('import-users-step-result');
  expect(mockAddSuccessToast).not.toHaveBeenCalled();
  expect(mockAddDangerToast).toHaveBeenCalledTimes(1);
});

test('commit com criação parcial avisa com toast de alerta', async () => {
  await goToPreview();
  mockImport({
    result: {
      ...commitResponse.result,
      summary: { total: 2, criado: 1, ja_existe: 0, segurada: 0, falha: 1 },
    },
  });
  await userEvent.type(screen.getByTestId('import-users-confirm-input'), '2');
  fireEvent.click(screen.getByTestId('import-users-confirm-button'));
  await screen.findByTestId('import-users-step-result');
  expect(mockAddSuccessToast).not.toHaveBeenCalled();
  expect(mockAddWarningToast).toHaveBeenCalledTimes(1);
});

test('a role e o arquivo ficam travados enquanto o dry-run está em andamento', async () => {
  let release: (value: unknown) => void = () => undefined;
  fetchMock.removeRoutes({ names: ['import'] });
  fetchMock.post(
    importUrl,
    new Promise(resolve => {
      release = resolve;
    }),
    { name: 'import' },
  );
  setup();
  await pickFile();
  await selectOption('Gamma');
  fireEvent.click(screen.getByTestId('import-users-preview-button'));
  await waitFor(() => expect(screen.getByRole('combobox')).toBeDisabled());
  expect(
    screen.getByTestId('import-users-file-input').closest('input'),
  ).toBeDisabled();
  release(previewResponse);
  await screen.findByTestId('import-users-step-preview');
});

test('role fora da allowlist do servidor mostra a mensagem do 400 no passo 1', async () => {
  mockImport({
    status: 400,
    body: {
      message: 'The default role is not allowed',
      reason: 'role_nao_permitida',
    },
  });
  setup();
  await pickFile();
  await selectOption('Alpha');
  fireEvent.click(screen.getByTestId('import-users-preview-button'));
  const alert = await screen.findByTestId('import-users-error');
  expect(alert).toHaveTextContent('The default role is not allowed');
  expect(screen.getByTestId('import-users-step-upload')).toBeInTheDocument();
});

test('o relatório baixa um CSV sem senha', async () => {
  const downloadSpy = jest
    .spyOn(userImport, 'downloadCsv')
    .mockImplementation(() => undefined);
  await goToPreview();
  mockImport(commitResponse);
  await userEvent.type(screen.getByTestId('import-users-confirm-input'), '2');
  fireEvent.click(screen.getByTestId('import-users-confirm-button'));
  await screen.findByTestId('import-users-step-result');
  fireEvent.click(screen.getByTestId('import-users-download'));
  expect(downloadSpy).toHaveBeenCalledTimes(1);
  const [[filename, content]] = downloadSpy.mock.calls;
  expect(filename).toMatch(/\.csv$/);
  expect(content.startsWith(userImport.CSV_BOM)).toBe(true);
  expect(content).toContain('"01234567890"');
  downloadSpy.mockRestore();
});

test('409 no commit volta ao passo 1 com toast e descarta o plano', async () => {
  await goToPreview();
  mockImport({ status: 409, body: { message: 'x' } });
  await userEvent.type(screen.getByTestId('import-users-confirm-input'), '2');
  fireEvent.click(screen.getByTestId('import-users-confirm-button'));
  await screen.findByTestId('import-users-step-upload');
  expect(mockAddDangerToast).toHaveBeenCalledTimes(1);
  expect(onImported).not.toHaveBeenCalled();
});

test.each([
  [403, /permission/i],
  [413, /larger than the allowed limit/i],
  [422, /could not be read/i],
  [429, /Too many requests/i],
])('erro %s no dry-run mostra a mensagem no passo 1', async (status, text) => {
  mockImport({ status, body: {} });
  setup();
  await pickFile();
  await selectOption('Gamma');
  fireEvent.click(screen.getByTestId('import-users-preview-button'));
  const alert = await screen.findByTestId('import-users-error');
  expect(alert).toHaveTextContent(text);
  expect(screen.getByTestId('import-users-step-upload')).toBeInTheDocument();
});

test('voltar e trocar a role exige novo dry-run antes do commit', async () => {
  await goToPreview();
  await userEvent.type(screen.getByTestId('import-users-confirm-input'), '2');
  fireEvent.click(screen.getByTestId('import-users-back'));
  await screen.findByTestId('import-users-step-upload');
  await selectOption('Alpha');
  expect(screen.queryByTestId('import-users-confirm-button')).toBeNull();
  mockImport({
    result: { ...previewResponse.result, plan_token: 'token-2' },
  });
  fireEvent.click(screen.getByTestId('import-users-preview-button'));
  await screen.findByTestId('import-users-step-preview');
  expect(lastBody().get('default_role')).toBe('Alpha');
  // a confirmação digitada não sobrevive à troca
  expect(screen.getByTestId('import-users-confirm-input')).toHaveValue('');
  expect(screen.getByTestId('import-users-confirm-button')).toBeDisabled();
});

test('fechar o modal limpa o estado e chama onHide', async () => {
  await goToPreview();
  fireEvent.click(screen.getByTestId('import-users-back'));
  await screen.findByTestId('import-users-step-upload');
  fireEvent.click(screen.getByTestId('import-users-cancel'));
  expect(onHide).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('users.csv')).not.toBeInTheDocument();
  expect(screen.getByTestId('import-users-preview-button')).toBeDisabled();
});
