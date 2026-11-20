#!/usr/bin/env python3
"""
Agente «Cazador de solicitudes»: busca en la web pública (última semana) gente
y empresas de México que PIDEN un servicio CNC (corte láser, router, plasma,
maquinado, piezas a la medida) y se lo manda a n8n (webhook hetna-cazador).

n8n hace el resto:
  - Si quien pide es una EMPRESA que publicó su correo en esa misma página, la
    agrega a la hoja de prospectos como «Cliente comprador» con segmento
    «solicitud»: la campaña de correo le manda una invitación que habla de lo
    que pidió (con liga de baja, dentro del límite diario de 40).
  - A ti te llega a Telegram cada solicitud con la respuesta lista y la liga a
    /cotizar ya llena, para contestar a mano donde se publicó (Facebook,
    foros...). A las personas no se les escribe por correo ni WhatsApp en frío.

    python cazar_solicitudes.py --enviar http://127.0.0.1:5678/webhook/hetna-cazador
    python cazar_solicitudes.py --probar          # sólo imprime, no manda nada

Variables (.env, las mismas de buscar_prospectos.py): LLM_API_KEY (Groq gsk_…
u OpenAI), LLM_MODEL opcional, BRAVE_API_KEY opcional, CAZADOR_TANDA (consultas
por corrida, 12 por defecto).
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
from buscar_prospectos import BASURA_MAIL, DATOS, EMAIL_EN_TEXTO, UA, buscar_web, dominio_de, modelo_groq  # noqa: E402

AQUI = Path(__file__).resolve().parent
VISTAS = DATOS / "solicitudes_vistas.txt"
ESTADO = DATOS / "cazador_estado.json"
CORREO_GRATIS = ("gmail.", "hotmail.", "outlook.", "yahoo.", "live.", "icloud.", "prodigy.", "aol.", "protonmail.")
# Sitios donde casi siempre son talleres ofreciendo, no clientes pidiendo
OFRECEN = ("mercadolibre.", "amazon.", "alibaba.", "made-in-china", "seccionamarilla", "cylex", "paginasamarillas",
           "youtube.com", "tiktok.com", "pinterest.", "wikipedia.org", "indeed.", "computrabajo.", "occ.com.mx", "linkedin.com/jobs", "/jobs/")

CONSULTAS = [
    '"busco" taller corte láser',
    '"busco quien" corte cnc',
    '"necesito" maquinado cnc piezas',
    '"alguien que" corte láser acrílico',
    '"alguien que" maquine piezas torno',
    '"quien me puede hacer" piezas cnc',
    '"solicito" servicio de corte láser',
    '"se solicita" proveedor maquinados cnc',
    '"requerimos" proveedor de maquinados',
    '"requiero" cotización corte plasma lámina',
    '"busco" router cnc mdf corte',
    '"necesito" letras corpóreas acrílico corte',
    '"cotización" corte láser acero inoxidable "necesito"',
    'licitación servicio de maquinado piezas',
    'licitación corte láser señalética',
    '"busco proveedor" piezas metálicas a la medida',
    '"necesito fabricar" piezas cnc prototipo',
    '"me pueden cotizar" corte cnc',
    '"busco taller" maquinados',
    '"necesito" celosías corte cnc',
]
CIUDADES = ["", "CDMX", "Guadalajara", "Monterrey", "Puebla", "Querétaro", "León", "Toluca", "Tlaxcala", "Tijuana", "Mérida", "Aguascalientes"]

PROMPT = """Eres analista de HETNA CNC, marketplace mexicano de talleres CNC (corte láser, router, plasma, torno, fresadora, impresión 3D, piezas a la medida).
Te paso un resultado de búsqueda y el texto de la página. Decide si es una SOLICITUD REAL Y RECIENTE de alguien que NECESITA que le fabriquen o corten algo en México.

