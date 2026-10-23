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
from pathlib import Path

PORTAL_ROOT = Path(__file__).resolve().parents[3] / "superset" / "extensions" / "portal"


def test_portal_subpackages_have_init() -> None:
    """
    Diretorio sem __init__.py nao entra na instalacao nao editavel (a imagem
    instala o pacote em site-packages), e o import falha so em runtime.
    """
    missing = [
        str(directory.relative_to(PORTAL_ROOT))
        for directory in PORTAL_ROOT.rglob("*")
        if directory.is_dir()
        and directory.name != "__pycache__"
        and any(directory.glob("*.py"))
        and not (directory / "__init__.py").exists()
    ]

    assert not missing, f"Subpacotes do portal sem __init__.py: {missing}"


def test_user_import_package_is_complete() -> None:
    """
    O nucleo da importacao de usuarios precisa de __init__.py em services e em
    services/user_import, senao o import falha so na imagem instalada.
    """
    services = PORTAL_ROOT / "services"
    user_import = services / "user_import"
    assert (services / "__init__.py").is_file()
    assert (user_import / "__init__.py").is_file()
    expected = {
        "models.py",
        "normalize.py",
        "parser.py",
        "planner.py",
        "executor.py",
        "token.py",
        "fab_repository.py",
    }
    present = {p.name for p in user_import.glob("*.py")}
    assert expected <= present, f"Faltam modulos em user_import: {expected - present}"
