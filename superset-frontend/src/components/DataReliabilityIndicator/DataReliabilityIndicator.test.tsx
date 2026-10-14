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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { DataReliabilityIndicator } from '.';

const TEST_MESSAGE = 'This data is refreshed daily from the main database.';

test('DataReliabilityIndicator renders info icon', () => {
  render(<DataReliabilityIndicator message={TEST_MESSAGE} />);
  const icon = screen.getByLabelText('Data Reliability Information');
  expect(icon).toBeInTheDocument();
});

test('DataReliabilityIndicator shows tooltip on hover with title and message', async () => {
  render(<DataReliabilityIndicator message={TEST_MESSAGE} />);
  const icon = screen.getByLabelText('Data Reliability Information');

  userEvent.hover(icon);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent('Data Reliability');
  expect(tooltip).toHaveTextContent(TEST_MESSAGE);
});

test('DataReliabilityIndicator preserves whitespace in message', async () => {
  const multilineMessage = 'Line 1\nLine 2\nLine 3';
  render(<DataReliabilityIndicator message={multilineMessage} />);
  const icon = screen.getByLabelText('Data Reliability Information');

  userEvent.hover(icon);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent('Line 1');
  expect(tooltip).toHaveTextContent('Line 2');
  expect(tooltip).toHaveTextContent('Line 3');
});

test('DataReliabilityIndicator renders with empty message', () => {
  render(<DataReliabilityIndicator message="" />);
  const icon = screen.getByLabelText('Data Reliability Information');
  expect(icon).toBeInTheDocument();
});

test('DataReliabilityIndicator supports warning icon type', () => {
  render(
    <DataReliabilityIndicator message={TEST_MESSAGE} iconType="warning" />,
  );
  const icon = screen.getByLabelText('Data Reliability Information');
  expect(icon).toBeInTheDocument();
});
