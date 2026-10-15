"""Escaneo profesional (de paga): 20-40 fotos del mismo objeto real, desde
distintos angulos, -> malla a escala real con AliceVision/Meshroom
(alicevision/Meshroom, licencia MPL-2.0, libre para uso comercial).

A diferencia de preview_triposr.py, esto SI mide el objeto -- es fotogrametria
clasica, no una adivinanza de IA -- por eso es el unico resultado que se
entrega como STL para mandar a fabricar/CNC.

Usa el binario meshroom_batch (incluido en la distribucion de AliceVision)
que ya encadena el pipeline completo (deteccion de features, structure-from-
motion, mapas de profundidad, mallado y texturizado) en un solo comando.
"""
from __future__ import annotations

import glob
import os
import subprocess
from pathlib import Path

MESHROOM_BIN_DIR = os.environ.get("MESHROOM_BIN_DIR", "/opt/Meshroom")
MIN_FOTOS = 15
MAX_FOTOS = 60


def escanear(fotos: list[str], dir_salida: str) -> str:
    """Corre meshroom_batch sobre un set de fotos y regresa la ruta a la
    malla texturizada (.obj) resultante."""
    if len(fotos) < MIN_FOTOS:
        raise ValueError(
            f"Se necesitan al menos {MIN_FOTOS} fotos para una reconstruccion confiable "
            f"(llegaron {len(fotos)})"
        )
    if len(fotos) > MAX_FOTOS:
        raise ValueError(f"Maximo {MAX_FOTOS} fotos por trabajo (llegaron {len(fotos)})")

    Path(dir_salida).mkdir(parents=True, exist_ok=True)

    comando = [
        os.path.join(MESHROOM_BIN_DIR, "meshroom_batch"),
        "--input",
        *fotos,
        "--output",
        dir_salida,
    ]
    # Fotogrametria real: minutos, no segundos -- el timeout es generoso
    # a proposito. El caller (handler.py) corre esto en background.
    resultado = subprocess.run(comando, capture_output=True, text=True, timeout=3600)
    if resultado.returncode != 0:
        raise RuntimeError(f"meshroom_batch fallo ({resultado.returncode}): {resultado.stderr[-2000:]}")

    candidatos = glob.glob(os.path.join(dir_salida, "**", "texturedMesh.obj"), recursive=True)
    if not candidatos:
        # Algunas versiones de AliceVision nombran el mesh distinto; busca
        # cualquier .obj como respaldo antes de fallar.
        candidatos = glob.glob(os.path.join(dir_salida, "**", "*.obj"), recursive=True)
    if not candidatos:
        raise RuntimeError(
            "meshroom_batch termino pero no se encontro ningun .obj -- revisa los logs de "
            "este trabajo, probablemente las fotos no tenian suficiente traslape/textura"
        )
    return candidatos[0]
