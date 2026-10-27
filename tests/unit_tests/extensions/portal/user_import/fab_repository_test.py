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
"""
Testa o adaptador só com dublês do SecurityManager. As consultas SQL
(find_by_username_keys e find_by_emails com dados) precisam de FAB e SQLAlchemy
reais e ficam para o teste de integração.
"""

from types import SimpleNamespace
from typing import Any

import pytest

from superset.extensions.portal.services.user_import.fab_repository import (
    FabUserRepository,
)
from superset.extensions.portal.services.user_import.models import UserCreationError


class FakeSecurityManager:
    def __init__(self, roles: dict[str, Any], add_user_result: Any = True) -> None:
        self.roles = roles
        self.add_user_result = add_user_result
        self.calls: list[dict[str, Any]] = []

    def find_role(self, name: str) -> Any:
        return self.roles.get(name)

    def add_user(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        return self.add_user_result


KW = {
    "username": "01234567890",
    "first_name": "Maria",
    "last_name": "da Silva",
    "email": "m@ptm.com.br",
    "role": "Gamma",
    "password": "SegredoUnico77",
}


def test_role_exists() -> None:
    repo = FabUserRepository(FakeSecurityManager({"Gamma": object()}))
    assert repo.role_exists("Gamma") is True
    assert repo.role_exists("Nada") is False


def test_create_user_passa_objeto_role_e_dados_ao_add_user() -> None:
    role = SimpleNamespace(name="Gamma")
    sm = FakeSecurityManager({"Gamma": role})
    FabUserRepository(sm).create_user(**KW)
    assert sm.calls == [
        {
            "username": "01234567890",
            "first_name": "Maria",
            "last_name": "da Silva",
            "email": "m@ptm.com.br",
            "role": role,
            "password": "SegredoUnico77",
        }
    ]


def test_add_user_false_vira_excecao_generica_sem_senha() -> None:
    sm = FakeSecurityManager({"Gamma": object()}, add_user_result=False)
    with pytest.raises(UserCreationError) as exc:
        FabUserRepository(sm).create_user(**KW)
    texto = str(exc.value) + repr(exc.value)
    assert "SegredoUnico77" not in texto
    assert "01234567890" not in texto


def test_role_inexistente_nao_chama_add_user() -> None:
    sm = FakeSecurityManager({})
    with pytest.raises(UserCreationError):
        FabUserRepository(sm).create_user(**KW)
    assert sm.calls == []


def test_consultas_vazias_nao_tocam_o_banco() -> None:
    repo = FabUserRepository(object())
    assert repo.find_by_username_keys([]) == []
    assert repo.find_by_emails([]) == []
