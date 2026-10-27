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
from superset.extensions.portal.services.user_import.audit import (
    audit_rows,
    extra_field_payload,
    mask_username,
    RESERVED_LOG_KEYS,
)
from superset.extensions.portal.services.user_import.models import (
    Reason,
    RowResult,
    Status,
)


def _row(line: int, username: str, status: Status, reason: str | None = None):
    return RowResult(line=line, username=username, status=status, reason=reason)


def test_mask_username_cpf() -> None:
    assert mask_username("01234567890") == "012******90"


def test_mask_username_curto_some_por_inteiro() -> None:
    assert mask_username("abcde") == "*****"
    assert mask_username("") == ""


def test_audit_rows_dry_run_nao_grava_linhas() -> None:
    rows = [_row(2, "01234567890", Status.SEGURADA, Reason.SENHA_INVALIDA)]
    assert audit_rows(rows, dry_run=True) == []


def test_audit_rows_commit_so_nao_ok_e_mascarado() -> None:
    rows = [
        _row(2, "01234567890", Status.CRIADO),
        _row(3, "11122233344", Status.SEGURADA, Reason.SENHA_INVALIDA),
        _row(4, "55566677788", Status.FALHA, Reason.ERRO_CRIACAO),
        _row(5, "99988877766", Status.JA_EXISTE, Reason.EXISTE_USERNAME),
    ]
    assert audit_rows(rows, dry_run=False) == [
        {
            "line": 3,
            "username": "111******44",
            "status": "segurada",
            "reason": Reason.SENHA_INVALIDA,
        },
        {
            "line": 4,
            "username": "555******88",
            "status": "falha",
            "reason": Reason.ERRO_CRIACAO,
        },
    ]
    assert "01234567890" not in str(audit_rows(rows, dry_run=False))


def test_extra_field_payload_vazio() -> None:
    assert extra_field_payload([]) == {}


def test_extra_field_payload_zera_valores_e_lista_nomes() -> None:
    assert extra_field_payload(["senha", "senha", "x"]) == {
        "senha": None,
        "x": None,
        "ignored_fields": ["senha", "x"],
    }


def test_extra_field_payload_nao_vira_kwarg_reservado() -> None:
    payload = extra_field_payload(
        ["duration", "object_ref", "log_to_statsd", "action", "database", "self"]
    )
    assert not RESERVED_LOG_KEYS & payload.keys()
    assert payload["ignored_fields"] == sorted(RESERVED_LOG_KEYS)
