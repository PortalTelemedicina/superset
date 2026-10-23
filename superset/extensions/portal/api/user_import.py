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
"""
Rota de importação em massa de usuários, acoplada ao SupersetUserApi.

O mixin só carrega depois do boot: o pacote portal importa `superset` e o
event_logger só existe após o init. Por isso o security manager o compõe em
register_views, e não na definição da classe.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Callable, Optional, TYPE_CHECKING

from flask import current_app, request, Response
from flask_appbuilder.api import expose, safe
from flask_appbuilder.exceptions import PasswordComplexityValidationError
from flask_appbuilder.security.decorators import permission_name, protect
from flask_appbuilder.validators import default_password_complexity
from flask_babel import gettext as __
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from flask_wtf.csrf import validate_csrf
from wtforms import ValidationError

from superset import is_feature_enabled
from superset.extensions import event_logger
from superset.extensions.portal.schemas.user_import import (
    UserImportResponseSchema,
    UserImportResultSchema,
    UserImportRowSchema,
    UserImportSummarySchema,
)
from superset.extensions.portal.services.user_import import parser
from superset.extensions.portal.services.user_import.audit import (
    audit_rows,
    extra_field_payload,
)
from superset.extensions.portal.services.user_import.executor import execute_import
from superset.extensions.portal.services.user_import.fab_repository import (
    FabUserRepository,
)
from superset.extensions.portal.services.user_import.models import (
    InvalidDefaultRole,
    Reason,
)
from superset.extensions.portal.services.user_import.planner import (
    plan_import,
    role_blocker,
)
from superset.extensions.portal.services.user_import.token import (
    file_sha256,
    issue_plan_token,
    validate_plan_token,
)
from superset.utils.core import get_user_id, get_username
from superset.views.base_api import BaseSupersetApiMixin, statsd_metrics

logger = logging.getLogger(__name__)

# O event_logger despeja request.form inteiro no payload. Campo fora do contrato
# é mascarado no log de eventos, para não registrar algo que não deveria estar lá.
_ALLOWED_FIELDS = frozenset({"default_role", "dry_run", "plan_token"})

# Folga do Content-Length sobre o limite do arquivo (boundaries e campos do
# multipart). O limite exato do arquivo é conferido na leitura do stream.
_MULTIPART_OVERHEAD = 64 * 1024

_PARSE_STATUS = {
    parser.ERRO_EXTENSAO: 400,
    parser.ERRO_COLUNAS: 400,
    # o tamanho bruto já foi barrado com 413; aqui só sobra o XLSX descomprimido
    parser.ERRO_LIMITE_BYTES: 422,
    parser.ERRO_VAZIO: 422,
    parser.ERRO_ENCODING: 422,
    parser.ERRO_LIMITE_LINHAS: 422,
    parser.ERRO_ILEGIVEL: 422,
}


def _parse_message(code: str) -> str:
    """Uma mensagem por código, para nunca ecoar conteúdo do arquivo."""
    messages = {
        parser.ERRO_EXTENSAO: __("Invalid file extension; use .csv or .xlsx"),
        parser.ERRO_COLUNAS: __("Required columns are missing"),
        parser.ERRO_LIMITE_BYTES: __("The file is too large"),
        parser.ERRO_VAZIO: __("The file has no data rows"),
        parser.ERRO_ENCODING: __("The file encoding could not be recognized"),
        parser.ERRO_LIMITE_LINHAS: __("The file exceeds the row limit"),
        parser.ERRO_ILEGIVEL: __("The file could not be read"),
    }
    return messages.get(code, __("The file could not be read"))


def _complexity_check() -> Optional[Callable[[str], bool]]:
    """O add_user do FAB não valida complexidade, então a checagem é feita aqui."""
    config = current_app.config
    if not config.get("FAB_PASSWORD_COMPLEXITY_ENABLED", False):
        return None
    validator = (
        config.get("FAB_PASSWORD_COMPLEXITY_VALIDATOR") or default_password_complexity
    )

    def check(password: str) -> bool:
        try:
            validator(password)
        except PasswordComplexityValidationError:
            return False
        return True

    return check


def _has_valid_jwt() -> bool:
    """
    Só um JWT que passa na verificação dispensa o CSRF. A UserApi aceita sessão
    por cookie e o protect() não valida o Bearer quando há sessão, então o
    cabeçalho sozinho não prova nada.
    """
    if not request.headers.get("Authorization", "").lower().startswith("bearer "):
        return False
    try:
        verify_jwt_in_request(optional=True)
        return get_jwt_identity() is not None
    except Exception:  # pylint: disable=broad-except
        return False


def _csrf_error() -> Optional[str]:
    """
    O blueprint da UserApi do FAB é csrf_exempt, então o CSRFProtect não cobre
    esta rota. Com sessão por cookie o token é exigido aqui; JWT válido não.
    """
    if not current_app.config.get("WTF_CSRF_ENABLED", False):
        return None
    if _has_valid_jwt():
        return None
    header_names = current_app.config.get(
        "WTF_CSRF_HEADERS", ["X-CSRFToken", "X-CSRF-Token"]
    )
    token = next(
        (request.headers[name] for name in header_names if name in request.headers),
        None,
    )
    if not token:
        return __("The CSRF token is missing.")
    try:
        validate_csrf(token)
    except ValidationError:
        return __("The CSRF token is invalid.")
    return None


class UserImportApiMixin:
    """Adiciona POST /api/v1/security/users/import ao SupersetUserApi."""

    openapi_spec_component_schemas = (
        UserImportResponseSchema,
        UserImportResultSchema,
        UserImportRowSchema,
        UserImportSummarySchema,
    )

    # Usados pelo statsd_metrics. Não herda o BaseSupersetApiMixin inteiro: o
    # csrf_exempt e o `responses` dele sobrescreveriam os do FAB na API de usuários.
    incr_stats = BaseSupersetApiMixin.incr_stats
    timing_stats = BaseSupersetApiMixin.timing_stats
    send_stats_metrics = BaseSupersetApiMixin.send_stats_metrics

    if TYPE_CHECKING:

        @staticmethod
        def response(code: int, **kwargs: Any) -> Response: ...

        def response_404(self) -> Response: ...

    @expose("/import", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action="SupersetUserApi.import_users",
        log_to_statsd=False,
        allow_extra_payload=True,
        # o token de plano é credencial até expirar: não vai para o log de eventos
        plan_token=None,
    )
    @permission_name("import_users")
    def import_users(
        self, add_extra_log_payload: Callable[..., None] = lambda **kwargs: None
    ) -> Response:
        """Import users in bulk from a CSV or XLSX file.
        ---
        post:
          summary: Import users in bulk from a CSV or XLSX file
          description: >-
            Two steps. With dry_run=true (default) the file is validated and a
            plan is returned together with a plan_token. With dry_run=false the
            same file and the plan_token are required, the plan is recomputed
            and the users are created row by row. Passwords are never returned.
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  required:
                    - file
                    - default_role
                  properties:
                    file:
                      description: CSV or XLSX with name, username, password and email
                      type: string
                      format: binary
                    default_role:
                      description: Existing role applied to rows without a role column
                      type: string
                    dry_run:
                      description: '"true" (default) builds the plan, "false" executes'
                      type: string
                      enum: ["true", "false"]
                    plan_token:
                      description: Token returned by the dry run (required to execute)
                      type: string
          responses:
            200:
              description: Plan (dry run) or execution report
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/UserImportResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            409:
              description: Missing, invalid or expired plan_token
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            411:
              description: Request without Content-Length (chunked upload)
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            413:
              description: File above the size limit
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        started = time.monotonic()
        audit: dict[str, Any] = {}
        response: Optional[Response] = None
        try:
            response = self._ptm_user_import_run(audit)
        except Exception as ex:  # pylint: disable=broad-except
            # só o tipo: a mensagem de erro de banco pode trazer valores da linha
            logger.error(
                "user_import: erro inesperado audit_id=%s erro=%s",
                audit.get("audit_id"),
                type(ex).__name__,
            )
            response = self.response(
                500, message=__("Unexpected error while importing users")
            )
        finally:
            masked = extra_field_payload(
                key
                for key in (*request.form.keys(), *request.args.keys())
                if key not in _ALLOWED_FIELDS
            )
            audit["duration_ms"] = int((time.monotonic() - started) * 1000)
            audit["status_code"] = response.status_code if response else 500
            add_extra_log_payload(**{**masked, **audit})
        response.headers["Cache-Control"] = "no-store"
        return response

    def _ptm_user_import_run(self, audit: dict[str, Any]) -> Response:
        config = current_app.config
        if not is_feature_enabled("PTM_USER_IMPORT"):
            return self.response_404()

        audit_id = str(uuid.uuid4())
        audit.update(audit_id=audit_id, actor=get_username(), ip=request.remote_addr)

        if csrf_error := _csrf_error():
            return self.response(400, message=csrf_error)
        if request.mimetype != "multipart/form-data":
            return self.response(
                400,
                message=__("Request MIME type is not 'multipart/form-data'"),
                error_type="INVALID_PAYLOAD_FORMAT_ERROR",
            )

        # Antes de acessar request.form/files: o werkzeug só parseia o corpo no
        # acesso, e o upload sem Content-Length (chunked) iria inteiro para disco.
        # No Flask 2.3 o max_content_length da request é só leitura, então o
        # corpo sem tamanho declarado é recusado em vez de limitado.
        max_bytes = int(config["PTM_USER_IMPORT_MAX_BYTES"])
        if request.content_length is None:
            return self.response(411, message=__("Content-Length is required"))
        if request.content_length > max_bytes + _MULTIPART_OVERHEAD:
            return self.response(413, message=__("The file is too large"))

        default_role = (request.form.get("default_role") or "").strip()
        if not default_role:
            return self.response(400, message=__("default_role is required"))
        dry_run_raw = (request.form.get("dry_run") or "true").strip().lower()
        if dry_run_raw not in ("true", "false"):
            return self.response(400, message=__("dry_run must be true or false"))
        dry_run = dry_run_raw == "true"
        audit.update(default_role=default_role, dry_run=dry_run)

        allowed_roles = list(config.get("PTM_USER_IMPORT_ALLOWED_ROLES") or []) or None
        if blocked := role_blocker(default_role, allowed_roles):
            return self.response(
                400, message=__("The default role is not allowed"), reason=blocked
            )

        upload = request.files.get("file")
        if upload is None or not upload.filename:
            return self.response(400, message=__("The file is required"))
        content = upload.stream.read(max_bytes + 1)
        if len(content) > max_bytes:
            return self.response(413, message=__("The file is too large"))
        file_hash = file_sha256(content)
        audit.update(
            file_name=upload.filename[:255],
            file_sha256=file_hash,
            file_size=len(content),
        )

        try:
            parsed = parser.parse_upload(
                upload.filename,
                content,
                max_rows=int(config["PTM_USER_IMPORT_MAX_ROWS"]),
                max_bytes=max_bytes,
            )
        except parser.ParseError as ex:
            payload: dict[str, Any] = {"message": _parse_message(ex.code)}
            if ex.missing_columns:
                payload["missing_columns"] = list(ex.missing_columns)
            audit["error"] = ex.code
            return self.response(_PARSE_STATUS.get(ex.code, 422), **payload)

        secret_key = config["SECRET_KEY"]
        user_id = get_user_id()
        ttl = int(config["PTM_USER_IMPORT_PLAN_TTL_SECONDS"])
        options: dict[str, Any] = {
            "allowed_roles": allowed_roles,
            "min_password_len": int(config["PTM_USER_IMPORT_MIN_PASSWORD_LENGTH"]),
            "complexity_check": _complexity_check(),
            "warnings": parsed.warnings,
        }
        repo = FabUserRepository(current_app.appbuilder.sm)

        try:
            if dry_run:
                plan = plan_import(parsed.rows, repo, default_role, **options)
                result: dict[str, Any] = {
                    "dry_run": True,
                    "plan_token": issue_plan_token(
                        secret_key, user_id, file_hash, default_role
                    ),
                    "expires_in": ttl,
                    "default_role": default_role,
                    "summary": plan.summary.to_dict(),
                    "warnings": list(plan.warnings),
                    "rows": [row.to_preview_dict() for row in plan.rows],
                }
                results = plan.rows
            else:
                if not validate_plan_token(
                    request.form.get("plan_token"),
                    secret_key,
                    user_id,
                    file_hash,
                    default_role,
                    max_age=ttl,
                ):
                    return self.response(
                        409, message=__("Invalid or expired plan; redo the preview")
                    )
                execution = execute_import(
                    parsed.rows, repo, default_role, audit_id=audit_id, **options
                )
                result = {
                    "dry_run": False,
                    "audit_id": execution.audit_id,
                    "default_role": default_role,
                    "summary": execution.summary.to_dict(executado=True),
                    "warnings": list(execution.warnings),
                    "rows": [row.to_report_dict() for row in execution.rows],
                }
                results = execution.rows
        except InvalidDefaultRole as ex:
            audit["error"] = ex.reason
            message = (
                __("The default role does not exist")
                if ex.reason == Reason.ROLE_INVALIDA
                else __("The default role is not allowed")
            )
            return self.response(400, message=message, reason=ex.reason)

        audit["summary"] = result["summary"]
        audit["rows"] = audit_rows(results, dry_run)
        return self.response(200, result=result)
