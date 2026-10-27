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
"""Normalização e validação puras dos campos da importação de usuários."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Callable, Optional

from superset.extensions.portal.services.user_import.models import (
    MAX_EMAIL_LEN,
    MAX_NAME_PART_LEN,
    MAX_PASSWORD_LEN,
    MAX_USERNAME_LEN,
    Reason,
    Secret,
)

PARTICULAS = frozenset({"da", "de", "do", "das", "dos", "e"})

_CPF_FORMATADO = re.compile(r"\d{3}\.\d{3}\.\d{3}-\d{2}")
_USERNAME_VALIDO = re.compile(r"[0-9A-Za-z._@-]+", re.ASCII)
_PREFIXOS_FORMULA = ("=", "+", "-", "@")


def collapse_spaces(value: str) -> str:
    return " ".join(value.split())


def _capitalizar(token: str) -> str:
    # apóstrofo e hífen iniciam nova palavra: D'Ávila, Maria-Clara
    partes = re.split(r"(['’-])", token)
    return "".join(
        p if p in ("'", "’", "-") else p[:1].upper() + p[1:].lower() for p in partes
    )


def normalize_name(raw: Optional[str]) -> str:
    """
    Reformata em Title Case só quando o nome veio todo em maiúsculas ou todo em
    minúsculas; nome com caixa mista é preservado como veio.
    """
    name = collapse_spaces(raw or "")
    if not name or not (name.isupper() or name.islower()):
        return name
    tokens = name.split(" ")
    out = []
    for index, token in enumerate(tokens):
        if index > 0 and token.lower() in PARTICULAS:
            out.append(token.lower())
        else:
            out.append(_capitalizar(token))
    return " ".join(out)


def split_name(full_name: str) -> Optional[tuple[str, str]]:
    """first_name é o primeiro token; None se houver um só (FAB exige last_name)."""
    tokens = full_name.split()
    if len(tokens) < 2:
        return None
    return tokens[0], " ".join(tokens[1:])


def validate_name(raw: Optional[str]) -> tuple[str, str, str, Optional[str]]:
    """Devolve (nome_normalizado, first_name, last_name, motivo)."""
    name = normalize_name(raw)
    if not name:
        return "", "", "", Reason.campo_obrigatorio("nome")
    parts = split_name(name)
    if parts is None:
        return name, name, "", Reason.NOME_INCOMPLETO
    first, last = parts
    if len(first) > MAX_NAME_PART_LEN or len(last) > MAX_NAME_PART_LEN:
        return name, first, last, Reason.NOME_MUITO_LONGO
    return name, first, last, None


def normalize_username(raw: Optional[str]) -> tuple[str, Optional[str]]:
    """
    Username sempre como texto, zeros preservados. CPF formatado perde a
    pontuação. Devolve (username, motivo).
    """
    value = (raw or "").strip()
    if not value:
        return "", Reason.campo_obrigatorio("usuario")
    if _CPF_FORMATADO.fullmatch(value):
        value = value.replace(".", "").replace("-", "")
    if len(value) > MAX_USERNAME_LEN or not _USERNAME_VALIDO.fullmatch(value):
        return value, Reason.USERNAME_INVALIDO
    return value, None


def canonical_key(username: str) -> str:
    """
    Chave para achar o mesmo CPF com e sem zeros à esquerda. Minúsculas porque
    o login do FAB compara sem diferenciar caixa (AUTH_USERNAME_CI).
    """
    lowered = username.lower()
    stripped = lowered.lstrip("0")
    return stripped or ("0" if lowered else "")


def normalize_email(raw: Optional[str]) -> tuple[str, Optional[str]]:
    from email_validator import EmailNotValidError, validate_email

    value = (raw or "").strip().lower()
    if not value:
        return "", Reason.campo_obrigatorio("email")
    if len(value) > MAX_EMAIL_LEN:
        return value, Reason.EMAIL_INVALIDO
    try:
        validate_email(value, check_deliverability=False)
    except EmailNotValidError:
        return value, Reason.EMAIL_INVALIDO
    return value, None


@dataclass(frozen=True)
class PasswordResult:
    password: Optional[Secret]
    normalized: bool
    reason: Optional[str]


def normalize_password(
    raw: Any,
    min_length: int = 8,
    complexity_check: Optional[Callable[[str], bool]] = None,
) -> PasswordResult:
    """
    NFKD sem marcas combinantes (acento some) e exige ASCII imprimível. O motivo
    devolvido nunca inclui trecho da senha.
    """
    if raw is None or not str(raw):
        return PasswordResult(None, False, Reason.SENHA_INVALIDA)
    original = str(raw)
    if original != original.strip():
        return PasswordResult(None, False, Reason.SENHA_INVALIDA)
    decomposed = unicodedata.normalize("NFKD", original)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    if not all(0x20 <= ord(c) <= 0x7E for c in stripped):
        return PasswordResult(None, False, Reason.SENHA_INVALIDA)
    if not min_length <= len(stripped) <= MAX_PASSWORD_LEN:
        return PasswordResult(None, False, Reason.SENHA_INVALIDA)
    if complexity_check is not None and not complexity_check(stripped):
        return PasswordResult(None, False, Reason.SENHA_INVALIDA)
    return PasswordResult(Secret(stripped), stripped != original, None)


def sanitize_csv_cell(value: Any) -> str:
    """
    Defesa contra CSV injection: célula que o Excel leria como fórmula ganha
    prefixo apóstrofo, inclusive quando há espaços antes do gatilho.
    """
    text = "" if value is None else str(value)
    if text and (text[0] in "\t\r" or text.lstrip().startswith(_PREFIXOS_FORMULA)):
        return "'" + text
    return text
