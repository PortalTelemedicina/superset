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
from typing import Any

import pytest

from superset.extensions.portal.services.user_import.models import (
    InvalidDefaultRole,
    Reason,
    Status,
)
from superset.extensions.portal.services.user_import.planner import plan_import
from tests.unit_tests.extensions.portal.user_import.fakes import FakeRepo, row, user


def _plan(rows, repo=None, **kwargs):
    return plan_import(
        rows, repo or FakeRepo(), kwargs.pop("default_role", "Gamma"), **kwargs
    )


def test_linha_valida_vira_criar() -> None:
    plan = _plan([row(2, nome="MARIA DA SILVA", usuario="012.345.678-90")])
    r = plan.rows[0]
    assert r.status is Status.CRIAR
    assert r.reason is None
    assert (r.username, r.first_name, r.last_name) == (
        "01234567890",
        "Maria",
        "da Silva",
    )
    assert r.role == "Gamma"
    assert plan.summary.criar == 1


def test_existente_exato() -> None:
    plan = _plan([row(2)], FakeRepo([user("01234567890", "outro@x.com")]))
    r = plan.rows[0]
    assert (r.status, r.reason) == (Status.JA_EXISTE, Reason.EXISTE_USERNAME)
    assert r.existing_username == "01234567890"


def test_existente_exato_sem_diferenciar_caixa() -> None:
    plan = _plan([row(2, usuario="Maria.Silva")], FakeRepo([user("maria.silva")]))
    assert plan.rows[0].reason == Reason.EXISTE_USERNAME


def test_banco_sem_zero_contra_arquivo_com_zero() -> None:
    plan = _plan([row(2, usuario="01234567890")], FakeRepo([user("1234567890")]))
    r = plan.rows[0]
    assert (r.status, r.reason) == (Status.JA_EXISTE, Reason.EXISTE_SEM_ZERO)
    assert r.existing_username == "1234567890"


def test_banco_com_zero_contra_arquivo_sem_zero() -> None:
    plan = _plan([row(2, usuario="1234567890")], FakeRepo([user("01234567890")]))
    r = plan.rows[0]
    assert (r.status, r.reason) == (Status.JA_EXISTE, Reason.EXISTE_SEM_ZERO)
    assert r.existing_username == "01234567890"


def test_email_existente_em_maiusculas_no_banco() -> None:
    repo = FakeRepo([user("outro", "MARIA@PTM.COM.BR")])
    plan = _plan([row(2, email="maria@ptm.com.br")], repo)
    r = plan.rows[0]
    assert (r.status, r.reason) == (Status.JA_EXISTE, Reason.EXISTE_EMAIL)
    assert r.existing_username == "outro"


def test_username_e_email_apontando_para_o_mesmo_usuario() -> None:
    repo = FakeRepo([user("01234567890", "m@ptm.com.br")])
    plan = _plan([row(2, email="m@ptm.com.br")], repo)
    assert plan.rows[0].reason == Reason.EXISTE_USERNAME


def test_conflito_username_e_email_de_usuarios_diferentes() -> None:
    repo = FakeRepo([user("01234567890", "a@x.com"), user("zzz", "m@ptm.com.br")])
    plan = _plan([row(2, email="m@ptm.com.br")], repo)
    r = plan.rows[0]
    assert (r.status, r.reason) == (Status.SEGURADA, Reason.CONFLITO_VARIOS)


def test_conflito_com_e_sem_zero_ambos_no_banco() -> None:
    repo = FakeRepo([user("1234567890"), user("01234567890")])
    plan = _plan([row(2, usuario="001234567890")], repo)
    assert plan.rows[0].reason == Reason.CONFLITO_VARIOS


def test_email_casando_com_varios_usuarios_do_banco() -> None:
    repo = FakeRepo([user("a", "m@ptm.com.br"), user("b", "M@ptm.com.br")])
    plan = _plan([row(2, email="m@ptm.com.br")], repo)
    assert plan.rows[0].reason == Reason.CONFLITO_VARIOS


def test_inativo_segurado_e_nunca_alterado() -> None:
    repo = FakeRepo([user("01234567890", "m@x.com", active=False)])
    plan = _plan([row(2)], repo)
    r = plan.rows[0]
    assert (r.status, r.reason) == (Status.SEGURADA, Reason.EXISTE_INATIVO)
    assert r.existing_username == "01234567890"
    assert r.password is None


