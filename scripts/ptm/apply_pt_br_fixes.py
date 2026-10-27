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
"""Re-apply the PTM pt_BR corrections to the upstream catalog.

Usage, from the repository root, after syncing with upstream:

    python scripts/ptm/apply_pt_br_fixes.py

Only the entries listed in pt_br_fixes.py change: their msgstr is replaced and
the fuzzy flag removed. Every other line of messages.po stays byte-for-byte,
so the diff against upstream stays small. The script fails, without writing,
when a msgid is missing from the catalog or a placeholder does not match.

ADDITIONS holds the fork's own msgids, which upstream does not have: the ones
missing from the catalog are appended at the end, the ones already there are
rewritten like FIXES, so the script stays idempotent.
"""

from __future__ import annotations

import io
import re
import sys
from pathlib import Path

from babel.messages.pofile import read_po

sys.path.insert(0, str(Path(__file__).parent))
from pt_br_fixes import ADDITIONS, FIXES  # noqa: E402

PO_PATH = Path("superset/translations/pt_BR/LC_MESSAGES/messages.po")
PLACEHOLDER = re.compile(r"%\([a-zA-Z_]+\)[sd]|%[sd]|\{\{[^}]+\}\}")


def placeholders(text: str) -> list[str]:
    return sorted(PLACEHOLDER.findall(text))


def escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\t", "\\t")
        .replace("\n", "\\n")
    )


def po_lines(keyword: str, text: str) -> list[str]:
    if "\n" not in text.rstrip("\n"):
        return [f'{keyword} "{escape(text)}"']
    parts = text.splitlines(keepends=True)
    return [f'{keyword} ""'] + [f'"{escape(part)}"' for part in parts]


def check(msgid: str, msgid_plural: str | None, new: str | list[str]) -> str | None:
    if msgid_plural is None:
        if isinstance(new, list):
            return "singular entry got plural forms"
        if placeholders(msgid) != placeholders(new):
            return f"placeholders differ: {new!r}"
        return None
    if not isinstance(new, list) or len(new) != 2:
        return "plural entry needs [singular, plural]"
    if placeholders(new[0]) not in (placeholders(msgid), placeholders(msgid_plural)):
        return f"singular placeholders differ: {new[0]!r}"
    if placeholders(new[1]) != placeholders(msgid_plural):
        return f"plural placeholders differ: {new[1]!r}"
    return None


def rewrite(block: str, new: str | list[str]) -> str:
    lines = block.split("\n")
    first_msg = next(
        i for i, line in enumerate(lines) if line.startswith(("msgctxt ", "msgid "))
    )
    first_str = next(i for i, line in enumerate(lines) if line.startswith("msgstr"))
    head: list[str] = []
    for line in lines[:first_msg]:
        if line.startswith("#|"):
            continue
        if line.startswith("#,"):
            flags = [f.strip() for f in line[2:].split(",")]
            flags = [f for f in flags if f and f != "fuzzy"]
            if flags:
                head.append("#, " + ", ".join(flags))
            continue
        head.append(line)
    if isinstance(new, list):
        msgstr = po_lines("msgstr[0]", new[0]) + po_lines("msgstr[1]", new[1])
    else:
        msgstr = po_lines("msgstr", new)
    return "\n".join(head + lines[first_msg:first_str] + msgstr)


def main() -> int:
    text = PO_PATH.read_text(encoding="utf-8")
    trailing_newline = text.endswith("\n")
    blocks = text.rstrip("\n").split("\n\n")
    seen: set[str] = set()
    errors: list[str] = []
    out: list[str] = []
    for block in blocks:
        if not re.search(r"^msgid ", block, re.M):
            out.append(block)
            continue
        messages = [m for m in read_po(io.StringIO(block + "\n")) if m.id]
        if not messages:
            out.append(block)
            continue
        message = messages[0]
        msgid = message.id[0] if isinstance(message.id, tuple) else message.id
        msgid_plural = message.id[1] if isinstance(message.id, tuple) else None
        if msgid not in FIXES and msgid not in ADDITIONS:
            out.append(block)
            continue
        seen.add(msgid)
        new = FIXES[msgid] if msgid in FIXES else ADDITIONS[msgid]
        if error := check(msgid, msgid_plural, new):
            errors.append(f"{msgid!r}: {error}")
            out.append(block)
            continue
        out.append(rewrite(block, new))

    errors += [f"{m!r}: not found in the catalog" for m in sorted(set(FIXES) - seen)]
    appended = 0
    for msgid in ADDITIONS:
        if msgid in seen or msgid in FIXES:
            continue
        new = ADDITIONS[msgid]
        error = check(msgid, None, new)
        if error or not isinstance(new, str):
            errors.append(f"{msgid!r}: {error or 'singular entry got plural forms'}")
            continue
        out.append("\n".join(po_lines("msgid", msgid) + po_lines("msgstr", new)))
        appended += 1
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    PO_PATH.write_text(
        "\n\n".join(out) + ("\n" if trailing_newline else ""), encoding="utf-8"
    )
    print(f"{len(seen)} pt_BR entries applied, {appended} appended")
    return 0


if __name__ == "__main__":
    sys.exit(main())
