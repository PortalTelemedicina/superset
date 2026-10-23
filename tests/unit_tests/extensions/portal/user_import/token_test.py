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
from freezegun import freeze_time

from superset.extensions.portal.services.user_import.token import (
    file_sha256,
    issue_plan_token,
    validate_plan_token,
)

KEY = "chave-de-teste"
HASH = file_sha256(b"conteudo")


def _token() -> str:
    return issue_plan_token(KEY, 7, HASH, "Gamma")


def test_token_valido() -> None:
    assert validate_plan_token(_token(), KEY, 7, HASH, "Gamma") is True


def test_user_id_aceita_int_ou_str() -> None:
    assert validate_plan_token(_token(), KEY, "7", HASH, "Gamma") is True


def test_token_expirado() -> None:
    with freeze_time("2026-01-01 10:00:00"):
        token = _token()
    with freeze_time("2026-01-01 10:14:59"):
        assert validate_plan_token(token, KEY, 7, HASH, "Gamma") is True
    with freeze_time("2026-01-01 10:15:02"):
        assert validate_plan_token(token, KEY, 7, HASH, "Gamma") is False


def test_ttl_configuravel() -> None:
    with freeze_time("2026-01-01 10:00:00"):
        token = _token()
    with freeze_time("2026-01-01 10:01:00"):
        assert validate_plan_token(token, KEY, 7, HASH, "Gamma", max_age=30) is False


def test_outro_arquivo() -> None:
    assert not validate_plan_token(_token(), KEY, 7, file_sha256(b"outro"), "Gamma")


def test_outro_usuario() -> None:
    assert not validate_plan_token(_token(), KEY, 8, HASH, "Gamma")


def test_outra_role() -> None:
    assert not validate_plan_token(_token(), KEY, 7, HASH, "Alpha")


def test_outra_chave() -> None:
    assert not validate_plan_token(_token(), "outra-chave", 7, HASH, "Gamma")


def test_adulterado() -> None:
    token = _token()
    adulterado = token[:-3] + ("AAA" if not token.endswith("AAA") else "BBB")
    assert not validate_plan_token(adulterado, KEY, 7, HASH, "Gamma")


def test_ausente_ou_lixo() -> None:
    for token in (None, "", "lixo", 123, b"x"):
        assert not validate_plan_token(token, KEY, 7, HASH, "Gamma")


def test_token_de_outro_salt_e_recusado() -> None:
    from itsdangerous import URLSafeTimedSerializer

    forjado = URLSafeTimedSerializer(KEY, salt="outro").dumps(
        {"u": "7", "h": HASH, "r": "Gamma"}
    )
    assert not validate_plan_token(forjado, KEY, 7, HASH, "Gamma")


def test_payload_que_nao_e_dict() -> None:
    from itsdangerous import URLSafeTimedSerializer

    from superset.extensions.portal.services.user_import.token import SALT

    token = URLSafeTimedSerializer(KEY, salt=SALT).dumps(["x"])
    assert not validate_plan_token(token, KEY, 7, HASH, "Gamma")