def test_duplicado_por_username_segura_todas_as_linhas() -> None:
    plan = _plan(
        [
            row(2, usuario="0123"),
            row(3, usuario="999"),
            row(4, usuario="123", email="outro@ptm.com.br"),
        ]
    )
    por_linha = {r.line: r for r in plan.rows}
    for line in (2, 4):
        assert por_linha[line].status is Status.SEGURADA
        assert por_linha[line].reason == Reason.DUPLICADO_USERNAME
        assert por_linha[line].related_lines == (2, 4)
    assert por_linha[3].status is Status.CRIAR


def test_duplicado_por_email_segura_todas_as_linhas() -> None:
    plan = _plan(
        [
            row(2, usuario="1", email="x@ptm.com.br"),
            row(3, usuario="2", email="X@ptm.com.br"),
        ]
    )
    assert [(r.status, r.reason) for r in plan.rows] == [
        (Status.SEGURADA, Reason.DUPLICADO_EMAIL)
    ] * 2
    assert plan.rows[0].related_lines == (2, 3)


def test_cadeia_transitiva_segura_as_tres() -> None:
    plan = _plan(
        [
            row(2, usuario="10", email="a@ptm.com.br"),
            row(3, usuario="10", email="b@ptm.com.br"),
            row(4, usuario="20", email="b@ptm.com.br"),
            row(5, usuario="30", email="c@ptm.com.br"),
        ]
    )
    por_linha = {r.line: r for r in plan.rows}
    for line in (2, 3, 4):
        assert por_linha[line].status is Status.SEGURADA
        assert por_linha[line].related_lines == (2, 3, 4)
    assert por_linha[2].reason == Reason.DUPLICADO_USERNAME
    assert por_linha[4].reason == Reason.DUPLICADO_EMAIL
    assert por_linha[5].status is Status.CRIAR


def test_linhas_identicas_ficam_seguradas() -> None:
    plan = _plan([row(2, email="a@p.com"), row(3, email="a@p.com")])
    assert {r.status for r in plan.rows} == {Status.SEGURADA}


def test_duplicado_mantem_motivo_principal_e_lista_o_do_banco_como_secundario() -> None:
    repo = FakeRepo([user("123")])
    plan = _plan([row(2, usuario="0123"), row(3, usuario="123")], repo)
    r = plan.rows[0]
    assert r.status is Status.SEGURADA
    assert r.reason == Reason.DUPLICADO_USERNAME
    assert Reason.EXISTE_SEM_ZERO in r.secondary_reasons
    assert plan.rows[1].secondary_reasons == (Reason.EXISTE_USERNAME,)


def test_role_invalida_por_linha() -> None:
    plan = _plan([row(2, role="NaoExiste")])
    assert plan.rows[0].reason == Reason.ROLE_INVALIDA


def test_admin_barrada_por_linha_em_qualquer_caixa() -> None:
    for nome in ("Admin", "admin", "ADMIN"):
        plan = _plan([row(2, role=nome)], FakeRepo(roles={"Gamma", nome}))
        assert plan.rows[0].reason == Reason.ROLE_NAO_PERMITIDA


def test_admin_barrada_mesmo_na_allowlist() -> None:
    plan = _plan([row(2, role="Admin")], allowed_roles={"Admin", "Gamma"})
    assert plan.rows[0].reason == Reason.ROLE_NAO_PERMITIDA


def test_admin_como_role_padrao_levanta() -> None:
    with pytest.raises(InvalidDefaultRole) as exc:
        _plan([row(2)], default_role="Admin")
    assert exc.value.reason == Reason.ROLE_NAO_PERMITIDA


def test_role_padrao_inexistente_levanta() -> None:
    with pytest.raises(InvalidDefaultRole) as exc:
        _plan([row(2)], default_role="Fantasma")
    assert exc.value.reason == Reason.ROLE_INVALIDA


def test_role_padrao_fora_da_allowlist_levanta() -> None:
    with pytest.raises(InvalidDefaultRole):
        _plan([row(2)], default_role="Gamma", allowed_roles={"Alpha"})