NO es solicitud: un taller que ofrece sus servicios, un anuncio de venta, un tutorial, una noticia, una bolsa de trabajo (buscan empleados), alguien vendiendo una máquina, o publicaciones de otro país.
Sí puede ser: una persona o empresa preguntando "¿alguien que haga…?", "busco quien…", "necesito cotización de…", una empresa buscando proveedor, una licitación pública o privada.

Reglas: NO inventes datos. "email" sólo si aparece literal en el texto y es de quien pide (no del sitio ni de un taller). Si no sabes un dato, pon "".

Responde SOLO JSON con estas llaves:
{"es_solicitud": true/false, "calificacion": 1-5 (5 = cliente claro con pieza, cantidad y ciudad), "motivo": "por qué sí o no, 1 frase",
 "quien": "empresa" | "persona" | "gobierno" | "desconocido", "empresa": "", "email": "",
 "servicio": "corte láser | router | plasma | maquinado | impresión 3D | diseño | otro", "pieza": "", "material": "", "medidas": "", "cantidad": "",
 "ciudad": "", "fecha": "AAAA-MM-DD o ''", "resumen": "qué necesita en 1 frase",
 "respuesta": "comentario breve y amable (máx. 350 caracteres) para contestarle donde publicó: que en HETNA CNC talleres verificados de su zona le cotizan sin costo y que puede ver un precio aproximado en la liga {liga}. Sin exagerar, sin emojis de más."}

RESULTADO:
Título: {titulo}
URL: {url}
Fragmento: {fragmento}

