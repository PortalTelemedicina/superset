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
"""Planejamento da importação: valida, detecta duplicidade e usuários existentes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Collection, Optional, Sequence

from superset.extensions.portal.services.user_import.models import (
    ExistingUser,
    ImportPlan,
    InvalidDefaultRole,
    RawRow,
    Reason,
    RowResult,
    Secret,
    Status,
    UserRepository,
)
from superset.extensions.portal.services.user_import.normalize import (
    canonical_key,
    normalize_email,
    normalize_password,
    normalize_username,
    validate_name,
)

ROLE_BARRADA = "admin"


@dataclass
class _Row:
    raw: RawRow
    username: str = ""
    key: str = ""
    email: str = ""
    first_name: str = ""
    last_name: str = ""
    role: Optional[str] = None
    password: Optional[Secret] = None
    senha_normalizada: bool = False
    reason: Optional[str] = None
    username_ok: bool = False
    email_ok: bool = False


def role_blocker(role: str, allowed_roles: Optional[Collection[str]]) -> Optional[str]:
    """
    Admin é barrada sempre (sem diferenciar caixa). Allowlist vazia significa
    todas exceto Admin; preenchida, só as listadas.
    """
    if role.strip().casefold() == ROLE_BARRADA:
        return Reason.ROLE_NAO_PERMITIDA
    if allowed_roles and role not in allowed_roles:
        return Reason.ROLE_NAO_PERMITIDA
    return None


def _validate_row(
    raw: RawRow,
    default_role: str,
    allowed_roles: Optional[Collection[str]],
    role_exists: Callable[[str], bool],
    min_password_len: int,
    complexity_check: Optional[Callable[[str], bool]],
) -> _Row:
    row = _Row(raw=raw)
    problems: list[str] = []

    row.username, reason = normalize_username(raw.usuario)
    row.username_ok = reason is None
    if row.username_ok:
        row.key = canonical_key(row.username)
    elif reason:
        problems.append(reason)

    row.email, reason = normalize_email(raw.email)
    row.email_ok = reason is None
    if reason:
        problems.append(reason)

    _, row.first_name, row.last_name, reason = validate_name(raw.nome)
    if reason:
        problems.append(reason)

    result = normalize_password(raw.senha.reveal(), min_password_len, complexity_check)
    row.password, row.senha_normalizada = result.password, result.normalized
    if result.reason:
        problems.append(result.reason)

    requested = raw.role.strip()
    role = requested or default_role
    blocked = role_blocker(role, allowed_roles)
    if blocked:
        problems.append(blocked)
    elif not role_exists(role):
        problems.append(Reason.ROLE_INVALIDA)
    else:
        row.role = role

    if raw.celula_longa:
        problems.insert(0, Reason.CELULA_LONGA)
    row.reason = problems[0] if problems else None
    return row


class _UnionFind:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))

    def find(self, item: int) -> int:
        while self.parent[item] != item:
            self.parent[item] = self.parent[self.parent[item]]
            item = self.parent[item]
        return item

    def union(self, a: int, b: int) -> None:
        self.parent[self.find(a)] = self.find(b)


def _find_duplicates(rows: Sequence[_Row]) -> dict[int, tuple[str, tuple[int, ...]]]:
    """Índice da linha -> (motivo, linhas do grupo). Só grupos com mais de uma linha."""
    by_key: dict[str, list[int]] = {}
    by_email: dict[str, list[int]] = {}
    for index, row in enumerate(rows):
        if row.username_ok:
            by_key.setdefault(row.key, []).append(index)
        if row.email_ok:
            by_email.setdefault(row.email, []).append(index)

    uf = _UnionFind(len(rows))
    shares_username: set[int] = set()
    shares_email: set[int] = set()
    for members in by_key.values():
        if len(members) > 1:
            shares_username.update(members)
            for other in members[1:]:
                uf.union(members[0], other)
    for members in by_email.values():
        if len(members) > 1:
            shares_email.update(members)
            for other in members[1:]:
                uf.union(members[0], other)

    groups: dict[int, list[int]] = {}
    for index in shares_username | shares_email:
        groups.setdefault(uf.find(index), []).append(index)

    result: dict[int, tuple[str, tuple[int, ...]]] = {}
    for members in groups.values():
        lines = tuple(sorted(rows[i].raw.line for i in members))
        for index in members:
            reason = (
                Reason.DUPLICADO_USERNAME
                if index in shares_username
                else Reason.DUPLICADO_EMAIL
            )
            result[index] = (reason, lines)
    return result


def _existing_hits(
    row: _Row,
    by_key: dict[str, list[ExistingUser]],
    by_email: dict[str, list[ExistingUser]],
) -> tuple[list[ExistingUser], dict[str, str]]:
    """Usuários do banco que casam com a linha e o motivo de cada acerto."""
    hits: dict[str, ExistingUser] = {}
    reasons: dict[str, str] = {}
    if row.username_ok:
        for user in by_key.get(row.key, []):
            ident = user.username.lower()
            hits[ident] = user
            exact = ident == row.username.lower()
            reasons[ident] = Reason.EXISTE_USERNAME if exact else Reason.EXISTE_SEM_ZERO
    if row.email_ok:
        for user in by_email.get(row.email, []):
            ident = user.username.lower()
            hits[ident] = user
            reasons.setdefault(ident, Reason.EXISTE_EMAIL)
    return list(hits.values()), reasons


def _db_outcome(
    hits: list[ExistingUser], reasons: dict[str, str], email_matches: int
) -> Optional[tuple[Status, str, Optional[str]]]:
    """(status, motivo, existing_username) do banco, ou None se nada casou."""
    if not hits:
        return None
    if len(hits) > 1 or email_matches > 1:
        return Status.SEGURADA, Reason.CONFLITO_VARIOS, None
    user = hits[0]
    if not user.active:
        return Status.SEGURADA, Reason.EXISTE_INATIVO, user.username
    reason = reasons[user.username.lower()]
    return Status.JA_EXISTE, reason, user.username


def classify_existing(
    username: str, email: str, repo: UserRepository
) -> Optional[tuple[Status, str, Optional[str]]]:
    """Reconsulta o banco para uma linha; usado pelo executor depois de falha."""
    key = canonical_key(username) if username else ""
    by_key: dict[str, list[ExistingUser]] = {}
    for user in repo.find_by_username_keys([key] if key else []):
        by_key.setdefault(canonical_key(user.username), []).append(user)
    by_email: dict[str, list[ExistingUser]] = {}
    for user in repo.find_by_emails([email] if email else []):
        by_email.setdefault((user.email or "").lower(), []).append(user)
    row = _Row(
        raw=RawRow(line=0),
        username=username,
        key=key,
        email=email,
        username_ok=bool(key),
        email_ok=bool(email),
    )
    hits, reasons = _existing_hits(row, by_key, by_email)
    return _db_outcome(hits, reasons, len(by_email.get(email, [])))


def plan_import(
    rows: Sequence[RawRow],
    repo: UserRepository,
    default_role: str,
    allowed_roles: Optional[Collection[str]] = None,
    min_password_len: int = 8,
    complexity_check: Optional[Callable[[str], bool]] = None,
    warnings: Sequence[str] = (),
) -> ImportPlan:
    """
    Gera o plano sem gravar nada. Determinístico: mesmas linhas e mesmo banco
    dão o mesmo plano. Levanta InvalidDefaultRole se a role padrão não servir.
    """
    blocked = role_blocker(default_role, allowed_roles)
    if blocked:
        raise InvalidDefaultRole(blocked)

    role_cache: dict[str, bool] = {}

    def role_exists(name: str) -> bool:
        if name not in role_cache:
            role_cache[name] = repo.role_exists(name)
        return role_cache[name]

    if not role_exists(default_role):
        raise InvalidDefaultRole(Reason.ROLE_INVALIDA)

    checked = [
        _validate_row(
            raw, default_role, allowed_roles, role_exists, min_password_len,
            complexity_check,
        )
        for raw in rows
    ]
    duplicates = _find_duplicates(checked)

    keys = {r.key for r in checked if r.username_ok}
    emails = {r.email for r in checked if r.email_ok}
    by_key: dict[str, list[ExistingUser]] = {}
    for user in repo.find_by_username_keys(sorted(keys)) if keys else []:
        by_key.setdefault(canonical_key(user.username), []).append(user)
    by_email: dict[str, list[ExistingUser]] = {}
    for user in repo.find_by_emails(sorted(emails)) if emails else []:
        by_email.setdefault((user.email or "").lower(), []).append(user)

    results: list[RowResult] = []
    for index, row in enumerate(checked):
        hits, reasons = _existing_hits(row, by_key, by_email)
        db = _db_outcome(hits, reasons, len(by_email.get(row.email, [])) if row.email_ok else 0)

        status = Status.CRIAR
        reason: Optional[str] = None
        related: tuple[int, ...] = ()
        # prioridade: duplicidade no arquivo, validação, banco; o resto vira secundário
        candidates: list[tuple[Status, str]] = []
        if index in duplicates:
            dup_reason, related = duplicates[index]
            candidates.append((Status.SEGURADA, dup_reason))
        if row.reason:
            candidates.append((Status.SEGURADA, row.reason))
        if db:
            candidates.append((db[0], db[1]))
        if candidates:
            status, reason = candidates[0]
        secondary = [c[1] for c in candidates[1:]]
        existing = db[2] if db else None
        results.append(
            RowResult(
                line=row.raw.line,
                username=row.username,
                status=status,
                reason=reason,
                email=row.email,
                first_name=row.first_name,
                last_name=row.last_name,
                role=row.role,
                senha_normalizada=row.senha_normalizada,
                existing_username=existing,
                related_lines=related,
                secondary_reasons=tuple(secondary),
                password=row.password if status is Status.CRIAR else None,
            )
        )

    results.sort(key=lambda r: r.line)
    return ImportPlan(
        default_role=default_role, rows=tuple(results), warnings=tuple(warnings)
    )
