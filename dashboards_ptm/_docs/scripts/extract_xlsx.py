#!/usr/bin/env python3
"""Extract text rows from an xlsx file (stdout). Used by dashboard agent skills."""

from __future__ import annotations

import sys
import zipfile
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def extract(path: str) -> None:
    with zipfile.ZipFile(path) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall("m:si", NS):
                shared.append(
                    "".join(
                        t.text or ""
                        for t in si.iter(
                            "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"
                        )
                    )
                )
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        sheets = wb.find("m:sheets", NS)
        assert sheets is not None
        for idx, sheet in enumerate(sheets, start=1):
            name = sheet.get("name", f"sheet{idx}")
            print(f"\n===== {name} =====")
            root = ET.fromstring(z.read(f"xl/worksheets/sheet{idx}.xml"))
            for row in root.iter(
                "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"
            ):
                cells: list[str] = []
                for cell in row.iter(
                    "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"
                ):
                    v = cell.find("m:v", NS)
                    if v is None:
                        continue
                    cells.append(
                        shared[int(v.text)]
                        if cell.get("t") == "s"
                        else str(v.text)
                    )
                line = " | ".join(c.replace("\n", " / ") for c in cells if c.strip())
                if line:
                    print(line)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <file.xlsx>", file=sys.stderr)
        sys.exit(1)
    extract(sys.argv[1])