TEXTO DE LA PÁGINA (recortado):
{texto}
"""


def leer_vistas() -> set[str]:
    return set(VISTAS.read_text(encoding="utf-8").split()) if VISTAS.exists() else set()


def guardar_vista(url: str) -> None:
    DATOS.mkdir(exist_ok=True)
    with VISTAS.open("a", encoding="utf-8") as f:
        f.write(url + "\n")


def texto_de(url: str) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            crudo = r.read(1_500_000).decode("utf-8", "ignore")
    except Exception:
        return ""
    crudo = re.sub(r"(?is)<(script|style|noscript|svg).*?</\1>", " ", crudo)
    crudo = re.sub(r"(?s)<[^>]+>", " ", crudo)
    return re.sub(r"\s+", " ", crudo).strip()


_modelo: dict = {}


def preguntar_ia(prompt: str) -> dict | None:
    """Chat con salida JSON. Groq (gsk_…) u OpenAI, con la misma llave del buscador."""
    clave = os.environ.get("LLM_API_KEY", "").strip()
    if not clave:
        sys.exit("Falta LLM_API_KEY en .env")
    if not _modelo:
        pedido = os.environ.get("LLM_MODEL", "").strip()
        if clave.startswith("gsk_"):
            _modelo["url"] = "https://api.groq.com/openai/v1/chat/completions"
            _modelo["nombre"] = modelo_groq(clave, pedido.split("/", 1)[1] if pedido.startswith("groq/") else "")
        else:
            _modelo["url"] = "https://api.openai.com/v1/chat/completions"
            _modelo["nombre"] = pedido.split("/", 1)[1] if pedido.startswith("openai/") else "gpt-4o-mini"
    cuerpo = json.dumps({
        "model": _modelo["nombre"], "temperature": 0, "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    for intento in range(4):
        try:
            req = urllib.request.Request(_modelo["url"], data=cuerpo, headers={
                "Authorization": f"Bearer {clave}", "Content-Type": "application/json", "User-Agent": "cazador-hetna"})
            with urllib.request.urlopen(req, timeout=60) as r:
                datos = json.load(r)
            return json.loads(datos["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as e:
            espera = 20 * (intento + 1) if e.code == 429 else 5
            print(f"  … IA respondió {e.code}; reintento en {espera} s")
            time.sleep(espera)
        except Exception as e:  # noqa: BLE001
            print(f"  … IA falló ({type(e).__name__}); reintento")
            time.sleep(5)
    return None


def correo_valido(email: str, texto: str, url: str) -> str:
    """El correo tiene que venir literal en la página y no ser basura ni del propio sitio de anuncios."""
    e = (email or "").strip().lower()
    if not e or "@" not in e or e not in texto.lower() or any(b in e for b in BASURA_MAIL):
        return ""
    if not EMAIL_EN_TEXTO.fullmatch(e):
        return ""
    if dominio_de(url) and e.endswith("@" + dominio_de(url)) and any(x in dominio_de(url) for x in ("facebook", "reddit", "foro")):
        return ""
    return e


def tanda_de_hoy(n: int) -> list[str]:
    """Rota consultas × ciudades: cada corrida toma las siguientes n combinaciones."""
    combos = [f"{c} {ciudad}".strip() for ciudad in CIUDADES for c in CONSULTAS]
    try:
        i = json.loads(ESTADO.read_text())["i"]
    except Exception:
        i = 0
    hoy = [combos[(i + k) % len(combos)] for k in range(n)]
    DATOS.mkdir(exist_ok=True)
    ESTADO.write_text(json.dumps({"i": (i + n) % len(combos)}))
    return hoy


def cazar(n: int, probar: bool) -> list[dict]:
    vistas = leer_vistas()
    hallazgos: list[dict] = []
    for consulta in tanda_de_hoy(n):
        print(f"• {consulta}")
        for r in buscar_web(consulta, 10, tiempo="w"):
            url = (r.get("href") or r.get("url") or "").split("#")[0]
            if not url.startswith("http") or url in vistas or any(x in url for x in OFRECEN):
                continue
            vistas.add(url)
            if not probar:
                guardar_vista(url)
            texto = texto_de(url)
            liga = "{liga}"
            d = preguntar_ia(PROMPT.replace("{titulo}", r.get("title", "")[:200]).replace("{url}", url)
                             .replace("{fragmento}", r.get("body", "")[:600]).replace("{texto}", texto[:5000]).replace("{liga}", liga))
            time.sleep(2)  # Groq gratis: pocas peticiones por minuto
            if not d or not d.get("es_solicitud") or int(d.get("calificacion") or 0) < 3:
                continue
            d["email"] = correo_valido(d.get("email", ""), texto + " " + r.get("body", ""), url)
            dom = d["email"].split("@")[1] if d["email"] else ""
            d["correo_de_empresa"] = bool(d["email"] and d.get("quien") in ("empresa", "gobierno") and not any(dom.startswith(g) for g in CORREO_GRATIS))
            d.update({"url": url, "titulo": r.get("title", "")[:200], "consulta": consulta, "encontrado": date.today().isoformat()})
            print(f"  ✓ {d.get('calificacion')}/5 {d.get('resumen', '')[:90]}")
            hallazgos.append(d)
    return hallazgos


def enviar(url: str, lista: list[dict]) -> None:
    req = urllib.request.Request(url, data=json.dumps({"solicitudes": lista}).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": "cazador-hetna"})
    with urllib.request.urlopen(req, timeout=60) as r:
        print(f"n8n respondió {r.status}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--enviar", metavar="URL", help="webhook hetna-cazador de n8n")
    ap.add_argument("--tanda", type=int, default=int(os.environ.get("CAZADOR_TANDA", "12")))
    ap.add_argument("--probar", action="store_true", help="no marca vistas ni manda a n8n")
    a = ap.parse_args()
    lista = cazar(a.tanda, a.probar)
    print(f"Solicitudes encontradas: {len(lista)}")
    DATOS.mkdir(exist_ok=True)
    with (DATOS / "solicitudes.jsonl").open("a", encoding="utf-8") as f:
        for d in lista:
            f.write(json.dumps(d, ensure_ascii=False) + "\n")
    if a.enviar and not a.probar:
        enviar(a.enviar, lista)  # también si va vacía: n8n avisa que hoy no hubo


if __name__ == "__main__":
    main()
