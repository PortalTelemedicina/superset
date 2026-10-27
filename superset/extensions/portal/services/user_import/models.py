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
"""Modelos do núcleo de importação de usuários (sem Flask, FAB ou superset)."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Collection, Optional, Protocol, Sequence


class Secret:
    """
    Guarda uma senha de forma que repr, str, format e asdict nunca a exponham.
    O valor só sai por reveal(), chamado apenas na criação do usuário.
    """

    __slots__ = ("_value",)

    def __init__(self, value: str) -> None:
        self._value = value

    def reveal(self) -> str:
        return self._value

    def __repr__(self) -> str:
        return "Secret(<oculta>)"

    __str__ = __repr__

    def __format__(self, spec: str) -> str:
        return "<oculta>"

    def __bool__(self) -> bool:
        return bool(self._value)

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Secret) and self._value == other._value

    def __hash__(self) -> int:
        return hash(self._value)

    # copy e deepcopy (usados por dataclasses.asdict) devolvem a mesma instância
    def __copy__(self) -> Secret:
        return self

    def __deepcopy__(self, memo: dict[int, Any]) -> Secret:
        return self


class Status(str, Enum):
    CRIAR = "criar"
    CRIADO = "criado"
    JA_EXISTE = "ja_existe"
    SEGURADA = "segurada"
    FALHA = "falha"


class Reason:
    """Códigos estáveis de motivo; o front traduz por mapa."""

    DUPLICADO_USERNAME = "duplicado_no_arquivo_username"
    DUPLICADO_EMAIL = "duplicado_no_arquivo_email"
    EXISTE_USERNAME = "existe_username"
    EXISTE_SEM_ZERO = "existe_sem_zero_a_esquerda"
    EXISTE_EMAIL = "existe_email"
    EXISTE_INATIVO = "existe_inativo"
    CONFLITO_VARIOS = "conflito_com_varios_existentes"
    EMAIL_INVALIDO = "email_invalido"
    SENHA_INVALIDA = "senha_invalida"
    ROLE_INVALIDA = "role_invalida"
    ROLE_NAO_PERMITIDA = "role_nao_permitida"
    NOME_INCOMPLETO = "nome_incompleto"
    USERNAME_INVALIDO = "username_invalido"
    CELULA_LONGA = "celula_muito_longa"
    NOME_MUITO_LONGO = "nome_muito_longo"
    ERRO_CRIACAO = "erro_criacao"

    @staticmethod
    def campo_obrigatorio(campo: str) -> str:
        return f"campo_obrigatorio:{campo}"


WARNING_USERNAME_NUMERICO_XLSX = "username_numerico_xlsx"

# Limites reais das colunas do FAB (first_name/last_name 64, username 128, email 320)
MAX_USERNAME_LEN = 128
MAX_NAME_PART_LEN = 64
MAX_EMAIL_LEN = 320
MAX_PASSWORD_LEN = 128
MAX_CELL_LEN = 1000


@dataclass(frozen=True)
class RawRow:
    """Linha como veio do arquivo, já como texto. `line` é a linha física."""

    line: int
    nome: str = ""
    usuario: str = ""
    senha: Any = field(default="", repr=False)
    email: str = ""
    role: str = ""
    celula_longa: bool = False

    def __post_init__(self) -> None:
        if not isinstance(self.senha, Secret):
            object.__setattr__(self, "senha", Secret(self.senha or ""))


@dataclass(frozen=True)
class ParsedFile:
    rows: tuple[RawRow, ...]
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class ExistingUser:
    username: str
    email: Optional[str]
    active: bool


@dataclass(frozen=True)
class RowResult:
    line: int
    username: str
    status: Status
    reason: Optional[str] = None
    email: str = ""
    first_name: str = ""
    last_name: str = ""
    role: Optional[str] = None
    senha_normalizada: bool = False
    existing_username: Optional[str] = None
    related_lines: tuple[int, ...] = ()
    secondary_reasons: tuple[str, ...] = ()
    # fica fora de repr/asdict da API: só o executor lê, via reveal()
    password: Optional[Secret] = field(default=None, repr=False, compare=False)

    def to_preview_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "line": self.line,
            "username": self.username,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "role": self.role,
            "status": self.status.value,
            "reason": self.reason,
            "senha_normalizada": self.senha_normalizada,
        }
        if self.existing_username is not None:
            data["existing_username"] = self.existing_username
        if self.related_lines:
            data["related_lines"] = list(self.related_lines)
        if self.secondary_reasons:
            data["secondary_reasons"] = list(self.secondary_reasons)
        return data

    def to_report_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "line": self.line,
            "username": self.username,
            "status": self.status.value,
            "reason": self.reason,
        }
        if self.existing_username is not None:
            data["existing_username"] = self.existing_username
        return data


@dataclass(frozen=True)
class ImportSummary:
    total: int = 0
    criar: int = 0
    criado: int = 0
    ja_existe: int = 0
    segurada: int = 0
    falha: int = 0

    @classmethod
    def from_rows(cls, rows: Sequence[RowResult]) -> ImportSummary:
        counts = {s: 0 for s in Status}
        for row in rows:
            counts[row.status] += 1
        return cls(
            total=len(rows),
            criar=counts[Status.CRIAR],
            criado=counts[Status.CRIADO],
            ja_existe=counts[Status.JA_EXISTE],
            segurada=counts[Status.SEGURADA],
            falha=counts[Status.FALHA],
        )

    def to_dict(self, executado: bool = False) -> dict[str, int]:
        data = {"total": self.total, "criar": self.criar}
        if executado:
            data["criado"] = self.criado
        data.update(
            {
                "ja_existe": self.ja_existe,
                "segurada": self.segurada,
                "falha": self.falha,
            }
        )
        return data


@dataclass(frozen=True)
class ImportPlan:
    default_role: str
    rows: tuple[RowResult, ...]
    warnings: tuple[str, ...] = ()

    @property
    def summary(self) -> ImportSummary:
        return ImportSummary.from_rows(self.rows)


@dataclass(frozen=True)
class ImportExecution:
    audit_id: str
    default_role: str
    rows: tuple[RowResult, ...]
    warnings: tuple[str, ...] = ()

    @property
    def summary(self) -> ImportSummary:
        return ImportSummary.from_rows(self.rows)


class UserCreationError(Exception):
    """Falha genérica na gravação; nunca carrega valores do usuário."""


class InvalidDefaultRole(ValueError):  # noqa: N818
    """Role padrão inexistente ou barrada. `reason` é um código de Reason."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class UserRepository(Protocol):
    """Acesso ao cadastro de usuários; o adaptador FAB implementa."""

    def find_by_username_keys(self, keys: Collection[str]) -> Sequence[ExistingUser]:
        """
        Usuários cujo username canônico (minúsculas, sem zeros à esquerda) está
        em `keys`. O chamador filtra de novo, então devolver a mais é seguro.
        """

    def find_by_emails(self, emails: Collection[str]) -> Sequence[ExistingUser]:
        """Usuários cujo e-mail em minúsculas está em `emails`."""

    def role_exists(self, name: str) -> bool: ...

    def create_user(
        self,
        *,
        username: str,
        first_name: str,
        last_name: str,
        email: str,
        role: str,
        password: str,
    ) -> None:
        """Cria e persiste um usuário; levanta UserCreationError se falhar."""
