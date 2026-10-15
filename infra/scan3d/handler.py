"""Entrypoint para RunPod Serverless. n8n manda un trabajo con fotos ya
subidas a B2 (URLs firmadas); este handler las descarga, corre el motor que
corresponda (preview gratis o escaneo profesional), convierte a STL y sube el
resultado de vuelta a B2 bajo output_prefix. RunPod se encarga de la cola y
de prender/apagar la GPU -- este archivo no sabe nada de eso.

Contrato de entrada (event["input"]):
{
  "mode": "preview" | "scan",
  "job_id": "texto libre, se usa para nombrar los archivos de salida",
  "image_urls": ["https://...", ...],   // 1 url para preview, 15-60 para scan
  "output_prefix": "escaneos3d/<job_id>/"   // prefijo en el bucket de B2
}
"""
from __future__ import annotations

import os
import tempfile
import urllib.request
from pathlib import Path

import runpod

from convert_to_stl import convertir
from preview_triposr import generar_preview
from scan_meshroom import escanear
from storage import subir_archivo


def _descargar_fotos(urls: list[str], dir_destino: str) -> list[str]:
    rutas = []
    for i, url in enumerate(urls):
        destino = os.path.join(dir_destino, f"foto_{i:03d}.jpg")
        urllib.request.urlretrieve(url, destino)
        rutas.append(destino)
    return rutas


def handler(event: dict) -> dict:
    entrada = event.get("input", {})
    modo = entrada.get("mode")
    job_id = entrada.get("job_id")
    urls = entrada.get("image_urls") or []
    prefijo_salida = entrada.get("output_prefix")

    if modo not in ("preview", "scan"):
        return {"error": f"mode debe ser 'preview' o 'scan', llego: {modo!r}"}
    if not job_id or not urls or not prefijo_salida:
        return {"error": "faltan job_id, image_urls o output_prefix"}

    with tempfile.TemporaryDirectory() as tmp:
        dir_fotos = os.path.join(tmp, "fotos")
        dir_salida_motor = os.path.join(tmp, "salida")
        Path(dir_fotos).mkdir(parents=True)

        try:
            fotos = _descargar_fotos(urls, dir_fotos)
        except Exception as e:
            return {"error": f"no se pudieron descargar las fotos: {e}"}

        try:
            if modo == "preview":
                ruta_obj = generar_preview(fotos[0], dir_salida_motor)
            else:
                ruta_obj = escanear(fotos, dir_salida_motor)
        except Exception as e:
            return {"error": str(e), "mode": modo}

        ruta_stl = os.path.join(tmp, f"{job_id}.stl")
        try:
            info = convertir(ruta_obj, ruta_stl)
        except Exception as e:
            return {"error": f"la malla se genero pero no se pudo convertir a STL: {e}"}

        # El preview gratis no entrega STL descargable -- solo sirve para
        # que el storefront muestre el modelo 3D y empuje al plan de paga.
        resultado = {
            "mode": modo,
            "job_id": job_id,
            "watertight": info["watertight"],
            "vertices": info["vertices"],
            "caras": info["caras"],
            "bounding_box_mm": info["bounding_box_mm"],
        }

        obj_key = f"{prefijo_salida}modelo.obj"
        subir_archivo(ruta_obj, obj_key)
        resultado["obj_storage_key"] = obj_key

        if modo == "scan":
            stl_key = f"{prefijo_salida}pieza.stl"
            subir_archivo(ruta_stl, stl_key)
            resultado["stl_storage_key"] = stl_key

        return resultado


runpod.serverless.start({"handler": handler})
