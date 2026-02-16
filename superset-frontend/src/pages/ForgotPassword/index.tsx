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
import { useState } from 'react';

interface ForgotPasswordForm {
  email: string;
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

export default function ForgotPassword() {
  const [form] = Form.useForm<ForgotPasswordForm>();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onFinish = async (values: ForgotPasswordForm) => {
    setLoading(true);
    try {
      await SupersetClient.post({
        endpoint: '/api/v1/forgot-password/request',
        jsonPayload: { email: values.email },
      });
    } catch {
      // Silenciar — não revelar se o email existe (OWASP)
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <Flex
      justify="center"
      align="center"
      data-test="forgot-password-form"
      css={css`
        width: 100%;
        height: calc(100vh - 200px);
      `}
    >
      <StyledCard title={t('Forgot password')} padded>
        {submitted ? (
          <Flex vertical gap="middle">
            <Typography.Text>
              {t(
                'If your email is registered, you will receive a link to reset your password.',
              )}
            </Typography.Text>
            <Button type="primary" href="/login/" block>
              {t('Back to login')}
            </Button>
          </Flex>
        ) : (
          <Flex vertical gap="middle">
            <Typography.Text type="secondary">
              {t(
                'Enter your email address to receive a password reset link:',
              )}
            </Typography.Text>
            <Form
              layout="vertical"
              requiredMark="optional"
              form={form}
              onFinish={onFinish}
            >
              <Form.Item<ForgotPasswordForm>
                label={t('Email:')}
                name="email"
                rules={[
                  { required: true, message: t('Please enter your email') },
                  { type: 'email', message: t('Please enter a valid email') },
                ]}
              >
                <Input
                  autoFocus
                  prefix={<Icons.MailOutlined iconSize="l" />}
                  data-test="email-input"
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
                    {t('Send reset link')}
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
