"""Dibuja un DXF a PNG para revisarlo a ojo.

`cadgen dxf snapshot` pinta el DXF en un Chromium propio que se descarga la
primera vez; en el contenedor del agente esa descarga esta bloqueada. ezdxf
(que ya viene con cadgen) trae su propio backend de matplotlib y no necesita
navegador, asi que el dibujo sale igual sin dependencias extra.

    uvx --no-config --managed-python --python 3.13 --from cadgen==0.7.16 \
        python revisar_dxf.py DXF/celosia_hexagonal.dxf tmp/celosia.png
"""

import sys
from pathlib import Path

import ezdxf
from ezdxf.addons.drawing.matplotlib import qsave


def dibujar(entrada: Path, salida: Path) -> None:
    doc = ezdxf.readfile(entrada)
    salida.parent.mkdir(parents=True, exist_ok=True)
    # bg blanco: con fondo oscuro el color 7 del DXF se pinta blanco y la
    # imagen sale en blanco sobre blanco.
    qsave(doc.modelspace(), str(salida), bg="#FFFFFF", fg="#111111", dpi=120)
    print(f"dibujado {salida}")


if __name__ == "__main__":
    dibujar(Path(sys.argv[1]), Path(sys.argv[2]))
