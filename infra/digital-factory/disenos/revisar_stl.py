"""Dibuja un STL binario a PNG para revisarlo a ojo.

Mismo motivo que revisar_dxf.py: `cadgen stl snapshot` necesita bajar su
propio Chromium y en el contenedor del agente esa descarga esta bloqueada.
Aqui se lee el STL a mano y se pinta con matplotlib, que ya viene con cadgen.

    uvx --no-config --managed-python --python 3.13 --from cadgen==0.7.16 \
        python revisar_stl.py STL/portavasos-panal-100.stl tmp/portavasos.png
"""

import struct
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from mpl_toolkits.mplot3d.art3d import Poly3DCollection  # noqa: E402


def leer_stl_binario(ruta: Path) -> np.ndarray:
    datos = ruta.read_bytes()
    (n_caras,) = struct.unpack("<I", datos[80:84])
    # 50 bytes por cara: normal (3f) + 3 vertices (9f) + atributo (H)
    crudo = np.frombuffer(datos[84 : 84 + n_caras * 50], dtype=np.uint8)
    crudo = crudo.reshape(n_caras, 50)
    coords = crudo[:, 12:48].copy().view("<f4").reshape(n_caras, 3, 3)
    return coords.astype(float)


def dibujar(entrada: Path, salida: Path, vista=(28, -55)) -> None:
    caras = leer_stl_binario(entrada)
    fig = plt.figure(figsize=(9, 7), dpi=110)
    eje = fig.add_subplot(111, projection="3d")
    eje.add_collection3d(
        Poly3DCollection(caras, facecolor="#9fb6cd", edgecolor="#33475b",
                         linewidths=0.12)
    )
    puntos = caras.reshape(-1, 3)
    centro = (puntos.max(axis=0) + puntos.min(axis=0)) / 2
    alcance = (puntos.max(axis=0) - puntos.min(axis=0)).max() / 2
    for fijar, c in zip((eje.set_xlim, eje.set_ylim, eje.set_zlim), centro):
        fijar(c - alcance, c + alcance)
    eje.set_box_aspect((1, 1, 1))
    eje.view_init(elev=vista[0], azim=vista[1])
    eje.set_axis_off()
    salida.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(salida, facecolor="white", bbox_inches="tight")
    plt.close(fig)
    tam = puntos.max(axis=0) - puntos.min(axis=0)
    print(f"dibujado {salida}  ({len(caras)} caras, "
          f"{tam[0]:.1f} x {tam[1]:.1f} x {tam[2]:.1f} mm)")


if __name__ == "__main__":
    dibujar(Path(sys.argv[1]), Path(sys.argv[2]))
