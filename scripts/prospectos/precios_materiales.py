#!/usr/bin/env python3
"""
Agente «Monitor de precios de materiales»: cada semana busca el precio público
de los materiales que más se cortan en CNC en México (MDF, triplay, acrílico,
lámina de acero, aluminio, inoxidable, filamento) en tiendas y distribuidores,
saca la mediana, el mínimo y el máximo y lo manda a n8n (webhook hetna-precios),
que guarda el historial, compara con la semana anterior y te avisa por Telegram.

Sólo lee precios publicados (páginas de producto con su precio en la página); no
inicia sesión ni usa APIs privadas. Sin IA: el precio se valida con palabras
clave de la medida y un rango razonable por material.

    python precios_materiales.py --enviar http://127.0.0.1:5678/webhook/hetna-precios
    python precios_materiales.py --probar --solo mdf_15
"""
from __future__ import annotations

import argparse
import html as html_mod
import json
import re
import statistics
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from buscar_prospectos import DATOS, UA, buscar_web, dominio_de  # noqa: E402

# clave, nombre, búsqueda, palabras que debe tener el título (todas, sin acentos), rango MXN razonable
MATERIALES = [
    ("mdf_3", "MDF 3 mm (hoja 1.22×2.44)", "precio hoja MDF 3 mm 1.22 x 2.44", ["mdf", "3"], (120, 700)),
    ("mdf_6", "MDF 6 mm (hoja 1.22×2.44)", "precio hoja MDF 6 mm 1.22 x 2.44", ["mdf", "6"], (200, 900)),
    ("mdf_9", "MDF 9 mm (hoja 1.22×2.44)", "precio hoja MDF 9 mm 1.22 x 2.44", ["mdf", "9"], (300, 1200)),
    ("mdf_15", "MDF 15 mm (hoja 1.22×2.44)", "precio hoja MDF 15 mm 1.22 x 2.44", ["mdf", "15"], (450, 1700)),
    ("mdf_18", "MDF 18 mm (hoja 1.22×2.44)", "precio hoja MDF 18 mm 1.22 x 2.44", ["mdf", "18"], (550, 2000)),
    ("triplay_15", "Triplay pino 15 mm (hoja)", "precio triplay pino 15 mm 1.22 x 2.44", ["triplay", "15"], (400, 1800)),
    ("acrilico_3", "Acrílico cristal 3 mm (hoja 1.22×2.44)", "precio lámina acrílico cristal 3 mm 1.22 x 2.44", ["acrilico", "3"], (600, 2500)),
    ("acrilico_6", "Acrílico cristal 6 mm (hoja 1.22×2.44)", "precio lámina acrílico cristal 6 mm 1.22 x 2.44", ["acrilico", "6"], (1200, 4500)),
    ("acero_cal14", "Lámina acero negro cal. 14 (4×8 ft)", "precio lámina negra calibre 14 4x8", ["negra", "14"], (900, 4000)),
    ("acero_cal18", "Lámina galvanizada cal. 18 (4×8 ft)", "precio lámina galvanizada calibre 18 4x8", ["galvanizada", "18"], (500, 2500)),
    ("inox_cal18", "Lámina inoxidable 304 cal. 18 (4×8 ft)", "precio lámina acero inoxidable 304 calibre 18 4x8", ["inox", "18"], (2000, 9000)),
    ("aluminio_18", "Placa aluminio 1/8\" (4×8 ft)", "precio placa aluminio 1/8 4x8 hoja", ["aluminio", "1/8"], (2000, 9000)),
    ("pla_1kg", "Filamento PLA 1 kg 1.75 mm", "precio filamento PLA 1kg 1.75 mm", ["pla", "1"], (220, 900)),
]
NO_TIENDA = ("youtube.", "facebook.", "instagram.", "tiktok.", "pinterest.", "wikipedia.", "reddit.", "listado.mercadolibre", "ebay.", "alibaba.", "aliexpress.", "/blog/", "/blogs/", "/noticias/")
PRECIO_RE = re.compile(r"\$\s?(\d{1,3}(?:,\d{3})+|\d{2,6})(?:\.(\d{2}))?")


