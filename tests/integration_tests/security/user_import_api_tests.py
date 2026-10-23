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
# isort:skip_file
"""Testes da API de importação de usuários em massa (POST security/users/import)"""

import io
from typing import Any, Optional
from unittest.mock import patch

from flask import current_app
from sqlalchemy import or_

from superset import db, security_manager
from superset.extensions.portal.schemas.user_import import (
    UserImportResponseSchema,
)
from superset.models.core import Log
from superset.utils import json
from tests.conftest import with_config
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME

URI = "api/v1/security/users/import"
PREFIX = "ptmimp"
HEADER = "NOME,USUÁRIO,SENHA,E-MAIL"
PASSWORD = "Sênha-Forte1"
PASSWORD_NORMALIZED = "Senha-Forte1"
AUDIT_ACTION = "SupersetUserApi.import_users"
# CPF-like: a detecção por zeros à esquerda só vale para username numérico
ZERO_PADDED_USERNAME = "0099900011"


def _csv(*rows: tuple[str, str, str, str], header: str = HEADER) -> bytes:
    lines = [header, *(",".join(row) for row in rows)]
    return "\n".join(lines).encode("utf-8")


def _row(n: int, password: str = PASSWORD) -> tuple[str, str, str, str]:
    return (f"USUARIO TESTE {n}", f"{PREFIX}{n:04d}", password, f"{PREFIX}{n}@teste.com")


