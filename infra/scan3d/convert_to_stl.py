"""Convierte la malla que entrega cada motor (OBJ/GLB) a STL y, de paso, a un
GLB limpio para previsualizar en el navegador. STL no soporta color/textura
por definicion del formato, asi que esa informacion se pierde aqui a proposito
-- es el formato que piden las maquinas CNC/impresoras 3D, no el de exhibicion.
"""
from __future__ import annotations

from pathlib import Path

import trimesh


def cargar_malla(ruta_entrada: str) -> trimesh.Trimesh:
    resultado = trimesh.load(ruta_entrada, force="mesh")
    if isinstance(resultado, trimesh.Scene):
        resultado = trimesh.util.concatenate(
            [g for g in resultado.geometry.values() if isinstance(g, trimesh.Trimesh)]
        )
    if not isinstance(resultado, trimesh.Trimesh):
        raise ValueError(f"No se pudo leer una malla de {ruta_entrada}")
    return resultado


def exportar_stl(malla: trimesh.Trimesh, ruta_salida: str) -> str:
    Path(ruta_salida).parent.mkdir(parents=True, exist_ok=True)
    if not malla.is_watertight:
        # No bloquea la exportacion -- muchas piezas reales de fotogrametria
        # no cierran perfecto -- pero el caller debe avisarle al taller que
        # puede necesitar reparacion antes de mandarla a maquinar.
        pass
    malla.export(ruta_salida, file_type="stl")
    return ruta_salida


def escalar_a_mm(malla: trimesh.Trimesh, referencia_mm: float) -> trimesh.Trimesh:
    """La fotogrametria reconstruye la forma pero no el tamano: la malla sale
    en unidades arbitrarias. Con la medida real del lado mas largo (la toma el
    taller con vernier) se escala de forma uniforme para que el STL quede en
    milimetros. Tambien se lleva al origen para que el CAM la reciba en su
    lugar."""
    lado_mayor = float(max(malla.extents))
    if lado_mayor <= 0:
        raise ValueError("la malla no tiene volumen; no se puede escalar")
    malla = malla.copy()
    malla.apply_translation(-malla.bounds[0])
    malla.apply_scale(referencia_mm / lado_mayor)
    return malla


def convertir(ruta_entrada: str, ruta_salida_stl: str, referencia_mm: float | None = None) -> dict:
    malla = cargar_malla(ruta_entrada)
    escala_real = bool(referencia_mm and referencia_mm > 0)
    if escala_real:
        malla = escalar_a_mm(malla, float(referencia_mm))
    exportar_stl(malla, ruta_salida_stl)
    return {
        "stl_path": ruta_salida_stl,
        "watertight": bool(malla.is_watertight),
        "vertices": int(len(malla.vertices)),
        "caras": int(len(malla.faces)),
        # Solo son milimetros si escala_real es True; si no, son proporciones.
        "bounding_box_mm": [round(float(x), 2) for x in malla.extents],
        "escala_real": escala_real,
    }


if __name__ == "__main__":
    import sys

    if len(sys.argv) not in (3, 4):
        print("uso: python convert_to_stl.py entrada.obj salida.stl [lado_mayor_mm]")
        raise SystemExit(1)
    info = convertir(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) == 4 else None)
    print(info)
