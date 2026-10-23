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
"""Varredura de senha: nada que o núcleo produz pode conter a senha conhecida."""

import dataclasses
import json
import logging

import pytest

from superset.extensions.portal.services.user_import.executor import execute_import
from superset.extensions.portal.services.user_import.models import (
    ImportPlan,
    RawRow,
    Secret,
)
from superset.extensions.portal.services.user_import.normalize import (
    normalize_password,
    sanitize_csv_cell,
)
from superset.extensions.portal.services.user_import.parser import (
    ParseError,
    parse_csv,
)
from superset.extensions.portal.services.user_import.planner import plan_import
from tests.unit_tests.extensions.portal.user_import.fakes import FakeRepo, row, user

SENHA = "Sênha#Única77"
SENHA_EFETIVA = "Senha#Unica77"
CSV = (
    "NOME,USUARIO,SENHA,EMAIL\n"
    f"ANA LIMA,001,{SENHA},ana@ptm.com.br\n"
    f"BIA LIMA,002,{SENHA},bia@ptm.com.br\n"
    f"CAL LIMA,003,{SENHA},cal@ptm.com.br\n"
    f"DUDA LIMA,004,{SENHA},duda@ptm.com.br\n"
    f"EVA LIMA,005,curta,eva@ptm.com.br\n"
)


def _tudo_como_texto(obj: object) -> str:
    return " ".join([repr(obj), str(obj)])


def _varrer(texto: str) -> None:
    assert SENHA not in texto
    assert SENHA_EFETIVA not in texto


def test_secret_nao_vaza_em_nenhuma_representacao() -> None:
    s = Secret(SENHA)
    _varrer(repr(s) + str(s) + f"{s}" + "%s" % s + "{}".format(s))  # noqa: UP031
    _varrer(repr([s]) + repr({"k": s}))


def test_rawrow_e_plano_nao_vazam_em_repr_str_asdict_json(caplog) -> None:  # type: ignore[no-untyped-def]
    caplog.set_level(logging.DEBUG)
    parsed = parse_csv(CSV.encode("utf-8"))
    repo = FakeRepo([user("3", "x@x.com")])
    plan = plan_import(parsed.rows, repo, "Gamma")

    for r in parsed.rows:
        _varrer(_tudo_como_texto(r))
        _varrer(repr(dataclasses.asdict(r)))
    assert any(r.password is not None for r in plan.rows)
    _varrer(_tudo_como_texto(plan))
    _varrer(_tudo_como_texto(plan.summary))
    for r in plan.rows:
        _varrer(_tudo_como_texto(r))
        _varrer(json.dumps(r.to_preview_dict()))
        _varrer(json.dumps(r.to_report_dict()))
    _varrer(json.dumps({"rows": [r.to_preview_dict() for r in plan.rows]}))
    _varrer(caplog.text)


def test_execucao_com_falha_nao_vaza_em_saida_nem_log(caplog) -> None:  # type: ignore[no-untyped-def]
    caplog.set_level(logging.DEBUG)
    repo = FakeRepo(fail_usernames={"002"}, race_usernames={"003"})
    result = execute_import(parse_csv(CSV.encode()).rows, repo, "Gamma")
    assert result.summary.criado == 2
    _varrer(_tudo_como_texto(result))
    for r in result.rows:
        _varrer(json.dumps(r.to_preview_dict()))
        _varrer(json.dumps(r.to_report_dict()))
        _varrer(repr(dataclasses.asdict(r)))
    _varrer(caplog.text)


def test_excecoes_do_nucleo_nao_vazam() -> None:
    with pytest.raises(ParseError) as exc:
        parse_csv(f"NOME,USUARIO,SENHA\nA B,1,{SENHA}\n".encode())
    _varrer(_tudo_como_texto(exc.value) + str(exc.value.args))
    result = normalize_password(SENHA + "\x00")
    _varrer(_tudo_como_texto(result))


def test_relatorio_sanitizado_nao_tem_coluna_de_senha() -> None:
    plan: ImportPlan = plan_import(parse_csv(CSV.encode()).rows, FakeRepo(), "Gamma")
    for r in plan.rows:
        assert "password" not in r.to_preview_dict()
        assert "senha" not in r.to_report_dict()
        assert "password" not in r.to_report_dict()
        assert set(r.to_report_dict()) <= {
            "line", "username", "status", "reason", "existing_username",
        }


def test_campos_livres_do_relatorio_podem_ser_sanitizados() -> None:
    r = plan_import([row(2, nome="=cmd|calc", usuario="x")], FakeRepo(), "Gamma").rows[0]
    assert sanitize_csv_cell(r.first_name).startswith("'=")
    assert isinstance(RawRow(line=1).senha, Secret)