def sin_acentos(s: str) -> str:
    return s.lower().translate(str.maketrans("áéíóúüñ", "aeiouun"))


def pagina(url: str) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read(2_000_000).decode("utf-8", "ignore")
    except Exception:
        return ""


def titulo_de(h: str) -> str:
    m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', h, re.I) or re.search(r"<title[^>]*>(.*?)</title>", h, re.I | re.S)
    return html_mod.unescape(m.group(1)).strip()[:200] if m else ""


def precio_de(h: str) -> float | None:
    """Precio de la página de producto: JSON-LD, meta de Open Graph o itemprop."""
    for patron in (
        r'"price"\s*:\s*"?(\d+(?:\.\d+)?)',
        r'product:price:amount["\'][^>]+content=["\'](\d+(?:\.\d+)?)',
        r'itemprop=["\']price["\'][^>]+content=["\'](\d+(?:\.\d+)?)',
    ):
        for m in re.finditer(patron, h, re.I):
            v = float(m.group(1))
            if v > 0:
                return v
    return None


def precio_texto(t: str) -> list[float]:
    return [float(m.group(1).replace(",", "") + "." + (m.group(2) or "00")) for m in PRECIO_RE.finditer(t)]


def medir(clave: str, nombre: str, consulta: str, palabras: list[str], rango: tuple[int, int]) -> dict:
    vistos, fuentes = set(), []
    for r in buscar_web(consulta, 15):
        url = r.get("href") or r.get("url") or ""
        dom = dominio_de(url)
        if not url.startswith("http") or dom in vistos or any(x in url for x in NO_TIENDA):
            continue
        texto_busqueda = sin_acentos((r.get("title", "") + " " + r.get("body", "")))
        h = pagina(url)
        titulo = titulo_de(h) or r.get("title", "")
        t = sin_acentos(titulo)
        if not all(re.search(r"(^|[^0-9a-z])" + re.escape(p) + r"($|[^0-9a-z])", t) for p in palabras):
            continue
        p = precio_de(h)
        if p is None:  # sin dato estructurado: el precio que trae el resultado de búsqueda
            candidatos = [x for x in precio_texto(texto_busqueda) if rango[0] <= x <= rango[1]]
            p = candidatos[0] if candidatos else None
        if p is None or not (rango[0] <= p <= rango[1]):
            continue
        vistos.add(dom)
        fuentes.append({"tienda": dom, "precio": round(p, 2), "url": url, "titulo": titulo})
        if len(fuentes) >= 8:
            break
        time.sleep(1)
    precios = [f["precio"] for f in fuentes]
    return {
        "clave": clave, "nombre": nombre, "n": len(precios),
        "mediana": round(statistics.median(precios), 2) if precios else None,
        "minimo": min(precios) if precios else None,
        "maximo": max(precios) if precios else None,
        "fuentes": fuentes,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--enviar", metavar="URL", help="webhook hetna-precios de n8n")
    ap.add_argument("--probar", action="store_true", help="sólo imprime")
    ap.add_argument("--solo", help="clave de un material (p. ej. mdf_15)")
    a = ap.parse_args()
    lista = [m for m in MATERIALES if not a.solo or m[0] == a.solo]
    resultado = []
    for m in lista:
        r = medir(*m)
        print(f"• {r['nombre']}: mediana {r['mediana']} (n={r['n']}) " + ", ".join(f"{f['tienda']} ${f['precio']}" for f in r["fuentes"]))
        resultado.append(r)
    datos = {"fecha": date.today().isoformat(), "materiales": resultado}
    DATOS.mkdir(exist_ok=True)
    with (DATOS / "precios_materiales.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(datos, ensure_ascii=False) + "\n")
    if a.enviar and not a.probar:
        req = urllib.request.Request(a.enviar, data=json.dumps(datos).encode(), headers={"Content-Type": "application/json", "User-Agent": "precios-hetna"})
        with urllib.request.urlopen(req, timeout=60) as r:
            print(f"n8n respondió {r.status}")


if __name__ == "__main__":
    main()
