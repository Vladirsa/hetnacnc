"""Vista previa gratuita: una sola foto -> malla aproximada con TripoSR
(VAST-AI-Research/TripoSR, licencia MIT). No es una medicion real del objeto
-- es una "adivinanza" de IA -- por eso este resultado nunca se vende como
pieza para fabricar, solo como preview de baja resolucion con marca de agua
para atraer al cliente hacia el escaneo profesional (ver scan_meshroom.py).

Llama el run.py del repo oficial como subproceso en vez de reimplementar su
API interna (TSR.from_pretrained, etc.): asi queda pegado a su CLI
documentada, que es mas estable entre versiones que sus clases internas.
"""
from __future__ import annotations

import glob
import os
import subprocess
from pathlib import Path

TRIPOSR_DIR = os.environ.get("TRIPOSR_DIR", "/opt/TripoSR")


def generar_preview(ruta_foto: str, dir_salida: str) -> str:
    """Corre TripoSR sobre una foto y regresa la ruta al .obj resultante."""
    Path(dir_salida).mkdir(parents=True, exist_ok=True)

    comando = [
        "python3",
        os.path.join(TRIPOSR_DIR, "run.py"),
        ruta_foto,
        "--output-dir",
        dir_salida,
        "--model-save-format",
        "obj",
        "--bake-texture",
    ]
    resultado = subprocess.run(comando, cwd=TRIPOSR_DIR, capture_output=True, text=True, timeout=300)
    if resultado.returncode != 0:
        raise RuntimeError(f"TripoSR fallo ({resultado.returncode}): {resultado.stderr[-2000:]}")

    candidatos = glob.glob(os.path.join(dir_salida, "**", "*.obj"), recursive=True)
    if not candidatos:
        raise RuntimeError("TripoSR no genero ningun .obj en la salida esperada")
    return candidatos[0]
