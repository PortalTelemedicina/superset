/* eslint-disable global-require, @typescript-eslint/no-var-requires */
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

jest.mock('src/ptm', () => ({
  applyPTMExtensions: jest.fn(),
}));

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({ common: { feature_flags: {} } })),
}));

beforeEach(() => {
  jest.resetModules();
  const ptm = require('src/ptm');
  ptm.applyPTMExtensions.mockClear();
});

test('does not apply PTM extensions when flag is off', () => {
  const getBootstrapData = require('src/utils/getBootstrapData').default;
  getBootstrapData.mockReturnValue({ common: { feature_flags: {} } });
  const setup = require('src/setup/setupExtensions').default;
  const ptm = require('src/ptm');
  setup();
  expect(ptm.applyPTMExtensions).not.toHaveBeenCalled();
});

test('applies PTM extensions when PTM_EXTENSION_ENABLED is true', () => {
  const getBootstrapData = require('src/utils/getBootstrapData').default;
  getBootstrapData.mockReturnValue({
    common: { feature_flags: { PTM_EXTENSION_ENABLED: true } },
  });
  const setup = require('src/setup/setupExtensions').default;
  const ptm = require('src/ptm');
  setup();
  expect(ptm.applyPTMExtensions).toHaveBeenCalledTimes(1);
});
