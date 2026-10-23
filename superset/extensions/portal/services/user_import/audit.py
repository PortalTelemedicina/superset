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
"""Montagem do payload de auditoria sem PII em texto claro."""

from __future__ import annotations

from typing import Any, Iterable

from superset.extensions.portal.services.user_import.models import (
    RowResult,
    Status,
)

# Nomes que colidem com parâmetros de log_context/log_with_context do event_logger;
# se virassem kwargs, o log levantaria TypeError ou perderia a action.
RESERVED_LOG_KEYS = frozenset(
    {"self", "action", "duration", "object_ref", "log_to_statsd", "database"}
)

# Só o que precisa de atenção do operador vai para o log; criados e a criar ficam
# nas contagens do summary.
_AUDITED_STATUSES = frozenset({Status.SEGURADA, Status.FALHA})


def mask_username(username: str) -> str:
    """Mantém 3 caracteres no início e 2 no fim; o resto vira asterisco."""
    if len(username) <= 5:
        return "*" * len(username)
    return f"{username[:3]}{'*' * (len(username) - 5)}{username[-2:]}"


def audit_rows(results: Iterable[RowResult], dry_run: bool) -> list[dict[str, Any]]:
    """Linhas não ok com username mascarado. O dry-run não grava linha alguma."""
    if dry_run:
        return []
    return [
        {
            "line": row.line,
            "username": mask_username(row.username),
            "status": row.status.value,
            "reason": row.reason,
        }
        for row in results
        if row.status in _AUDITED_STATUSES
    ]


def extra_field_payload(names: Iterable[str]) -> dict[str, Any]:
    """
    Campos fora do contrato: os nomes vão numa única chave e os valores que o
    event_logger despeja do request são zerados, exceto nomes reservados do logger.
    """
    unique = sorted(set(names))
    payload: dict[str, Any] = {
        name: None for name in unique if name not in RESERVED_LOG_KEYS
    }
    if unique:
        payload["ignored_fields"] = unique
    return payload
