#!/usr/bin/env python3
"""
Busca prospectos del nicho CNC con ScrapeGraphAI y los agrega (sin duplicar)
a datos/nuevos.jsonl, con las mismas columnas que la hoja de prospectos.

    pip install -r requirements.txt && playwright install chromium
    export LLM_MODEL="openai/gpt-4o-mini"   # o "anthropic/claude-haiku-...", "groq/llama-3.3-70b-versatile", "ollama/llama3.1"
    export LLM_API_KEY="..."                # no hace falta con ollama
    python buscar_prospectos.py --max-por-consulta 15

Reglas: sólo datos de contacto de negocio publicados en el sitio de la
empresa. El modelo tiene prohibido inventar correos y además cada correo se
valida contra el texto de la página: si no aparece literal, se descarta.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import html as html_mod
import time
import urllib.request
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

AQUI = Path(__file__).resolve().parent
DATOS = AQUI / "datos"
SALIDA = DATOS / "nuevos.jsonl"
CAMPOS = [
    "empresa", "tipo", "segmento", "tamano", "pais", "estado", "ciudad", "web", "dominio",
    "email", "telefono", "whatsapp", "facebook", "instagram", "linkedin", "youtube", "tiktok",
    "productos_servicios", "idioma", "fuente_url",
]
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
EMAIL_RE = re.compile(r"^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$", re.I)
NO_EMPRESA = ("probados.", "plastico.com", "metalmecanica.com", "industriamart", "dirind.com", "seccionamarilla",
              "cylex", "infoisinfo", "guiamexico", "paginasamarillas", "directorio", "maquinadosenmexico", "agalmasourcing",
              "alibaba.", "made-in-china", "indiamart", "kompass", "europages", "thomasnet", "blogspot.", "wordpress.com",
              "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "mercadolibre.", "amazon.",
              "wikipedia.org", "tiktok.com", "x.com", "twitter.com", "google.", "yelp.", "indeed.", "paginasamarillas")


# Preferencia de modelos de Groq (se usa el primero que la cuenta tenga activo).
PREFERIDOS_GROQ = ["llama-3.3-70b-versatile", "openai/gpt-oss-20b", "openai/gpt-oss-120b",
                   "meta-llama/llama-4-scout-17b-16e-instruct", "qwen/qwen3-32b", "llama-3.1-8b-instant"]


def modelo_groq(clave: str, pedido: str) -> str:
    """Groq retira modelos seguido: pregunta cuáles hay y elige uno que exista."""
    try:
        req = urllib.request.Request("https://api.groq.com/openai/v1/models",
                                     headers={"Authorization": f"Bearer {clave}", "User-Agent": "prospectos-hetna"})
        with urllib.request.urlopen(req, timeout=20) as r:
            hay = [m["id"] for m in json.load(r).get("data", []) if m.get("active", True)]
    except Exception as e:  # noqa: BLE001
        print(f"No se pudo consultar la lista de modelos de Groq ({e}); se usa {pedido or PREFERIDOS_GROQ[0]}")
        return pedido or PREFERIDOS_GROQ[0]
    if pedido in hay:
        return pedido
    for m in PREFERIDOS_GROQ:
        if m in hay:
            if pedido:
                print(f"El modelo {pedido} ya no está en Groq; se usa {m}")
            return m
    texto = [m for m in hay if not any(x in m for x in ("whisper", "guard", "tts", "playai", "distil", "compound"))]
    if not texto:
        sys.exit(f"Groq no ofrece modelos de texto para esta llave: {hay}")
    print(f"Se usa {texto[0]} (modelos disponibles: {', '.join(hay)})")
    return texto[0]


def config_llm() -> dict:
    """Configura el modelo. Groq se pasa como instancia de LangChain (ChatGroq):
    algunas versiones de ScrapeGraphAI mandan "groq/..." por el cliente de
    OpenAI y la llave de Groq (gsk_...) termina rechazada por api.openai.com."""
    clave = os.environ.get("LLM_API_KEY", "").strip()
    modelo = os.environ.get("LLM_MODEL", "").strip()
    if not modelo:
        modelo = "groq/llama-3.1-8b-instant" if clave.startswith("gsk_") else "openai/gpt-4o-mini"
    proveedor, _, nombre = modelo.partition("/")

    if proveedor == "ollama":
        llm = {"model": modelo, "temperature": 0, "format": "json",
               "base_url": os.environ.get("OLLAMA_URL", "http://localhost:11434")}
    else:
        if not clave or clave.startswith("PEGA_AQUI"):
            sys.exit("Falta LLM_API_KEY en .env (o usa LLM_MODEL=ollama/...)")
        if proveedor == "groq" or clave.startswith("gsk_"):
            from langchain_groq import ChatGroq
            nombre = modelo_groq(clave, nombre if proveedor == "groq" else "")
            modelo = "groq/" + nombre
            llm = {"model_instance": ChatGroq(model=nombre, api_key=clave, temperature=0, max_retries=10),
                   # Trozos chicos: el plan gratis de Groq deja ~8,000 tokens por minuto.
                   "model_tokens": int(os.environ.get("MODEL_TOKENS", "4000"))}
        else:
            llm = {"model": modelo, "api_key": clave, "temperature": 0}
    print(f"Modelo: {modelo}")
    return {"llm": llm, "headless": True, "verbose": False}


def dominio_de(url: str) -> str:
    try:
        host = urlparse(url if "://" in url else f"https://{url}").netloc.lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


def ya_vistos() -> set[str]:
    """Dominios y correos que ya están en cualquier archivo de datos/ (no se repiten)."""
    vistos: set[str] = set()
    for f in DATOS.glob("*.jsonl"):
        for linea in f.read_text(encoding="utf-8").splitlines():
            try:
                d = json.loads(linea)
            except json.JSONDecodeError:
                continue
            for k in ("dominio", "email"):
                if d.get(k):
                    vistos.add(d[k].strip().lower())
    return vistos


def texto_pagina(url: str) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read(2_000_000).decode("utf-8", "ignore").lower()
    except Exception:
        return ""


def buscar_sitios(consulta: str, maximo: int, cfg: dict) -> list[str]:
    """Busca sitios en DuckDuckGo SIN gastar tokens de la IA (antes se usaba
    SearchGraph, que se comía el límite diario de Groq sólo para listar URLs)."""
    try:
        from ddgs import DDGS
    except ImportError:
        from duckduckgo_search import DDGS
    resultados = []
    for intento in range(3):
        try:
            with DDGS() as d:
                resultados = list(d.text(consulta, max_results=maximo * 3))
            break
        except Exception as e:  # noqa: BLE001  (timeouts / límite de DuckDuckGo)
            print(f"  … DuckDuckGo falló ({type(e).__name__}); reintento en {20 * (intento + 1)} s")
            time.sleep(20 * (intento + 1))
    limpias, vistos = [], set()
    for r in resultados:
        u = r.get("href") or r.get("url") or ""
        if not u.startswith("http"):
            continue
        d = dominio_de(u)
        if d and d not in vistos and not any(x in d for x in NO_EMPRESA):
            vistos.add(d)
            limpias.append(f"https://{d}")
    return limpias[:maximo]


EMAIL_EN_TEXTO = re.compile(r"[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}", re.I)
TEL_RE = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")
REDES = {"facebook": "facebook.com/", "instagram": "instagram.com/", "linkedin": "linkedin.com/",
         "youtube": "youtube.com/", "tiktok": "tiktok.com/@"}
CNC_PALABRAS = ("cnc", "maquinad", "mecanizad", "usinagem", "router", "láser", "laser", "plasma", "torno",
                "fresad", "fresas", "insertos", "machining", "machine shop", "troquel", "moldes", "mastercam", "g-code")
BASURA_MAIL = ("@empresa.com", "@dominio.com", "tudominio", "ejemplo", "@correo.com", "@email.com", "@mail.com", "yourdomain",
               "example.", "sentry", "wixpress", "domain.com", "email.com", ".png", ".jpg", ".webp", "@2x", "u003e")


def html_de(url: str) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            if r.status >= 400:
                return ""
            return r.read(1_500_000).decode("utf-8", "ignore")
    except Exception:  # noqa: BLE001
        return ""


def extraer_rapido(url: str) -> dict:
    """Saca correo, teléfono, WhatsApp y redes del HTML con expresiones regulares.
    Gratis y rápido; la IA sólo se usa si aquí no aparece un correo."""
    paginas = [(url + ruta, html_de(url + ruta)) for ruta in ("", "/contacto", "/contact", "/contato")]
    paginas = [(u, h) for u, h in paginas if h]
    if not paginas:
        return {}
    todo = " ".join(h for _, h in paginas)
    bajo = todo.lower()
    fuertes = sum(1 for p in CNC_PALABRAS if p in bajo)
    out: dict = {"es_cnc": " cnc" in bajo or "cnc " in bajo or fuertes >= 3}
    dom = dominio_de(url)
    correos = [m.lower() for m in EMAIL_EN_TEXTO.findall(todo) if not any(b in m.lower() for b in BASURA_MAIL)]
    # Prefiere correos del propio dominio y genéricos (ventas@, contacto@, info@…)
    correos.sort(key=lambda c: (not c.endswith("@" + dom) and not c.endswith("." + dom),
                                not c.split("@")[0] in ("ventas", "contacto", "info", "sales", "contato", "vendas", "comercial")))
    if correos:
        out["email"] = correos[0]
        out["fuente_url"] = next((u for u, h in paginas if correos[0] in h.lower()), paginas[0][0])
    wa = re.search(r"wa\.me/(\d{8,15})|api\.whatsapp\.com/send\?phone=(\d{8,15})", todo)
    if wa:
        out["whatsapp"] = "+" + (wa.group(1) or wa.group(2))
    tel = re.search(r'href="tel:([^"]+)"', todo)
    if tel:
        out["telefono"] = tel.group(1).strip()
    for red, marca in REDES.items():
        m = re.search(r'https?://(?:www\.|[a-z]{2}\.)?' + re.escape(marca) + r'[^"\'\s<>?#]+', todo, re.I)
        if m and not any(x in m.group(0) for x in ("sharer", "share?", "/plugins", "intent/")):
            out[red] = m.group(0)
    t = re.search(r"<title[^>]*>(.*?)</title>", todo, re.I | re.S)
    if t:
        out["empresa"] = html_mod.unescape(re.split(r"\s[|\-–—]\s", re.sub(r"\s+", " ", t.group(1)).strip())[0][:80])
    d = re.search(r'<meta[^>]+name="description"[^>]+content="([^"]{10,300})"', todo, re.I)
    if d:
        out["productos_servicios"] = html_mod.unescape(d.group(1).strip()[:160])
    out.setdefault("fuente_url", paginas[0][0])
    return out


PROMPT_CONTACTO = """Extrae los datos de contacto de NEGOCIO publicados en este sitio.
Devuelve JSON con: empresa, tamano ("Pequeña"|"Mediana"|"Grande", estimado), estado, ciudad,
email (correo de la empresa tal cual aparece en la página; si no aparece literal deja ""),
telefono, whatsapp, facebook, instagram, linkedin, youtube, tiktok (URLs completas),
productos_servicios (frase corta), es_cnc (true si la empresa trabaja con CNC, maquinado,
router, láser, plasma, herramientas o cursos de CNC).
NUNCA inventes ni deduzcas correos. No incluyas datos personales privados."""


def extraer_contacto(url: str, cfg: dict) -> dict:
    from scrapegraphai.graphs import SmartScraperGraph

    for ruta in ("", "/contacto"):
        time.sleep(PAUSA_S)
        try:
            r = SmartScraperGraph(prompt=PROMPT_CONTACTO, source=url + ruta, config=cfg).run() or {}
        except Exception:
            continue
        r = r.get("content", r) if isinstance(r, dict) else {}
        if r.get("email") or r.get("telefono") or r.get("whatsapp"):
            r["fuente_url"] = url + ruta
            return r
    return {}


HECHAS = DATOS / "consultas_hechas.txt"
PAUSA_S = float(os.environ.get("PAUSA_S", "20"))  # segundos antes de cada uso de la IA
MAX_IA = int(os.environ.get("MAX_IA", "25"))       # usos de la IA por corrida (plan gratis de Groq)


def leer_consultas(archivo: Path) -> list[tuple[str, str, str, str]]:
    out = []
    for linea in archivo.read_text(encoding="utf-8").splitlines():
        if linea.strip() and not linea.startswith("#"):
            out.append(tuple(p.strip() for p in linea.split("|", 3)))
    return out


def plan_auto(n: int) -> list[tuple[str, str, str, str]]:
    """Siguientes N búsquedas del plan que aún no se hacen en esta vuelta."""
    plan = json.loads((AQUI / "plan_busqueda.json").read_text(encoding="utf-8"))
    todas = []
    for pais, info in plan["ciudades"].items():
        for ciudad in info["lista"]:
            for tipo, plantilla in plan["segmentos"][info["idioma"]]:
                todas.append((pais, tipo, info["idioma"], plantilla.format(ciudad=ciudad)))
    hechas = set(HECHAS.read_text(encoding="utf-8").splitlines()) if HECHAS.exists() else set()
    pendientes = [c for c in todas if c[3] not in hechas]
    if not pendientes:  # vuelta completa: empieza otra (los sitios ya vistos se saltan)
        print(f"Vuelta completa de {len(todas)} búsquedas; empieza una nueva.")
        HECHAS.unlink(missing_ok=True)
        pendientes = todas
    print(f"Plan: {len(todas)} búsquedas, faltan {len(pendientes)} en esta vuelta; hoy {min(n, len(pendientes))}.")
    return pendientes[:n]


def marcar_hecha(consulta: str) -> None:
    with HECHAS.open("a", encoding="utf-8") as f:
        f.write(consulta + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--consultas", default=str(AQUI / "consultas.txt"))
    ap.add_argument("--max-por-consulta", type=int, default=10)
    ap.add_argument("--enviar", metavar="URL", help="webhook 'Importar prospectos' de n8n: manda lo nuevo a la hoja (n8n quita duplicados)")
    ap.add_argument("--solo-enviar", action="store_true", help="no busca; reenvía todo datos/nuevos.jsonl a n8n (n8n quita duplicados)")
    ap.add_argument("--auto", type=int, metavar="N", help="toma las siguientes N búsquedas de plan_busqueda.json (rota sola; al terminar todas vuelve a empezar)")
    args = ap.parse_args()

    cfg = {} if args.solo_enviar else config_llm()
    DATOS.mkdir(exist_ok=True)
    vistos = ya_vistos()
    nuevos = 0
    lote: list[dict] = []
    usos_ia = 0

    consultas = [] if args.solo_enviar else (plan_auto(args.auto) if args.auto else leer_consultas(Path(args.consultas)))
    for pais, tipo, idioma, consulta in consultas:
        print(f"\n🔎 {consulta}")
        time.sleep(float(os.environ.get("PAUSA_BUSQUEDA_S", "15")))
        try:
            sitios = buscar_sitios(consulta, args.max_por_consulta, cfg)
        except Exception as e:  # noqa: BLE001
            print(f"  ✖ la búsqueda falló: {type(e).__name__}: {str(e)[:200]}")
            if "401" in str(e) or "Authentication" in type(e).__name__:
                sys.exit("La llave de la IA fue rechazada (401): revisa LLM_API_KEY en .env")
            continue
        for url in sitios:
            dom = dominio_de(url)
            if dom in vistos:
                continue
            c = extraer_rapido(url)
            if c and not c.get("email") and c.get("es_cnc") and usos_ia < MAX_IA:
                usos_ia += 1
                try:
                    ia = extraer_contacto(url, cfg)
                    ia = ia if isinstance(ia, dict) else {}
                    c = {**ia, **{k: v for k, v in c.items() if v}} if ia else c
                    if ia.get("email"):
                        c["email"], c["fuente_url"] = ia["email"], ia.get("fuente_url", c.get("fuente_url"))
                except Exception as e:  # noqa: BLE001
                    print(f"  ✖ IA en {dom}: {type(e).__name__}")
            if not c or not c.get("es_cnc"):
                continue
            email = (c.get("email") or "").strip().lower()
            if email and (not EMAIL_RE.match(email) or email not in texto_pagina(c["fuente_url"])):
                email = ""  # no aparece literal en la página: se descarta
            if email in vistos:
                continue
            fila = {k: str(c.get(k) or "").strip() for k in CAMPOS}
            fila.update(tipo=tipo, pais=pais, idioma=idioma, web=url, dominio=dom, email=email,
                        segmento=consulta, fuente_url=c["fuente_url"])
            with SALIDA.open("a", encoding="utf-8") as f:
                f.write(json.dumps(fila, ensure_ascii=False) + "\n")
            vistos.update({dom, email} - {""})
            nuevos += 1
            lote.append(fila)
            print(f"  ✔ {fila['empresa'] or dom}  {email or fila['telefono']}")
        if args.auto:
            marcar_hecha(consulta)

    print(f"\n{nuevos} prospectos nuevos → {SALIDA}  ({date.today()})")
    if args.solo_enviar and SALIDA.exists():
        lote = [json.loads(l) for l in SALIDA.read_text(encoding="utf-8").splitlines() if l.strip()]
    if args.enviar and lote:
        lista = []
        for p in lote:  # última limpieza (también para lo guardado por versiones anteriores)
            p = dict(p)
            dom = (p.get("dominio") or "").lower()
            if not dom or any(x in dom for x in NO_EMPRESA):
                continue
            em = (p.get("email") or "").lower()
            if em and (not EMAIL_RE.match(em) or any(b in em for b in BASURA_MAIL)):
                p["email"] = ""
            p["empresa"] = html_mod.unescape(p.get("empresa") or "").strip() or dom
            lista.append(p)
        for p in lista:
            p["id"] = p.get("dominio", "")
            p["region"] = p.pop("estado", "")
        req = urllib.request.Request(args.enviar, data=json.dumps({"prospectos": lista}).encode(),
                                     headers={"Content-Type": "application/json", "User-Agent": UA}, method="POST")
        with urllib.request.urlopen(req, timeout=60) as r:
            print(f"Enviados {len(lista)} a n8n ({r.status}); n8n agrega sólo los que no estén en la hoja.")


if __name__ == "__main__":
    main()
