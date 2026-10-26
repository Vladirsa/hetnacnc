"""Sube cada paquete al pipeline de la Digital Factory.

Llama el webhook del workflow "HETNA Digital Factory - Alta de diseno
generado por agente": el workflow sube el ZIP al bucket privado de B2,
inserta la ficha en digital_factory_productos y encadena el calculo de
precio y la generacion de imagen. La ficha queda en READY_FOR_REVIEW,
nada se publica solo.

Correr desde el VPS, que es quien alcanza n8n.hetnacnc.com:

    cd /root/hetnacnc/infra/digital-factory/disenos
    python3 armar_paquetes.py        # si no estan los ZIP
    python3 subir_al_pipeline.py     # las que falten

Lo ya subido queda anotado en subidas.json y no se vuelve a mandar. Para
reenviar una ficha a proposito: subir_al_pipeline.py --rehacer portavasos

El SKU lo arma el workflow con la hora al segundo, asi que entre una alta
y la siguiente hay que dejar pasar mas de un segundo o dos fichas
distintas terminarian con el mismo SKU.
"""

import base64
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

_AQUI = Path(__file__).resolve().parent
_LIBRETA = _AQUI / "subidas.json"
WEBHOOK = "https://n8n.hetnacnc.com/webhook/agente-cnc-nuevo-producto"
ESPERA = 3.0           # segundos entre altas, para no repetir SKU
TIEMPO_LIMITE = 180    # el workflow encadena precio e imagen, tarda

# n8n.hetnacnc.com esta detras de Cloudflare, que rechaza el User-Agent que
# manda urllib por default ("Python-urllib/3.x") con un 403 error code 1010
# antes de que la peticion llegue a n8n. Con cabeceras de navegador pasa.
CABECERAS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-MX,es;q=0.9",
}

# Campos de la ficha que el workflow espera tal cual.
_CAMPOS = (
    "titulo descripcion categoria subcategoria formatos precio_sugerido "
    "moneda titulo_comercial_ia slug_ia descripcion_corta_ia "
    "descripcion_larga_ia caracteristicas_ia tags_ia keyword_principal_ia "
    "keywords_secundarias_ia titulo_seo_ia meta_description_ia faq_ia"
).split()


def leer_libreta() -> dict:
    if _LIBRETA.exists():
        return json.loads(_LIBRETA.read_text(encoding="utf-8"))
    return {}


def anotar(nombre: str, sku: str) -> None:
    libreta = leer_libreta()
    libreta[nombre] = sku
    _LIBRETA.write_text(
        json.dumps(libreta, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def armar_payload(ficha: dict) -> dict:
    paquete = _AQUI / "PAQUETES" / ficha["archivo_filename"]
    if not paquete.exists():
        raise FileNotFoundError(f"falta {paquete}; corre armar_paquetes.py")
    cuerpo = {campo: ficha[campo] for campo in _CAMPOS}
    cuerpo["archivo_filename"] = ficha["archivo_filename"]
    cuerpo["archivo_base64"] = base64.b64encode(paquete.read_bytes()).decode()
    return cuerpo


def subir(ficha: dict) -> dict:
    datos = json.dumps(armar_payload(ficha)).encode()
    peticion = urllib.request.Request(
        WEBHOOK, data=datos, headers={**CABECERAS, "Content-Type": "application/json"}
    )
    with urllib.request.urlopen(peticion, timeout=TIEMPO_LIMITE) as r:
        return json.loads(r.read().decode() or "{}")


def main(argv: list[str]) -> int:
    rehacer = "--rehacer" in argv
    filtros = [a for a in argv if not a.startswith("--")]

    fichas = json.loads((_AQUI / "fichas.json").read_text(encoding="utf-8"))
    if filtros:
        fichas = [
            f for f in fichas
            if any(t.lower() in f["archivo_filename"].lower() for t in filtros)
        ]
        if not fichas:
            print(f"ninguna ficha coincide con {filtros}")
            return 1

    libreta = leer_libreta()
    pendientes, fallos = [], 0
    for ficha in fichas:
        nombre = ficha["archivo_filename"]
        if not rehacer and nombre in libreta:
            print(f"salta  {nombre:32s} ya subida como {libreta[nombre]}")
            continue
        pendientes.append(ficha)

    for i, ficha in enumerate(pendientes):
        if i:
            time.sleep(ESPERA)
        nombre = ficha["archivo_filename"]
        try:
            respuesta = subir(ficha)
        except urllib.error.HTTPError as e:
            print(f"FALLO  {nombre}: HTTP {e.code} {e.read().decode()[:300]}")
            fallos += 1
        except Exception as e:                      # noqa: BLE001
            print(f"FALLO  {nombre}: {type(e).__name__} {e}")
            fallos += 1
        else:
            sku = respuesta.get("sku", "")
            if sku:
                anotar(nombre, sku)
            print(f"ok     {nombre:32s} SKU {sku or '?'}")

    print(f"\n{len(pendientes) - fallos} de {len(pendientes)} altas nuevas")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
