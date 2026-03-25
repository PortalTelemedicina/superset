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
/**
 * Split from control.test.ts: running these after Datasource/VizType tests in the same
 * spec caused Chromium renderer OOM on CI (matrix shard 5). A separate file starts a
 * fresh browser process per cypress_run.py invocation.
 */
import { interceptChart } from 'cypress/utils';

describe('Test datatable', () => {
  beforeEach(() => {
    interceptChart({ legacy: false }).as('tableChartData');
    interceptChart({ legacy: false }).as('lineChartData');
    cy.visitChartByName('Daily Totals');
  });
  it('Data Pane opens and loads results', () => {
    cy.contains('Results').click();
    cy.get('[data-test="row-count-label"]').contains('26 rows');
    cy.get('.ant-empty-description').should('not.exist');
  });
  it('Datapane loads view samples', () => {
    cy.intercept(
      '**/datasource/samples?force=false&datasource_type=table&datasource_id=*',
    ).as('Samples');
    cy.contains('Samples').click();
    cy.wait('@Samples');
    cy.get('.ant-tabs-tab-active').contains('Samples');
    cy.get('[data-test="row-count-label"]').contains('1k rows');
    cy.get('.ant-empty-description').should('not.exist');
  });
});
