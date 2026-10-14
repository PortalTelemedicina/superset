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

import cls from 'classnames';
import { Spin } from 'antd';
import { t } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
import type { LoadingProps, SizeOption } from './types';

const SIZE_MAP: Record<SizeOption, string> = {
  s: '40px',
  m: '70px',
  l: '100px',
};

const LoaderWrapper = styled.div<{
  $spinnerWidth: string;
  $spinnerHeight: string;
  $opacity: number;
}>`
  z-index: 99;
  width: ${({ $spinnerWidth }) => $spinnerWidth};
  height: ${({ $spinnerHeight }) => $spinnerHeight};
  opacity: ${({ $opacity }) => $opacity};
  position: relative;
  margin: 0;
  padding: 0;

  & > svg,
  & > img {
    width: 100%;
    height: 100%;
  }

  &.inline-centered {
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  &.floating {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
`;

const SpinWrapper = styled.div`
  z-index: 99;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 10px;
  &.inline {
    margin: 0;
  }
  &.inline-centered {
    margin: 0 auto;
  }
  &.floating {
    margin: 0;
    padding: 0;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
`;

export function Loading({
  position = 'floating',
  image,
  className,
  size = 'm',
  muted = false,
}: LoadingProps) {
  const theme = useTheme();

  // Spinner do antd no lugar do logo animado, exceto quando há imagem
  // explícita ou spinner de marca configurado no tema.
  const customImage =
    image ||
    (theme.brandSpinnerSvg
      ? `data:image/svg+xml;base64,${btoa(theme.brandSpinnerSvg)}`
      : theme.brandSpinnerUrl);

  if (!customImage) {
    const isInline = position === 'inline' || position === 'inline-centered';
    return (
      <SpinWrapper
        className={cls('loading', position, className)}
        role="status"
        aria-live="polite"
        aria-label={t('Loading')}
        data-test="loading-indicator"
      >
        <Spin size={isInline ? 'small' : 'default'} />
      </SpinWrapper>
    );
  }

  const spinnerSize = SIZE_MAP[size];
  const opacity = muted ? 0.25 : 1.0;

  return (
    <LoaderWrapper
      $spinnerWidth={spinnerSize}
      $spinnerHeight="auto"
      $opacity={opacity}
      className={cls('loading', position, className)}
      role="status"
      aria-live="polite"
      aria-label={t('Loading')}
      data-test="loading-indicator"
    >
      <img src={customImage} alt={`${t('Loading')}...`} />
    </LoaderWrapper>
  );
}

export type { LoadingProps };
