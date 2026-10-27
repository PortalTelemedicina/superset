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
"""Execução da importação: cria só o que o plano marcou como `criar`."""

from __future__ import annotations

import logging
import uuid
from dataclasses import replace
from typing import Callable, Collection, Optional, Sequence

from superset.extensions.portal.services.user_import.models import (
    ImportExecution,
    ImportPlan,
    RawRow,
    Reason,
    RowResult,
    Status,
    UserRepository,
)
from superset.extensions.portal.services.user_import.planner import (
    classify_existing,
    plan_import,
)

logger = logging.getLogger(__name__)


def _create_row(row: RowResult, repo: UserRepository, audit_id: str) -> RowResult:
    if row.password is None or row.role is None:
        return replace(row, status=Status.FALHA, reason=Reason.ERRO_CRIACAO)
    try:
        repo.create_user(
            username=row.username,
            first_name=row.first_name,
            last_name=row.last_name,
            email=row.email,
            role=row.role,
            password=row.password.reveal(),
        )
    except Exception as ex:
        # só o tipo vai pro log: a mensagem da exceção não é confiável quanto a dados
        logger.warning(
            "user_import: falha ao criar usuário audit_id=%s line=%s erro=%s",
            audit_id,
            row.line,
            type(ex).__name__,
        )
        return _classify_failure(row, repo, audit_id)
    return replace(row, status=Status.CRIADO, reason=None)


def _classify_failure(row: RowResult, repo: UserRepository, audit_id: str) -> RowResult:
    """O add_user do FAB engole a causa; relê o banco para separar corrida de falha."""
    try:
        outcome = classify_existing(row.username, row.email, repo)
    except Exception as ex:
        logger.warning(
            "user_import: releitura falhou audit_id=%s line=%s erro=%s",
            audit_id,
            row.line,
            type(ex).__name__,
        )
        outcome = None
    if outcome is None:
        return replace(row, status=Status.FALHA, reason=Reason.ERRO_CRIACAO)
    status, reason, existing = outcome
    return replace(row, status=status, reason=reason, existing_username=existing)


def execute_plan(
    plan: ImportPlan, repo: UserRepository, audit_id: Optional[str] = None
) -> ImportExecution:
    """Uma linha por vez; o commit por linha é do repositório."""
    audit_id = audit_id or str(uuid.uuid4())
    rows = tuple(
        replace(
            _create_row(row, repo, audit_id) if row.status is Status.CRIAR else row,
            password=None,
        )
        for row in plan.rows
    )
    return ImportExecution(
        audit_id=audit_id,
        default_role=plan.default_role,
        rows=rows,
        warnings=plan.warnings,
    )


def execute_import(
    rows: Sequence[RawRow],
    repo: UserRepository,
    default_role: str,
    allowed_roles: Optional[Collection[str]] = None,
    min_password_len: int = 8,
    complexity_check: Optional[Callable[[str], bool]] = None,
    warnings: Sequence[str] = (),
    audit_id: Optional[str] = None,
) -> ImportExecution:
    """
    Recalcula o plano com o banco de agora (não confia no preview) e executa.
    Reexecutar o mesmo arquivo devolve ja_existe em tudo.
    """
    plan = plan_import(
        rows,
        repo,
        default_role,
        allowed_roles=allowed_roles,
        min_password_len=min_password_len,
        complexity_check=complexity_check,
        warnings=warnings,
    )
    return execute_plan(plan, repo, audit_id=audit_id)
