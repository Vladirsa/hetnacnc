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
EMAIL_RE = re.compile(r"^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$", re.I)
NO_EMPRESA = ("facebook.com", "instagram.com", "linkedin.com", "youtube.com", "mercadolibre.", "amazon.",
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
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (prospectos HETNA)"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read(2_000_000).decode("utf-8", "ignore").lower()
    except Exception:
        return ""


def buscar_sitios(consulta: str, maximo: int, cfg: dict) -> list[str]:
    from scrapegraphai.graphs import SearchGraph

    g = SearchGraph(
        prompt=(f"{consulta}. Devuelve JSON {{\"sitios\": [url, ...]}} con hasta {maximo} URLs de los sitios web "
                "oficiales de empresas distintas (no directorios, no marketplaces, no redes sociales)."),
        config={**cfg, "max_results": maximo},
    )
    r = g.run() or {}
    urls = r.get("sitios") or r.get("content", {}).get("sitios") or []
    urls += g.get_considered_urls() if hasattr(g, "get_considered_urls") else []
    limpias, vistos = [], set()
    for u in urls:
        if not isinstance(u, str) or not u.startswith("http"):
            continue
        d = dominio_de(u)
        if d and d not in vistos and not any(x in d for x in NO_EMPRESA):
            vistos.add(d)
            limpias.append(f"https://{d}")
    return limpias[:maximo]


PROMPT_CONTACTO = """Extrae los datos de contacto de NEGOCIO publicados en este sitio.
Devuelve JSON con: empresa, tamano ("Pequeña"|"Mediana"|"Grande", estimado), estado, ciudad,
email (correo de la empresa tal cual aparece en la página; si no aparece literal deja ""),
telefono, whatsapp, facebook, instagram, linkedin, youtube, tiktok (URLs completas),
productos_servicios (frase corta), es_cnc (true si la empresa trabaja con CNC, maquinado,
router, láser, plasma, herramientas o cursos de CNC).
NUNCA inventes ni deduzcas correos. No incluyas datos personales privados."""


def extraer_contacto(url: str, cfg: dict) -> dict:
    from scrapegraphai.graphs import SmartScraperGraph

    for ruta in ("", "/contacto", "/contact"):
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
PAUSA_S = float(os.environ.get("PAUSA_S", "20"))  # segundos entre sitios


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
    ap.add_argument("--auto", type=int, metavar="N", help="toma las siguientes N búsquedas de plan_busqueda.json (rota sola; al terminar todas vuelve a empezar)")
    args = ap.parse_args()

    cfg = config_llm()
    DATOS.mkdir(exist_ok=True)
    vistos = ya_vistos()
    nuevos = 0
    lote: list[dict] = []

    consultas = plan_auto(args.auto) if args.auto else leer_consultas(Path(args.consultas))
    for pais, tipo, idioma, consulta in consultas:
        print(f"\n🔎 {consulta}")
        try:
            sitios = buscar_sitios(consulta, args.max_por_consulta, cfg)
        except Exception as e:  # noqa: BLE001
            print(f"  ✖ la búsqueda falló: {type(e).__name__}: {str(e)[:200]}")
            if "401" in str(e) or "Authentication" in type(e).__name__:
                sys.exit("La llave de la IA fue rechazada (401): revisa LLM_API_KEY en .env")
            continue
        for url in sitios:
            time.sleep(PAUSA_S)  # respeta el límite por minuto de la IA
            dom = dominio_de(url)
            if dom in vistos:
                continue
            try:
                c = extraer_contacto(url, cfg)
            except Exception as e:  # noqa: BLE001
                print(f"  ✖ {dom}: {type(e).__name__}")
                continue
            if not c or c.get("es_cnc") is False:
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
    if args.enviar and lote:
        lista = [dict(p) for p in lote]
        for p in lista:
            p["id"] = p.get("dominio", "")
            p["region"] = p.pop("estado", "")
        req = urllib.request.Request(args.enviar, data=json.dumps({"prospectos": lista}).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=60) as r:
            print(f"Enviados {len(lista)} a n8n ({r.status}); n8n agrega sólo los que no estén en la hoja.")


if __name__ == "__main__":
    main()