def test_allowlist_vazia_permite_todas_exceto_admin() -> None:
    plan = _plan(
        [row(2, usuario="1", role="Alpha"), row(3, usuario="2", role="sql_lab")],
        allowed_roles=set(),
    )
    assert [r.status for r in plan.rows] == [Status.CRIAR, Status.CRIAR]


def test_allowlist_preenchida_restringe() -> None:
    plan = _plan(
        [
            row(2, usuario="1", role="Alpha"),
            row(3, usuario="2", role="sql_lab"),
            row(4, usuario="3"),
        ],
        allowed_roles={"Gamma", "Alpha"},
    )
    assert [r.reason for r in plan.rows] == [None, Reason.ROLE_NAO_PERMITIDA, None]


def test_role_por_linha_tem_precedencia_sobre_a_padrao() -> None:
    plan = _plan([row(2, usuario="1", role="Alpha"), row(3, usuario="2")])
    assert [r.role for r in plan.rows] == ["Alpha", "Gamma"]


def test_senha_curta_e_senha_acentuada() -> None:
    plan = _plan(
        [row(2, usuario="1", senha="Abc12"), row(3, usuario="2", senha="Sênha123")]
    )
    assert plan.rows[0].reason == Reason.SENHA_INVALIDA
    assert plan.rows[0].status is Status.SEGURADA
    assert plan.rows[1].status is Status.CRIAR
    assert plan.rows[1].senha_normalizada is True
    assert plan.rows[1].password.reveal() == "Senha123"


def test_minimo_de_senha_configuravel() -> None:
    assert (
        _plan([row(2, senha="Abc12")], min_password_len=5).rows[0].status
        is Status.CRIAR
    )


def test_sem_senha_fica_segurada() -> None:
    assert _plan([row(2, senha="")]).rows[0].reason == Reason.SENHA_INVALIDA


@pytest.mark.parametrize(
    "kwargs,reason",
    [
        ({"nome": ""}, "campo_obrigatorio:nome"),
        ({"nome": "Maria"}, Reason.NOME_INCOMPLETO),
        ({"usuario": ""}, "campo_obrigatorio:usuario"),
        ({"usuario": "a b"}, Reason.USERNAME_INVALIDO),
        ({"email": ""}, "campo_obrigatorio:email"),
        ({"email": "invalido"}, Reason.EMAIL_INVALIDO),
    ],
)
def test_validacoes_de_campo(kwargs: dict[str, Any], reason: str) -> None:
    r = _plan([row(2, **kwargs)]).rows[0]
    assert (r.status, r.reason) == (Status.SEGURADA, reason)


def test_celula_longa_segura_a_linha() -> None:
    from dataclasses import replace

    r = _plan([replace(row(2), celula_longa=True)]).rows[0]
    assert (r.status, r.reason) == (Status.SEGURADA, Reason.CELULA_LONGA)


def test_determinismo_e_ordem_por_linha() -> None:
    rows = [row(i, usuario=str(i % 3), email=f"e{i % 4}@p.com") for i in range(2, 12)]
    repo = FakeRepo([user("1", "z@z.com")])
    a = _plan(rows, repo)
    b = _plan(list(rows), FakeRepo([user("1", "z@z.com")]))
    assert [r.to_preview_dict() for r in a.rows] == [
        r.to_preview_dict() for r in b.rows
    ]
    assert [r.line for r in a.rows] == sorted(r.line for r in a.rows)


def test_plano_nao_grava_nada() -> None:
    repo = FakeRepo()
    _plan([row(2), row(3, usuario="2")], repo)
    assert repo.create_attempts == 0


def test_resumo() -> None:
    repo = FakeRepo([user("5")])
    plan = _plan([row(2, usuario="1"), row(3, usuario="5"), row(4, senha="x")], repo)
    assert plan.summary.to_dict() == {
        "total": 3,
        "criar": 1,
        "ja_existe": 1,
        "segurada": 1,
        "falha": 0,
    }


def test_aviso_do_parser_e_repassado() -> None:
    plan = _plan([row(2)], warnings=["username_numerico_xlsx"])
    assert plan.warnings == ("username_numerico_xlsx",)
