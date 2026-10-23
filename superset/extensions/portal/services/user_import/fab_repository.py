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
"""Adaptador do UserRepository sobre o SecurityManager do FAB."""

from __future__ import annotations

from typing import Any, Collection, Sequence

from superset.extensions.portal.services.user_import.models import (
    ExistingUser,
    UserCreationError,
)


class FabUserRepository:
    """
    Consulta o modelo direto: find_user devolve None se houver duplicata e não
    enxerga variação de zeros. O add_user do FAB faz commit e rollback próprios
    e devolve False sem a causa, então cada usuário é um commit.
    """

    def __init__(self, security_manager: Any) -> None:
        self._sm = security_manager

    def find_by_username_keys(self, keys: Collection[str]) -> Sequence[ExistingUser]:
        if not keys:
            return []
        from sqlalchemy import func, or_

        model = self._sm.user_model
        # o LIKE só reduz o universo; o planner confere a chave canônica exata
        conditions = [func.lower(model.username).like(f"%{key}") for key in keys]
        users = self._sm.session.query(model).filter(or_(*conditions)).all()
        return [self._existing(u) for u in users]

    def find_by_emails(self, emails: Collection[str]) -> Sequence[ExistingUser]:
        if not emails:
            return []
        from sqlalchemy import func

        model = self._sm.user_model
        users = (
            self._sm.session.query(model)
            .filter(func.lower(model.email).in_(list(emails)))
            .all()
        )
        return [self._existing(u) for u in users]

    def role_exists(self, name: str) -> bool:
        return self._sm.find_role(name) is not None

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
        role_obj = self._sm.find_role(role)
        if role_obj is None:
            raise UserCreationError("role inexistente")
        created = self._sm.add_user(
            username=username,
            first_name=first_name,
            last_name=last_name,
            email=email,
            role=role_obj,
            password=password,
        )
        if not created:
            raise UserCreationError("add_user não criou o usuário")

    @staticmethod
    def _existing(user: Any) -> ExistingUser:
        return ExistingUser(
            username=user.username, email=user.email, active=bool(user.active)
        )
