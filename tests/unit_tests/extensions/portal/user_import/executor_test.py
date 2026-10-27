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
import logging

from superset.extensions.portal.services.user_import.executor import execute_import
from superset.extensions.portal.services.user_import.models import Reason, Status
from tests.unit_tests.extensions.portal.user_import.fakes import FakeRepo, row, user


def _run(rows, repo, **kwargs):
    return execute_import(rows, repo, "Gamma", **kwargs)


def test_cria_so_o_que_esta_como_criar() -> None:
    repo = FakeRepo([user("9", "e9@p.com"), user("8", "e8@p.com", active=False)])
    result = _run(
        [
            row(2, usuario="1"),
            row(3, usuario="9"),
            row(4, usuario="8", email="e8@p.com"),
            row(5, usuario="5", senha="x"),
            row(6, usuario="6"),
        ],
        repo,
    )
    assert [c["username"] for c in repo.created] == ["1", "6"]
    assert [r.status for r in result.rows] == [
        Status.CRIADO,
        Status.JA_EXISTE,
        Status.SEGURADA,
        Status.SEGURADA,
        Status.CRIADO,
    ]
    assert result.summary.to_dict(executado=True) == {
        "total": 5,
        "criar": 0,
        "criado": 2,
        "ja_existe": 1,
        "segurada": 2,
        "falha": 0,
    }


def test_cria_com_dados_normalizados_e_role() -> None:
    repo = FakeRepo()
    _run([row(2, nome="MARIA DA SILVA", senha="Sênha123", role="Alpha")], repo)
    assert repo.created == [
        {
            "username": "01234567890",
            "first_name": "Maria",
            "last_name": "da Silva",
            "email": "u2@ptm.com.br",
            "role": "Alpha",
            "password": "Senha123",
        }
    ]


def test_falha_numa_linha_nao_aborta_o_lote() -> None:
    repo = FakeRepo(fail_usernames={"2"})
    result = _run([row(2, usuario="1"), row(3, usuario="2"), row(4, usuario="3")], repo)
    assert [r.status for r in result.rows] == [
        Status.CRIADO,
        Status.FALHA,
        Status.CRIADO,
    ]
    assert result.rows[1].reason == Reason.ERRO_CRIACAO
    assert len(repo.created) == 2


def test_excecao_inesperada_tambem_nao_aborta() -> None:
    class Quebrado(FakeRepo):
        def create_user(self, **kwargs: str) -> None:
            if kwargs["username"] == "2":
                raise RuntimeError("boom")
            super().create_user(**kwargs)

    result = _run(
        [row(2, usuario="1"), row(3, usuario="2"), row(4, usuario="3")], Quebrado()
    )
    assert [r.status for r in result.rows] == [
        Status.CRIADO,
        Status.FALHA,
        Status.CRIADO,
    ]


def test_corrida_vira_ja_existe_por_releitura() -> None:
    repo = FakeRepo(race_usernames={"1"})
    result = _run([row(2, usuario="1")], repo)
    r = result.rows[0]
    assert (r.status, r.reason) == (Status.JA_EXISTE, Reason.EXISTE_USERNAME)
    assert r.existing_username == "1"


def test_corrida_com_inativo_vira_segurada() -> None:
    class CorridaInativa(FakeRepo):
        def create_user(self, **kwargs: str) -> None:
            self.users.append(user(kwargs["username"], kwargs["email"], active=False))
            raise RuntimeError("x")

    r = _run([row(2, usuario="1")], CorridaInativa()).rows[0]
    assert (r.status, r.reason) == (Status.SEGURADA, Reason.EXISTE_INATIVO)


def test_releitura_que_falha_vira_falha() -> None:
    class SemLeitura(FakeRepo):
        def create_user(self, **kwargs: str) -> None:
            raise RuntimeError("x")

        def find_by_username_keys(self, keys):
            if self.create_attempts:
                raise RuntimeError("db fora")
            return super().find_by_username_keys(keys)

    r = _run([row(2)], SemLeitura()).rows[0]
    assert (r.status, r.reason) == (Status.FALHA, Reason.ERRO_CRIACAO)


def test_segunda_execucao_e_idempotente() -> None:
    repo = FakeRepo()
    rows = [row(2, usuario="1"), row(3, usuario="2"), row(4, usuario="3")]
    primeira = _run(rows, repo)
    segunda = _run(rows, repo)
    assert primeira.summary.criado == 3
    assert segunda.summary.criado == 0
    assert segunda.summary.falha == 0
    assert segunda.summary.ja_existe == 3
    assert len(repo.created) == 3


def test_duplicado_no_arquivo_nao_cria_nenhuma() -> None:
    repo = FakeRepo()
    _run([row(2, usuario="01"), row(3, usuario="1")], repo)
    assert repo.created == []
    assert repo.create_attempts == 0


def test_audit_id_e_gerado_ou_informado() -> None:
    repo = FakeRepo()
    assert len(_run([row(2)], repo).audit_id) == 36
    assert _run([row(3, usuario="9")], repo, audit_id="abc").audit_id == "abc"


def test_resultado_nao_guarda_senha() -> None:
    result = _run([row(2)], FakeRepo())
    assert all(r.password is None for r in result.rows)


def test_log_de_falha_nao_vaza_senha(caplog) -> None:
    caplog.set_level(logging.DEBUG)
    repo = FakeRepo(fail_usernames={"1"})
    _run([row(2, usuario="1", senha="SegredoUnico77")], repo)
    assert "user_import" in caplog.text
    assert "SegredoUnico77" not in caplog.text