class TestUserImportApi(SupersetTestCase):
    def tearDown(self) -> None:
        db.session.rollback()
        model = security_manager.user_model
        for user in (
            db.session.query(model)
            .filter(
                or_(
                    model.username.like(f"{PREFIX}%"),
                    model.username == ZERO_PADDED_USERNAME,
                )
            )
            .all()
        ):
            db.session.delete(user)
        db.session.query(Log).filter(Log.action == AUDIT_ACTION).delete(
            synchronize_session=False
        )
        db.session.commit()
        super().tearDown()

    def _post(
        self,
        content: Optional[bytes],
        *,
        filename: str = "usuarios.csv",
        default_role: Optional[str] = "Gamma",
        dry_run: Optional[str] = "true",
        plan_token: Optional[str] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Any:
        data: dict[str, Any] = {}
        if content is not None:
            data["file"] = (io.BytesIO(content), filename)
        if default_role is not None:
            data["default_role"] = default_role
        if dry_run is not None:
            data["dry_run"] = dry_run
        if plan_token is not None:
            data["plan_token"] = plan_token
        return self.client.post(
            URI, data=data, content_type="multipart/form-data", headers=headers
        )

    def _preview(self, content: bytes, **kwargs: Any) -> Any:
        response = self._post(content, dry_run="true", **kwargs)
        self.assert200(response)
        return json.loads(response.data.decode("utf-8"))["result"]

    def _commit(self, content: bytes, token: Optional[str], **kwargs: Any) -> Any:
        return self._post(content, dry_run="false", plan_token=token, **kwargs)

    @staticmethod
    def _find(username: str) -> Any:
        return (
            db.session.query(security_manager.user_model)
            .filter_by(username=username)
            .one_or_none()
        )

    # --- fluxo principal ---

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_dry_run_returns_plan_without_creating(self):
        """
        User import API: o dry-run devolve o plano e não cria nada
        """
        self.login(ADMIN_USERNAME)
        content = _csv(_row(1), _row(2))
        response = self._post(content, dry_run="true")
        self.assert200(response)
        assert response.headers["Cache-Control"] == "no-store"
        body = json.loads(response.data.decode("utf-8"))
        assert UserImportResponseSchema().validate(body) == {}
        result = body["result"]
        assert result["dry_run"] is True
        assert result["plan_token"]
        assert result["summary"]["criar"] == 2
        assert {row["status"] for row in result["rows"]} == {"criar"}
        # a senha efetiva difere da do arquivo (acento removido)
        assert all(row["senha_normalizada"] for row in result["rows"])
        assert PASSWORD not in response.data.decode("utf-8")
        assert PASSWORD_NORMALIZED not in response.data.decode("utf-8")
        assert self._find(f"{PREFIX}0001") is None
        assert self._find(f"{PREFIX}0002") is None

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_commit_without_token_is_409(self):
        """
        User import API: commit sem plan_token responde 409 e não cria nada
        """
        self.login(ADMIN_USERNAME)
        response = self._commit(_csv(_row(1)), token=None)
        assert response.status_code == 409
        assert response.headers["Cache-Control"] == "no-store"
        assert self._find(f"{PREFIX}0001") is None

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_commit_with_changed_file_is_409(self):
        """
        User import API: o token só vale para o arquivo do dry-run
        """
        self.login(ADMIN_USERNAME)
        token = self._preview(_csv(_row(1)))["plan_token"]
        response = self._commit(_csv(_row(1), _row(2)), token=token)
        assert response.status_code == 409
        assert self._find(f"{PREFIX}0001") is None
        assert self._find(f"{PREFIX}0002") is None

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_commit_with_changed_role_is_409(self):
        """
        User import API: o token também amarra a role padrão
        """
        self.login(ADMIN_USERNAME)
        content = _csv(_row(1))
        token = self._preview(content, default_role="Gamma")["plan_token"]
        response = self._commit(content, token=token, default_role="Alpha")
        assert response.status_code == 409

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_commit_creates_users_that_can_authenticate(self):
        """
        User import API: o commit cria usuários que autenticam com a senha
        normalizada, com hash e sem a senha na resposta ou no log de eventos
        """
        self.login(ADMIN_USERNAME)
        content = _csv(_row(1), _row(2))
        token = self._preview(content)["plan_token"]
        response = self._commit(content, token=token)
        self.assert200(response)
        raw = response.data.decode("utf-8")
        result = json.loads(raw)["result"]
        assert result["dry_run"] is False
        assert result["audit_id"]
        assert result["summary"]["criado"] == 2
        assert result["summary"]["falha"] == 0
        for secret in (PASSWORD, PASSWORD_NORMALIZED, token):
            assert secret not in raw

        for n in (1, 2):
            user = self._find(f"{PREFIX}{n:04d}")
            assert user is not None
            assert user.active
            assert [role.name for role in user.roles] == ["Gamma"]
            assert user.first_name == "Usuario"
            assert user.last_name == "Teste " + str(n)
            assert PASSWORD_NORMALIZED not in user.password
            assert security_manager.auth_user_db(user.username, PASSWORD_NORMALIZED)
            assert not security_manager.auth_user_db(user.username, PASSWORD)

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_rerun_is_idempotent(self):
        """
        User import API: reexecutar o mesmo arquivo devolve ja_existe sem falha
        """
        self.login(ADMIN_USERNAME)
        content = _csv(_row(1), _row(2))
        token = self._preview(content)["plan_token"]
        first = json.loads(self._commit(content, token=token).data)["result"]
        assert first["summary"]["criado"] == 2

        second = json.loads(self._commit(content, token=token).data)["result"]
        assert second["summary"]["criado"] == 0
        assert second["summary"]["ja_existe"] == 2
        assert second["summary"]["falha"] == 0

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_preview_flags_existing_and_duplicated_rows(self):
        """
        User import API: existente, existente sem zero, inativo e duplicado no
        arquivo ficam fora do plano de criação
        """
        security_manager.add_user(
            f"{PREFIX}0100",
            "Existente",
            "Ativo",
            f"{PREFIX}100@teste.com",
            security_manager.find_role("Gamma"),
            "senha-existente-1",
        )
        security_manager.add_user(
            ZERO_PADDED_USERNAME,
            "Existente",
            "ComZero",
            f"{PREFIX}200@teste.com",
            security_manager.find_role("Gamma"),
            "senha-existente-3",
        )
        inactive = security_manager.add_user(
            f"{PREFIX}0300",
            "Existente",
            "Inativo",
            f"{PREFIX}300@teste.com",
            security_manager.find_role("Gamma"),
            "senha-existente-2",
        )
        inactive.active = False
        db.session.commit()

        self.login(ADMIN_USERNAME)
        content = _csv(
            ("Ativo Igual", f"{PREFIX}0100", PASSWORD, f"{PREFIX}x1@teste.com"),
            # mesmo CPF do existente, mas sem o zero à esquerda
            ("Sem Zero", ZERO_PADDED_USERNAME.lstrip("0"), PASSWORD, f"{PREFIX}x2@t.com"),
            ("Inativo Igual", f"{PREFIX}0300", PASSWORD, f"{PREFIX}x3@teste.com"),
            ("Duplicado Um", f"{PREFIX}0400", PASSWORD, f"{PREFIX}x4@teste.com"),
            ("Duplicado Dois", f"{PREFIX}0400", PASSWORD, f"{PREFIX}x5@teste.com"),
            ("Pessoa Nova", f"{PREFIX}0500", PASSWORD, f"{PREFIX}x6@teste.com"),
        )
        result = self._preview(content)
        by_line = {row["line"]: row for row in result["rows"]}
        assert by_line[2]["status"] == "ja_existe"
        assert by_line[2]["reason"] == "existe_username"
        assert by_line[3]["status"] == "ja_existe"
        assert by_line[3]["reason"] == "existe_sem_zero_a_esquerda"
        assert by_line[3]["existing_username"] == ZERO_PADDED_USERNAME
        assert by_line[4]["status"] == "segurada"
        assert by_line[4]["reason"] == "existe_inativo"
        assert by_line[5]["status"] == "segurada"
        assert by_line[5]["reason"] == "duplicado_no_arquivo_username"
        assert by_line[5]["related_lines"] == [5, 6]
        assert by_line[6]["status"] == "segurada"
        assert by_line[7]["status"] == "criar"
        assert result["summary"]["criar"] == 1

    # --- validação de entrada ---

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_admin_as_default_role_is_400(self):
        """
        User import API: Admin nunca pode ser a role padrão
        """
        self.login(ADMIN_USERNAME)
        response = self._post(_csv(_row(1)), default_role="Admin")
        assert response.status_code == 400
        assert self._find(f"{PREFIX}0001") is None

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_unknown_default_role_is_400(self):
        """
        User import API: role padrão inexistente responde 400
        """
        self.login(ADMIN_USERNAME)
        response = self._post(_csv(_row(1)), default_role="RoleQueNaoExiste")
        assert response.status_code == 400

    @with_feature_flags(PTM_USER_IMPORT=True)
    @with_config({"PTM_USER_IMPORT_ALLOWED_ROLES": ["Gamma"]})
    def test_default_role_outside_allowlist_is_400(self):
        """
        User import API: com allowlist preenchida só as roles listadas valem
        """
        self.login(ADMIN_USERNAME)
        response = self._post(_csv(_row(1)), default_role="Alpha")
        assert response.status_code == 400

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_missing_default_role_and_file_are_400(self):
        """
        User import API: role padrão e arquivo são obrigatórios
        """
        self.login(ADMIN_USERNAME)
        assert self._post(_csv(_row(1)), default_role=None).status_code == 400
        assert self._post(None).status_code == 400

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_invalid_dry_run_value_is_400(self):
        """
        User import API: dry_run só aceita true ou false
        """
        self.login(ADMIN_USERNAME)
        assert self._post(_csv(_row(1)), dry_run="talvez").status_code == 400

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_invalid_extension_is_400(self):
        """
        User import API: extensão fora de .csv e .xlsx responde 400
        """
        self.login(ADMIN_USERNAME)
        response = self._post(_csv(_row(1)), filename="usuarios.txt")
        assert response.status_code == 400

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_missing_columns_is_400(self):
        """
        User import API: coluna obrigatória ausente responde 400 com a lista
        """
        self.login(ADMIN_USERNAME)
        content = "NOME,USUARIO,SENHA\nFulano Teste,ptmimp0001,senha-12345".encode()
        response = self._post(content)
        assert response.status_code == 400
        assert json.loads(response.data)["missing_columns"] == ["EMAIL"]

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_not_multipart_is_400(self):
        """
        User import API: corpo que não é multipart/form-data responde 400
        """
        self.login(ADMIN_USERNAME)
        response = self.client.post(
            URI,
            data=json.dumps({"default_role": "Gamma"}),
            content_type="application/json",
        )
        assert response.status_code == 400

    @with_feature_flags(PTM_USER_IMPORT=True)
    @with_config({"PTM_USER_IMPORT_MAX_BYTES": 1000})
    def test_file_over_byte_limit_is_413(self):
        """
        User import API: arquivo acima do limite responde 413, seja pela leitura
        limitada do stream ou pelo Content-Length
        """
        self.login(ADMIN_USERNAME)
        # acima do limite, mas dentro da folga do Content-Length: barra na leitura
        medium = _csv(*(_row(n) for n in range(1, 40)))
        assert 1000 < len(medium) < 60 * 1024
        assert self._post(medium).status_code == 413
        # muito acima: barra pelo Content-Length
        huge = b"x" * (200 * 1024)
        assert self._post(huge).status_code == 413

    @with_feature_flags(PTM_USER_IMPORT=True)
    @with_config({"PTM_USER_IMPORT_MAX_ROWS": 2})
    def test_file_over_row_limit_is_422(self):
        """
        User import API: linhas de dados acima do limite respondem 422
        """
        self.login(ADMIN_USERNAME)
        response = self._post(_csv(_row(1), _row(2), _row(3)))
        assert response.status_code == 422

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_empty_file_is_422(self):
        """
        User import API: arquivo só com cabeçalho responde 422
        """
        self.login(ADMIN_USERNAME)
        assert self._post(_csv()).status_code == 422

    # --- acesso ---

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_anonymous_is_401(self):
        """
        User import API: sem login responde 401
        """
        response = self._post(_csv(_row(1)))
        assert response.status_code == 401

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_gamma_is_403(self):
        """
        User import API: quem não é Admin recebe 403
        """
        self.login(GAMMA_USERNAME)
        response = self._post(_csv(_row(1)))
        assert response.status_code == 403
        assert self._find(f"{PREFIX}0001") is None

    @with_feature_flags(PTM_USER_IMPORT=False)
    def test_flag_off_is_404(self):
        """
        User import API: com a flag desligada a rota responde 404 até para Admin
        """
        self.login(ADMIN_USERNAME)
        response = self._post(_csv(_row(1)))
        assert response.status_code == 404
        assert response.headers["Cache-Control"] == "no-store"

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_csrf_is_enforced_for_session_auth(self):
        """
        User import API: o blueprint do FAB é csrf_exempt, então a rota valida o
        token por conta própria quando WTF_CSRF_ENABLED está ligado
        """
        self.login(ADMIN_USERNAME)
        token_response = self.client.get("api/v1/security/csrf_token/")
        self.assert200(token_response)
        token = json.loads(token_response.data)["result"]

        # o login acima já passou; só agora liga o CSRF
        with patch.dict(current_app.config, {"WTF_CSRF_ENABLED": True}):
            missing = self._post(_csv(_row(1)))
            assert missing.status_code == 400
            invalid = self._post(_csv(_row(1)), headers={"X-CSRFToken": "invalido"})
            assert invalid.status_code == 400
            valid = self._post(_csv(_row(1)), headers={"X-CSRFToken": token})
            assert valid.status_code == 200

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_invalid_bearer_does_not_bypass_csrf_with_session(self):
        """
        User import API: Authorization Bearer inválido com sessão por cookie não
        dispensa o token CSRF
        """
        self.login(ADMIN_USERNAME)
        with patch.dict(current_app.config, {"WTF_CSRF_ENABLED": True}):
            response = self._post(
                _csv(_row(1)), headers={"Authorization": "Bearer invalido"}
            )
            assert response.status_code == 400

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_request_without_content_length_is_411(self):
        """
        User import API: multipart sem Content-Length (chunked) é recusado antes
        de o corpo ser parseado
        """
        self.login(ADMIN_USERNAME)
        response = self.client.post(
            URI,
            data={
                "file": (io.BytesIO(_csv(_row(1))), "usuarios.csv"),
                "default_role": "Gamma",
            },
            content_type="multipart/form-data",
            environ_overrides={"CONTENT_LENGTH": ""},
        )
        assert response.status_code == 411

    # --- auditoria ---

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_audit_event_has_counts_and_no_secrets(self):
        """
        User import API: o evento de auditoria leva contagens, arquivo e só as
        linhas não ok com username mascarado, sem senha e sem o plan_token
        """
        self.login(ADMIN_USERNAME)
        db.session.query(Log).filter(Log.action == AUDIT_ACTION).delete(
            synchronize_session=False
        )
        db.session.commit()

        held = ("USUARIO TESTE 3", f"{PREFIX}0003", PASSWORD, "invalido")
        content = _csv(_row(1), _row(2), held)
        token = self._preview(content)["plan_token"]
        self.assert200(self._commit(content, token=token))

        logs = (
            db.session.query(Log)
            .filter(Log.action == AUDIT_ACTION)
            .order_by(Log.id)
            .all()
        )
        assert len(logs) == 2
        preview, commit = (json.loads(log.json) for log in logs)

        assert preview["dry_run"] is True
        assert preview["summary"]["criar"] == 2
        assert preview["rows"] == []
        assert commit["dry_run"] is False
        assert commit["summary"]["criado"] == 2
        assert commit["file_name"] == "usuarios.csv"
        assert len(commit["file_sha256"]) == 64
        assert commit["default_role"] == "Gamma"
        assert commit["audit_id"]
        assert commit["status_code"] == 200
        assert [(r["line"], r["username"], r["status"]) for r in commit["rows"]] == [
            (4, "ptm*****03", "segurada")
        ]
        for log in logs:
            for secret in (
                PASSWORD,
                PASSWORD_NORMALIZED,
                token,
                f"{PREFIX}0001",
                f"{PREFIX}0003",
            ):
                assert secret not in log.json

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_audit_survives_extra_fields_named_like_logger_params(self):
        """
        User import API: campo extra com nome de parâmetro do event_logger não
        derruba a resposta nem tira a action do registro
        """
        self.login(ADMIN_USERNAME)
        content = _csv(_row(1))
        token = self._preview(content)["plan_token"]
        response = self.client.post(
            f"{URI}?action=x&duration=1",
            data={
                "file": (io.BytesIO(content), "usuarios.csv"),
                "default_role": "Gamma",
                "dry_run": "false",
                "plan_token": token,
                "duration": "1",
                "object_ref": "x",
                "log_to_statsd": "x",
                "senha_extra": "segredo-extra",
            },
            content_type="multipart/form-data",
        )
        self.assert200(response)
        log = (
            db.session.query(Log)
            .filter(Log.action == AUDIT_ACTION)
            .order_by(Log.id.desc())
            .first()
        )
        assert log is not None
        payload = json.loads(log.json)
        assert "segredo-extra" not in log.json
        assert {"senha_extra", "duration", "action"} <= set(payload["ignored_fields"])

    # --- permissões e contrato ---

    def test_permission_exists_and_is_admin_only(self):
        """
        User import API: (can_import_users, User) nasce no sync e fica só no Admin
        """
        security_manager.sync_role_definitions()
        pvm = security_manager.find_permission_view_menu("can_import_users", "User")
        assert pvm is not None
        holders = {
            role.name
            for role in db.session.query(security_manager.role_model).all()
            if pvm in role.permissions
        }
        assert "Admin" in holders
        assert holders.isdisjoint({"Alpha", "Gamma", "sql_lab", "Public"})

    def test_existing_user_api_permissions_are_unchanged(self):
        """
        User import API: a herança do mixin não renomeia as permissões da UserApi
        """
        security_manager.sync_role_definitions()
        for name in ("can_get", "can_post", "can_put", "can_delete", "can_info"):
            assert security_manager.find_permission_view_menu(name, "User"), name

    @with_feature_flags(PTM_USER_IMPORT=True)
    def test_route_and_schema_are_in_openapi(self):
        """
        User import API: a rota e os schemas aparecem no OpenAPI
        """
        self.login(ADMIN_USERNAME)
        response = self.client.get("api/v1/_openapi")
        self.assert200(response)
        spec = json.loads(response.data)
        assert "post" in spec["paths"]["/api/v1/security/users/import"]
        assert "UserImportResponseSchema" in spec["components"]["schemas"]
