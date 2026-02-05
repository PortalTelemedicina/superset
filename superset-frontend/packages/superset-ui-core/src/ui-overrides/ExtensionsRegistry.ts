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
import React from 'react';
import { TypedRegistry } from '../models';
import { makeSingleton } from '../utils';
import type {
  Extensions,
  DashboardCssTransformArgs,
  SliceHeaderControlsTriggerArgs,
  SliceHeaderControlsClassNamesResult,
} from './types';

/**
 * A registry containing extensions which can alter Superset's UI at specific points defined by Superset.
 * See SIP-87: https://github.com/apache/superset/issues/20615
 */
class ExtensionsRegistry extends TypedRegistry<Extensions> {
  name = 'ExtensionsRegistry';

  set<K extends keyof Extensions>(key: K, value: Extensions[K]) {
    const guarded = guardExtensionOverride(key, value);
    if (guarded === null) {
      return;
    }
    super.set(key, guarded as Extensions[K]);
  }
}

export const getExtensionsRegistry = makeSingleton(ExtensionsRegistry, {});

type ValidatorResult<T> = T | null;

function validateHeaderReplacement(
  value: Extensions['dashboard.header.replacement'],
): ValidatorResult<Extensions['dashboard.header.replacement']> {
  if (value == null) return value;
  if (typeof value !== 'function') {
    console.error(
      '[ExtensionsRegistry] dashboard.header.replacement must be a component',
    );
    return null;
  }
  return value;
}

function validateSliceHeaderControlsTrigger(
  value: Extensions['dashboard.sliceHeaderControls.trigger'],
): ValidatorResult<Extensions['dashboard.sliceHeaderControls.trigger']> {
  if (value == null) return value;
  if (typeof value !== 'function') {
    console.error(
      '[ExtensionsRegistry] dashboard.sliceHeaderControls.trigger must be a function',
    );
    return null;
  }
  const trigger = value;
  return ((args: SliceHeaderControlsTriggerArgs) => {
    const result = trigger(args);
    if (
      result == null ||
      typeof result === 'string' ||
      typeof result === 'number' ||
      typeof result === 'boolean' ||
      React.isValidElement(result)
    ) {
      return result;
    }
    console.error(
      '[ExtensionsRegistry] dashboard.sliceHeaderControls.trigger must return a ReactNode',
    );
    return null;
  }) as Extensions['dashboard.sliceHeaderControls.trigger'];
}

function validateCssTransform(
  value: Extensions['dashboard.css.transform'],
): ValidatorResult<Extensions['dashboard.css.transform']> {
  if (value == null) return value;
  if (typeof value !== 'function') {
    console.error(
      '[ExtensionsRegistry] dashboard.css.transform must be a function',
    );
    return null;
  }
  const transform = value;
  return ((args: DashboardCssTransformArgs) => {
    const result = transform(args);
    if (typeof result === 'string') {
      return result;
    }
    console.error(
      '[ExtensionsRegistry] dashboard.css.transform must return a string',
    );
    return args.css ?? '';
  }) as Extensions['dashboard.css.transform'];
}

function validateComponent(
  value: unknown,
  key: string,
): unknown | null {
  if (value == null) return value;
  if (typeof value !== 'function') {
    console.error(`[ExtensionsRegistry] ${key} must be a component`);
    return null;
  }
  return value;
}

function validateSliceHeaderControlsClassNames(
  value: Extensions['dashboard.sliceHeaderControls.classNames'],
): ValidatorResult<Extensions['dashboard.sliceHeaderControls.classNames']> {
  if (value == null) return value;
  if (typeof value !== 'function') {
    console.error(
      '[ExtensionsRegistry] dashboard.sliceHeaderControls.classNames must be a function',
    );
    return null;
  }
  const classNames = value;
  return ((args: SliceHeaderControlsTriggerArgs) => {
    const result = classNames(args);
    if (
      result &&
      typeof result === 'object' &&
      Object.values(result).every(
        v => v === undefined || typeof v === 'string',
      )
    ) {
      return result as SliceHeaderControlsClassNamesResult;
    }
    console.error(
      '[ExtensionsRegistry] dashboard.sliceHeaderControls.classNames must return string values',
    );
    return {};
  }) as Extensions['dashboard.sliceHeaderControls.classNames'];
}

const validators: Partial<
  Record<keyof Extensions, (value: unknown) => unknown | null>
> = {
  'dashboard.header.replacement': validateHeaderReplacement as (
    value: unknown,
  ) => unknown | null,
  'dashboard.sliceHeaderControls.trigger': validateSliceHeaderControlsTrigger as (
    value: unknown,
  ) => unknown | null,
  'dashboard.css.transform': validateCssTransform as (
    value: unknown,
  ) => unknown | null,
  'dashboard.css.injector': (value: unknown) =>
    validateComponent(value, 'dashboard.css.injector'),
  'dashboard.sliceHeaderControls.classNames':
    validateSliceHeaderControlsClassNames as (value: unknown) => unknown | null,
  'dashboard.sliceHeaderControls.decorator': (value: unknown) =>
    validateComponent(value, 'dashboard.sliceHeaderControls.decorator'),
  'dashboard.chart.dataReliabilityOverlay': (value: unknown) =>
    validateComponent(value, 'dashboard.chart.dataReliabilityOverlay'),
  'explore.chart.dataReliabilityOverlay': (value: unknown) =>
    validateComponent(value, 'explore.chart.dataReliabilityOverlay'),
};

function guardExtensionOverride<K extends keyof Extensions>(
  key: K,
  value: Extensions[K],
): Extensions[K] | null {
  if (value == null) {
    return value;
  }
  const validator = validators[key];
  if (validator) {
    const result = validator(value);
    return result as Extensions[K] | null;
  }
  return value;
}
