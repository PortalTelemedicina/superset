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
"""Schemas da API de importação de usuários. Nenhum campo carrega senha."""

from marshmallow import fields, Schema, validate

STATUS = ["criar", "criado", "ja_existe", "segurada", "falha"]


class UserImportRequestSchema(Schema):
    """Campos do multipart. O arquivo (`file`) vai como parte binária."""

    default_role = fields.String(required=True)
    dry_run = fields.String(validate=validate.OneOf(["true", "false"]))
    plan_token = fields.String()


class UserImportSummarySchema(Schema):
    total = fields.Integer(required=True)
    criar = fields.Integer(required=True)
    # só existe depois do commit
    criado = fields.Integer()
    ja_existe = fields.Integer(required=True)
    segurada = fields.Integer(required=True)
    falha = fields.Integer(required=True)


class UserImportRowSchema(Schema):
    line = fields.Integer(required=True)
    username = fields.String(required=True)
    status = fields.String(required=True, validate=validate.OneOf(STATUS))
    reason = fields.String(allow_none=True)
    # os campos abaixo só vêm no preview
    email = fields.String()
    first_name = fields.String()
    last_name = fields.String()
    role = fields.String(allow_none=True)
    senha_normalizada = fields.Boolean()
    existing_username = fields.String()
    related_lines = fields.List(fields.Integer())
    secondary_reasons = fields.List(fields.String())


class UserImportResultSchema(Schema):
    dry_run = fields.Boolean(required=True)
    summary = fields.Nested(UserImportSummarySchema, required=True)
    rows = fields.List(fields.Nested(UserImportRowSchema), required=True)
    warnings = fields.List(fields.String())
    default_role = fields.String()
    # dry-run
    plan_token = fields.String()
    expires_in = fields.Integer()
    # commit
    audit_id = fields.String()


class UserImportResponseSchema(Schema):
    result = fields.Nested(UserImportResultSchema, required=True)
