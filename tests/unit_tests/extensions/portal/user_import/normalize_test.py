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
import pytest

from superset.extensions.portal.services.user_import.models import Reason, Secret
from superset.extensions.portal.services.user_import.normalize import (
    canonical_key,
    normalize_email,
    normalize_name,
    normalize_password,
    normalize_username,
    sanitize_csv_cell,
    split_name,
    validate_name,
)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("MARIA DA SILVA", "Maria da Silva"),
        ("joao dos santos e souza", "Joao dos Santos e Souza"),
        ("DA SILVA MARIA", "Da Silva Maria"),
        ("ANA D'ÁVILA", "Ana D'Ávila"),
        ("MARIA-CLARA DE OLIVEIRA", "Maria-Clara de Oliveira"),
        ("  maria    souza  ", "Maria Souza"),
        ("McDonald Silva", "McDonald Silva"),
        ("Maria DA Silva", "Maria DA Silva"),
        ("", ""),
    ],
)
def test_normalize_name(raw: str, expected: str) -> None:
    assert normalize_name(raw) == expected


def test_split_name_um_token_e_incompleto() -> None:
    assert split_name("Maria") is None
    assert split_name("Maria da Silva") == ("Maria", "da Silva")
    assert validate_name("MARIA")[3] == Reason.NOME_INCOMPLETO
    assert validate_name("  ")[3] == Reason.campo_obrigatorio("nome")
    assert validate_name("A " + "b" * 65)[3] == Reason.NOME_MUITO_LONGO


def test_username_preserva_zeros_e_chave_canonica() -> None:
    assert normalize_username("00123") == ("00123", None)
    assert canonical_key("00123") == "123"
    assert canonical_key("123") == "123"
    assert canonical_key("000") == "0"
    assert canonical_key("ABC") == "abc"


def test_username_cpf_formatado_perde_pontuacao() -> None:
    assert normalize_username(" 012.345.678-90 ") == ("01234567890", None)


@pytest.mark.parametrize("raw", ["a b", "maria!", "x" * 129, "çao", "12.3"])
def test_username_invalido(raw: str) -> None:
    # "12.3" é válido pela allowlist; os demais não
    value, reason = normalize_username(raw)
    if raw == "12.3":
        assert reason is None
    else:
        assert reason == Reason.USERNAME_INVALIDO


def test_username_vazio_e_obrigatorio() -> None:
    assert normalize_username("  ")[1] == Reason.campo_obrigatorio("usuario")
    assert normalize_username(None)[1] == Reason.campo_obrigatorio("usuario")


def test_username_limite_128() -> None:
    assert normalize_username("1" * 128)[1] is None


def test_email() -> None:
    assert normalize_email("  Maria@PTM.com.br ") == ("maria@ptm.com.br", None)
    assert normalize_email("")[1] == Reason.campo_obrigatorio("email")
    assert normalize_email("sem-arroba")[1] == Reason.EMAIL_INVALIDO
    assert normalize_email("a@" + "b" * 320 + ".com")[1] == Reason.EMAIL_INVALIDO


def test_senha_com_acento_perde_acento() -> None:
    result = normalize_password("Sênhá1çÃo")
    assert result.reason is None
    assert result.normalized is True
    assert result.password is not None
    assert result.password.reveal() == "Senha1cAo"


def test_senha_ascii_nao_e_marcada_como_normalizada() -> None:
    result = normalize_password("Senha1234")
    assert result.normalized is False
    assert result.password == Secret("Senha1234")


@pytest.mark.parametrize(
    "raw",
    [
        None,
        "",
        "curta1",
        "senha 😀 boa",
        " espaco1234",
        "espaco1234 ",
        "x" * 129,
        "ß-senha-12",
        "senha\tcom\ttab",
    ],
)
def test_senha_invalida(raw: object) -> None:
    result = normalize_password(raw)
    assert result.reason == Reason.SENHA_INVALIDA
    assert result.password is None


def test_senha_minimo_configuravel() -> None:
    assert normalize_password("abcd", min_length=4).reason is None
    assert normalize_password("abcd", min_length=5).reason == Reason.SENHA_INVALIDA


def test_senha_espaco_interno_vale() -> None:
    assert normalize_password("duas palavras").reason is None


def test_senha_complexidade_opcional() -> None:
    assert normalize_password("Senha1234", complexity_check=lambda p: False).reason == (
        Reason.SENHA_INVALIDA
    )
    assert (
        normalize_password("Senha1234", complexity_check=lambda p: True).reason is None
    )


def test_motivo_de_senha_nao_contem_a_senha() -> None:
    segredo = "Seg😀redo"
    result = normalize_password(segredo)
    assert segredo not in repr(result)
    assert segredo not in str(result.reason)


@pytest.mark.parametrize(
    "raw",
    ["=1+1", "+1", "-1", "@SUM(A1)", "\t=1", "\r=1", "  =1+1", " \t@x"],
)
def test_sanitiza_csv_injection(raw: str) -> None:
    assert sanitize_csv_cell(raw) == "'" + raw


@pytest.mark.parametrize("raw", ["maria", "01234567890", "a=b", "", None, "  ", "x-y"])
def test_nao_altera_celula_segura(raw: object) -> None:
    assert sanitize_csv_cell(raw) == ("" if raw is None else str(raw))
