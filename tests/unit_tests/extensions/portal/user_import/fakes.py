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
"""Dublês em memória do UserRepository para os testes do núcleo."""

from __future__ import annotations

from typing import Collection, Optional, Sequence

from superset.extensions.portal.services.user_import.models import (
    ExistingUser,
    RawRow,
    UserCreationError,
)
from superset.extensions.portal.services.user_import.normalize import canonical_key


class FakeRepo:
    def __init__(
        self,
        users: Optional[Sequence[ExistingUser]] = None,
        roles: Collection[str] = ("Gamma", "Alpha", "Admin", "sql_lab"),
        fail_usernames: Collection[str] = (),
        race_usernames: Collection[str] = (),
    ) -> None:
        self.users = list(users or [])
        self.roles = set(roles)
        self.fail_usernames = set(fail_usernames)
        self.race_usernames = set(race_usernames)
        self.created: list[dict[str, str]] = []
        self.create_attempts = 0

    def find_by_username_keys(self, keys: Collection[str]) -> Sequence[ExistingUser]:
        return [u for u in self.users if canonical_key(u.username) in set(keys)]

    def find_by_emails(self, emails: Collection[str]) -> Sequence[ExistingUser]:
        return [u for u in self.users if (u.email or "").lower() in set(emails)]

    def role_exists(self, name: str) -> bool:
        return name in self.roles

    def create_user(self, **kwargs: str) -> None:
        self.create_attempts += 1
        username = kwargs["username"]
        if username in self.race_usernames:
            self.users.append(ExistingUser(username, kwargs["email"], True))
            raise UserCreationError("corrida")
        if username in self.fail_usernames:
            raise UserCreationError("falha")
        self.created.append(dict(kwargs))
        self.users.append(ExistingUser(username, kwargs["email"], True))


def user(
    username: str, email: Optional[str] = None, active: bool = True
) -> ExistingUser:
    return ExistingUser(username, email, active)


def row(
    line: int,
    nome: str = "Maria da Silva",
    usuario: str = "01234567890",
    senha: str = "Senha1234",
    email: Optional[str] = None,
    role: str = "",
) -> RawRow:
    return RawRow(
        line=line,
        nome=nome,
        usuario=usuario,
        senha=senha,
        email=email if email is not None else f"u{line}@ptm.com.br",
        role=role,
    )
