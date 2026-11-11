#!/usr/bin/env python3
"""Arma flujo.sdk.js (código del Workflow SDK de n8n) con los nodos Code de esta carpeta."""
import json
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SHEET_ID = "1ZgZPQ4ZqsbneZpZCueNY4c1iBy0MnQJQ7Y8qb2v3KQo"
t = (AQUI / "flujo.template.js").read_text(encoding="utf-8")
for marca, archivo in {"__PREPARAR__": "preparar_correos.js", "__REGISTRADO__": "marcar_registrado.js",
                       "__BAJA__": "baja.js", "__IMPORTAR__": "importar.js"}.items():
    t = t.replace(marca, "`" + (AQUI / archivo).read_text(encoding="utf-8") + "`")
assert all("`" not in (AQUI / a).read_text() and "${" not in (AQUI / a).read_text() and "\\" not in (AQUI / a).read_text() for a in ["preparar_correos.js","marcar_registrado.js","baja.js","importar.js"]), "sin backticks ni barras"
t = t.replace("__SHEET_ID__", SHEET_ID)
(AQUI / "flujo.sdk.js").write_text(t, encoding="utf-8")
print("ok", len(t))
