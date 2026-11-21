#!/usr/bin/env python3
"""
Agente «Monitor de precios de materiales»: lunes y jueves busca el precio público
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
def _mdf(e, r):
    return (f"mdf_{e}", f"MDF {e} mm (hoja 1.22×2.44)", f"precio hoja MDF {e} mm 1.22 x 2.44", ["mdf", str(e)], r)


# Las claves deben ser las mismas de packages/api/src/lib/materiales-precios.ts
MATERIALES = [
    _mdf(3, (100, 700)), _mdf(6, (180, 900)), _mdf(9, (250, 1200)), _mdf(12, (330, 1500)), _mdf(15, (400, 1800)), _mdf(18, (480, 2100)), _mdf(25, (700, 3000)),
    *[(f"triplay_{e}", f"Triplay pino {e} mm (hoja)", f"precio triplay pino {e} mm 1.22 x 2.44", ["triplay", str(e)], r)
      for e, r in [(6, (200, 1000)), (9, (300, 1300)), (12, (380, 1600)), (15, (450, 1900)), (18, (550, 2300))]],
    ("melamina_16", "Melamina blanca 16 mm (hoja)", "precio hoja melamina blanca 16 mm 1.22 x 2.44", ["melamina", "16"], (500, 2200)),
    *[(f"acrilico_{e}", f"Acrílico cristal {e} mm (hoja 1.22×2.44)", f"precio lámina acrílico cristal {e} mm 1.22 x 2.44", ["acrilico", str(e)], r)
      for e, r in [(2, (400, 1800)), (3, (600, 2500)), (4, (800, 3200)), (6, (1200, 4500)), (9, (1800, 6500)), (12, (2400, 8500))]],
    ("acrilico_color_3", "Acrílico de color 3 mm (hoja)", "precio lámina acrílico color 3 mm 1.22 x 2.44", ["acrilico", "3"], (700, 3000)),
    *[(f"pvc_{e}", f"PVC espumado {e} mm (hoja)", f"precio lámina PVC espumado {e} mm 1.22 x 2.44", ["pvc", str(e)], r)
      for e, r in [(3, (200, 1200)), (6, (350, 1800)), (10, (550, 2800))]],
    ("acm_3", "Aluminio compuesto ACM 3 mm (hoja)", "precio lámina aluminio compuesto ACM 3 mm 1.22 x 2.44", ["3"], (500, 2500)),
    ("policarbonato_6", "Policarbonato celular 6 mm (hoja)", "precio policarbonato celular 6 mm 1.22 x 2.44", ["policarbonato", "6"], (300, 2000)),
    *[(f"negra_cal{c}", f"Lámina negra cal. {c} (4×8 ft)", f"precio lámina negra calibre {c} 4x8", ["negra", str(c)], r)
      for c, r in [(10, (2000, 7000)), (12, (1500, 5500)), (14, (900, 4000)), (16, (700, 3200)), (18, (550, 2500)), (20, (400, 2000))]],
    *[(f"galv_cal{c}", f"Lámina galvanizada cal. {c} (4×8 ft)", f"precio lámina galvanizada calibre {c} 4x8", ["galvanizada", str(c)], r)
      for c, r in [(18, (500, 2500)), (20, (400, 2000)), (22, (300, 1600)), (24, (250, 1300))]],
    *[(f"inox_cal{c}", f"Lámina inoxidable 304 cal. {c} (4×8 ft)", f"precio lámina acero inoxidable 304 calibre {c} 4x8", ["inox", str(c)], r)
      for c, r in [(14, (3500, 14000)), (16, (2800, 11000)), (18, (2000, 9000)), (20, (1600, 7000))]],
    ("aluminio_116", 'Lámina aluminio 1/16" (4×8 ft)', "precio lámina aluminio 1/16 4x8", ["aluminio", "1/16"], (1200, 6000)),
    ("aluminio_18", 'Placa aluminio 1/8" (4×8 ft)', "precio placa aluminio 1/8 4x8 hoja", ["aluminio", "1/8"], (2000, 9000)),
    ("aluminio_14", 'Placa aluminio 1/4" (4×8 ft)', "precio placa aluminio 1/4 4x8", ["aluminio", "1/4"], (4000, 18000)),
    ("pla_1kg", "Filamento PLA 1 kg 1.75 mm", "precio filamento PLA 1kg 1.75 mm", ["pla", "1"], (220, 900)),
    ("petg_1kg", "Filamento PETG 1 kg 1.75 mm", "precio filamento PETG 1kg 1.75 mm", ["petg", "1"], (250, 1000)),
    ("abs_1kg", "Filamento ABS 1 kg 1.75 mm", "precio filamento ABS 1kg 1.75 mm", ["abs", "1"], (230, 950)),
    ("tpu_1kg", "Filamento TPU 1 kg 1.75 mm", "precio filamento TPU flexible 1kg 1.75 mm", ["tpu"], (350, 1500)),
    ("resina_1l", "Resina estándar 1 L", "precio resina impresora 3D estándar 1 litro", ["resina"], (300, 1500)),
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
