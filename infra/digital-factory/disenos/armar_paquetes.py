"""Arma el ZIP que se le entrega al comprador, uno por diseno.

Cada paquete lleva los formatos declarados en fichas.json mas un LEEME.txt
con medidas, material sugerido y la licencia. Es lo que sube el agente al
bucket privado: un solo archivo por ficha, como espera el workflow de alta.
"""

import json
import zipfile
from pathlib import Path

_AQUI = Path(__file__).resolve().parent
LICENCIA = (
    "Licencia de uso HETNA CNC\n"
    "-------------------------\n"
    "Diseno original de HETNA CNC (Roberto Vladimir Rivera Sanchez).\n"
    "Se permite cortar, maquinar, imprimir y vender las piezas fisicas que\n"
    "salgan de este archivo, sin limite de cantidad.\n"
    "No se permite revender ni redistribuir el archivo digital.\n"
)


def armar(ficha: dict) -> Path:
    destino = _AQUI / "PAQUETES" / ficha["archivo_filename"]
    destino.parent.mkdir(parents=True, exist_ok=True)
    leeme = "\n".join(
        [
            ficha["titulo"],
            "=" * len(ficha["titulo"]),
            "",
            ficha["descripcion"],
            "",
            f"Medidas: {ficha['medidas']}",
            f"Material sugerido: {ficha['material']}",
            f"Formatos incluidos: {ficha['formatos']}",
            "",
            LICENCIA,
        ]
    )
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
        for archivo in ficha["archivos"]:
            ruta = _AQUI / archivo
            if not ruta.exists():
                raise FileNotFoundError(ruta)
            z.write(ruta, ruta.name)
        z.writestr("LEEME.txt", leeme)
    return destino


if __name__ == "__main__":
    fichas = json.loads((_AQUI / "fichas.json").read_text(encoding="utf-8"))
    for ficha in fichas:
        salida = armar(ficha)
        print(f"{salida.name:44s} {salida.stat().st_size / 1024:8.1f} KB")
