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
"""Token de plano: prova no servidor que o commit veio depois de um dry-run."""

from __future__ import annotations

import hashlib
import hmac
from typing import Any, Union

from itsdangerous import BadSignature, URLSafeTimedSerializer

SALT = "ptm-user-import-plan"
DEFAULT_TTL_SECONDS = 900


def file_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _serializer(secret_key: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret_key, salt=SALT)


def issue_plan_token(
    secret_key: str,
    user_id: Union[int, str],
    file_hash: str,
    default_role: str,
) -> str:
    payload = {"u": str(user_id), "h": file_hash, "r": default_role}
    return _serializer(secret_key).dumps(payload)


def validate_plan_token(
    token: Any,
    secret_key: str,
    user_id: Union[int, str],
    file_hash: str,
    default_role: str,
    max_age: int = DEFAULT_TTL_SECONDS,
) -> bool:
    """False para token ausente, adulterado, expirado ou de outro arquivo/usuário."""
    if not token or not isinstance(token, str):
        return False
    try:
        payload = _serializer(secret_key).loads(token, max_age=max_age)
    except BadSignature:
        return False
    if not isinstance(payload, dict):
        return False
    expected = {"u": str(user_id), "h": file_hash, "r": default_role}
    return all(
        isinstance(payload.get(k), str) and hmac.compare_digest(payload[k], v)
        for k, v in expected.items()
    )
