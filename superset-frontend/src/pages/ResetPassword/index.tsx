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

import { SupersetClient, styled, t, css } from '@superset-ui/core';
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Typography,
  Icons,
} from '@superset-ui/core/components';
import { useState, useMemo } from 'react';

interface ResetPasswordForm {
  password: string;
  password_confirm: string;
}

const StyledCard = styled(Card)`
  ${({ theme }) => css`
    max-width: 400px;
    width: 100%;
    margin-top: ${theme.marginXL}px;
    background: ${theme.colorBgBase};
    .ant-form-item-label label {
      color: ${theme.colorPrimary};
    }
  `}
`;

export default function ResetPassword() {
  const [form] = Form.useForm<ResetPasswordForm>();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  }, []);

  const onFinish = async (values: ResetPasswordForm) => {
    if (values.password !== values.password_confirm) {
      setError(t('Passwords do not match'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await SupersetClient.post({
        endpoint: '/api/v1/forgot-password/reset',
        jsonPayload: {
          token,
          password: values.password,
          password_confirm: values.password_confirm,
        },
      });
      setSuccess(true);
    } catch (err: unknown) {
      const apiError =
        err &&
        typeof err === 'object' &&
        'json' in err &&
        (err as Record<string, Record<string, string>>).json?.message;
      setError(
        typeof apiError === 'string'
          ? apiError
          : t('An error occurred. Please try again.'),
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Flex
        justify="center"
        align="center"
        css={css`
          width: 100%;
          height: calc(100vh - 200px);
        `}
      >
        <StyledCard title={t('Invalid link')} padded>
          <Typography.Text type="danger">
            {t('This password reset link is invalid or has expired.')}
          </Typography.Text>
          <Button
            type="primary"
            href="/forgot-password/"
            block
            css={css`
              margin-top: 16px;
            `}
          >
            {t('Request a new link')}
          </Button>
        </StyledCard>
      </Flex>
    );
  }

  return (
    <Flex
      justify="center"
      align="center"
      data-test="reset-password-form"
      css={css`
        width: 100%;
        height: calc(100vh - 200px);
      `}
    >
      <StyledCard title={t('Reset password')} padded>
        {success ? (
          <Flex vertical gap="middle">
            <Typography.Text type="success">
              {t('Your password has been reset successfully!')}
            </Typography.Text>
            <Button type="primary" href="/login/" block>
              {t('Go to login')}
            </Button>
          </Flex>
        ) : (
          <Flex vertical gap="middle">
            {error && (
              <Typography.Text type="danger">{error}</Typography.Text>
            )}
            <Form
              layout="vertical"
              requiredMark="optional"
              form={form}
              onFinish={onFinish}
            >
              <Form.Item<ResetPasswordForm>
                label={t('New password:')}
                name="password"
                rules={[
                  { required: true, message: t('Please enter a password') },
                  {
                    min: 8,
                    message: t('Password must be at least 8 characters'),
                  },
                ]}
              >
                <Input.Password
                  autoFocus
                  prefix={<Icons.LockOutlined iconSize="l" />}
                  data-test="password-input"
                />
              </Form.Item>
              <Form.Item<ResetPasswordForm>
                label={t('Confirm password:')}
                name="password_confirm"
                rules={[
                  {
                    required: true,
                    message: t('Please confirm your password'),
                  },
                ]}
              >
                <Input.Password
                  prefix={<Icons.LockOutlined iconSize="l" />}
                  data-test="password-confirm-input"
                />
              </Form.Item>
              <Form.Item label={null}>
                <Flex gap="small">
                  <Button
                    block
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    data-test="submit-button"
                  >
                    {t('Reset password')}
                  </Button>
                  <Button block type="default" href="/login/">
                    {t('Cancel')}
                  </Button>
                </Flex>
              </Form.Item>
            </Form>
          </Flex>
        )}
      </StyledCard>
    </Flex>
  );
}
