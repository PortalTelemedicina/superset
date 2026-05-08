# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

from __future__ import annotations

import logging

from flask import current_app as app, request, Response
from flask_appbuilder.api import expose, safe
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from marshmallow import ValidationError
from werkzeug.security import generate_password_hash

from superset import is_feature_enabled
from superset.extensions import db
from superset.utils.core import send_email_smtp
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics
from superset.views.forgot_password.schemas import (
    ForgotPasswordRequestSchema,
    ResetPasswordRequestSchema,
)

logger = logging.getLogger(__name__)


class ForgotPasswordRestApi(BaseSupersetApi):
    """REST API for self-service password reset.

    Both endpoints are public (no @protect decorator) since
    unauthenticated users need to access them.
    """

    resource_name = "forgot-password"
    openapi_spec_tag = "Forgot Password"
    openapi_spec_component_schemas = (
        ForgotPasswordRequestSchema,
        ResetPasswordRequestSchema,
    )

    def _get_serializer(self) -> URLSafeTimedSerializer:
        """Create a timed serializer using app secret and a dedicated salt."""
        return URLSafeTimedSerializer(
            app.config["SECRET_KEY"],
            salt=app.config.get(
                "FORGOT_PASSWORD_TOKEN_SALT", "forgot-password-salt"
            ),
        )

    def _get_reset_url(self, token: str) -> str:
        base_url = app.config.get("FORGOT_PASSWORD_BASE_URL")
        if not base_url:
            base_url = request.host_url.rstrip("/")
        return f"{base_url}/reset-password/?token={token}"

    def _send_reset_email(
        self, email: str, reset_url: str, first_name: str
    ) -> None:
        subject = "Superset – Redefinição de Senha"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Olá, {first_name}!</h2>
            <p>Recebemos uma solicitação para redefinir sua senha no Superset.</p>
            <p>Clique no botão abaixo para criar uma nova senha:</p>
            <p>
                <a href="{reset_url}"
                   style="background-color: #0983C6; color: white;
                          padding: 12px 24px; text-decoration: none;
                          border-radius: 4px; display: inline-block;">
                    Redefinir Senha
                </a>
            </p>
            <p style="color: #666; font-size: 12px;">
                Este link expira em 1 hora. Se você não solicitou essa
                redefinição, ignore este email com segurança.
            </p>
        </body>
        </html>
        """
        smtp_config = {
            "SMTP_HOST": app.config["SMTP_HOST"],
            "SMTP_PORT": app.config["SMTP_PORT"],
            "SMTP_STARTTLS": app.config["SMTP_STARTTLS"],
            "SMTP_SSL": app.config["SMTP_SSL"],
            "SMTP_USER": app.config["SMTP_USER"],
            "SMTP_PASSWORD": app.config["SMTP_PASSWORD"],
            "SMTP_MAIL_FROM": app.config["SMTP_MAIL_FROM"],
            "SMTP_SSL_SERVER_AUTH": app.config["SMTP_SSL_SERVER_AUTH"],
            "EMAIL_HEADER_MUTATOR": app.config["EMAIL_HEADER_MUTATOR"],
        }
        send_email_smtp(
            to=email,
            subject=subject,
            html_content=html_content,
            config=smtp_config,
        )

    @expose("/request", methods=("POST",))
    @safe
    @statsd_metrics
    @requires_json
    def request_reset(self) -> Response:
        """Request a password reset email.
        ---
        post:
          summary: Request password reset
          description: >-
            Sends a password reset email if the email exists.
            Always returns 200 to prevent email enumeration.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ForgotPasswordRequestSchema'
          responses:
            200:
              description: Request processed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            400:
              $ref: '#/components/responses/400'
            403:
              description: Feature not enabled
        """
        if not is_feature_enabled("ENABLE_FORGOT_PASSWORD"):
            return self.response_403()

        try:
            data = ForgotPasswordRequestSchema().load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        email = data["email"].strip().lower()

        # Resposta genérica — OWASP: prevenção de enumeração de emails
        generic_response = self.response(
            200,
            message="Se o email estiver cadastrado, você receberá "
            "um link para redefinir sua senha.",
        )

        user = self.appbuilder.sm.find_user(email=email)
        if not user or not user.is_active:
            logger.info(
                "Password reset requested for unknown/inactive email"
            )
            return generic_response

        # itsdangerous: gera token URL-safe com timestamp
        serializer = self._get_serializer()
        token = serializer.dumps(user.email)

        try:
            reset_url = self._get_reset_url(token)
            self._send_reset_email(user.email, reset_url, user.first_name)
            logger.info("Password reset email sent to user id=%s", user.id)
        except Exception:
            logger.exception(
                "Failed to send password reset email to user id=%s", user.id
            )
            return self.response_500(
                message="Erro ao enviar email. Tente novamente mais tarde."
            )

        return generic_response

    @expose("/reset", methods=("POST",))
    @safe
    @statsd_metrics
    @requires_json
    def reset_password(self) -> Response:
        """Reset password using a valid token.
        ---
        post:
          summary: Reset password with token
          description: >-
            Validates the reset token and updates the user password.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ResetPasswordRequestSchema'
          responses:
            200:
              description: Password reset successful
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            400:
              $ref: '#/components/responses/400'
            403:
              description: Feature not enabled or invalid token
        """
        if not is_feature_enabled("ENABLE_FORGOT_PASSWORD"):
            return self.response_403()

        try:
            data = ResetPasswordRequestSchema().load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        token = data["token"]
        new_password = data["password"]

        # itsdangerous: valida assinatura + verifica expiração
        serializer = self._get_serializer()
        max_age = app.config.get("FORGOT_PASSWORD_TOKEN_EXPIRATION", 3600)

        try:
            email = serializer.loads(token, max_age=max_age)
        except SignatureExpired:
            logger.warning("Expired password reset token used")
            return self.response_400(
                message="O link de redefinição expirou. Solicite um novo."
            )
        except BadSignature:
            logger.warning("Invalid password reset token used")
            return self.response_400(
                message="Link de redefinição inválido."
            )

        user = self.appbuilder.sm.find_user(email=email)
        if not user or not user.is_active:
            return self.response_400(
                message="Usuário não encontrado ou inativo."
            )

        # Mesmo padrão de hash usado em views/users/api.py
        user.password = generate_password_hash(
            password=new_password,
            method=app.config.get("FAB_PASSWORD_HASH_METHOD", "scrypt"),
            salt_length=app.config.get("FAB_PASSWORD_HASH_SALT_LENGTH", 16),
        )
        db.session.commit()

        logger.info("Password reset successful for user id=%s", user.id)
        return self.response(200, message="Senha redefinida com sucesso!")
