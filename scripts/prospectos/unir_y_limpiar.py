#!/usr/bin/env python3
"""
Une todos los datos/*.jsonl, quita duplicados (por dominio y por correo),
valida correos y genera datos/prospectos.csv con las columnas de control que
usa el agente de n8n.

    python unir_y_limpiar.py            # -> datos/prospectos.csv
    python unir_y_limpiar.py otra/ruta  # une los .jsonl de otra carpeta
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

AQUI = Path(__file__).resolve().parent
COLUMNAS = [
    "id", "empresa", "tipo", "tamano", "pais", "region", "ciudad", "web", "dominio", "email",
    "telefono", "whatsapp", "facebook", "instagram", "linkedin", "youtube", "tiktok",
    "productos_servicios", "idioma", "segmento", "fuente_url",
    # control del agente
    "fecha_alta", "estatus", "paso", "ultimo_contacto", "proximo_contacto", "token", "notas",
]
EMAIL_RE = re.compile(r"^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$")
TIPOS = {"Taller (cliente y vendedor)", "Cliente comprador", "Proveedor", "Instructor/Capacitación", "Servicios CNC"}
CORREOS_BASURA = ("example.", "sentry", "wixpress", "domain.com", "email.com", "tucorreo", "yourmail", ".png", ".jpg")


def dominio_de(url: str) -> str:
    url = (url or "").strip().lower()
    if not url:
        return ""
    if "://" not in url:
        url = "https://" + url
    p = urlparse(url)
    host = p.netloc[4:] if p.netloc.startswith("www.") else p.netloc
    # perfiles de redes: conserva la ruta para que cada página sea única
    if any(r in host for r in ("facebook.com", "instagram.com", "youtube.com", "tiktok.com", "linkedin.com")):
        return (host + p.path).rstrip("/")
    return host


def limpiar_email(e: str) -> str:
    e = (e or "").strip().lower().replace("mailto:", "").split("?")[0].split(",")[0].split(";")[0].strip()
    if not EMAIL_RE.match(e) or any(b in e for b in CORREOS_BASURA):
        return ""
    return e


def limpiar_url(u: str) -> str:
    u = (u or "").strip()
    if u and not u.startswith("http"):
        u = "https://" + u.lstrip("/")
    return u


def main() -> None:
    carpeta = Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI / "datos"
    filas, por_dom, por_mail = [], {}, {}
    leidas = 0
    for f in sorted(carpeta.glob("*.jsonl")):
        for linea in f.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if not linea:
                continue
            try:
                d = json.loads(linea)
            except json.JSONDecodeError:
                continue
            leidas += 1
            web = limpiar_url(d.get("web", ""))
            dom = dominio_de(d.get("dominio") or web or d.get("facebook") or d.get("youtube") or "")
            email = limpiar_email(d.get("email", ""))
            if not dom and email:
                dom = email.split("@")[1]
            if not dom or not (d.get("empresa") or "").strip():
                continue
            if not (email or d.get("telefono") or d.get("whatsapp") or d.get("facebook") or d.get("instagram")):
                continue
            previo = por_dom.get(dom) or (por_mail.get(email) if email else None)
            if previo:  # duplicado: completa huecos del que ya estaba
                for k, v in d.items():
                    k2 = "region" if k == "estado" else k
                    if k2 in previo and not previo[k2] and isinstance(v, str):
                        previo[k2] = v.strip()
                if email and not previo["email"]:
                    previo["email"] = email
                    por_mail[email] = previo
                continue
            tipo = d.get("tipo", "").strip()
            fila = {c: "" for c in COLUMNAS}
            fila.update({
                "id": dom,
                "empresa": d.get("empresa", "").strip(),
                "tipo": tipo if tipo in TIPOS else "Taller (cliente y vendedor)",
                "tamano": d.get("tamano", "").strip(),
                "pais": d.get("pais", "").strip(),
                "region": d.get("estado", "").strip(),
                "ciudad": d.get("ciudad", "").strip(),
                "web": web,
                "dominio": dom,
                "email": email,
                "telefono": d.get("telefono", "").strip(),
                "whatsapp": d.get("whatsapp", "").strip(),
                "facebook": limpiar_url(d.get("facebook", "")),
                "instagram": limpiar_url(d.get("instagram", "")),
                "linkedin": limpiar_url(d.get("linkedin", "")),
                "youtube": limpiar_url(d.get("youtube", "")),
                "tiktok": limpiar_url(d.get("tiktok", "")),
                "productos_servicios": d.get("productos_servicios", "").strip(),
                "idioma": (d.get("idioma") or "es").strip()[:2],
                "segmento": d.get("segmento", "").strip(),
                "fuente_url": d.get("fuente_url", "").strip(),
                "fecha_alta": date.today().isoformat(),
                # Sin correo no hay a quién escribir por ahora: queda para WhatsApp/redes.
                "estatus": "NUEVO" if email else "SIN_EMAIL",
                "paso": "0",
                "token": hashlib.sha256(f"hetna-baja:{dom}".encode()).hexdigest()[:16],
            })
            filas.append(fila)
            por_dom[dom] = fila
            if email:
                por_mail[email] = fila

    salida = carpeta / "prospectos.csv"
    with salida.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNAS)
        w.writeheader()
        w.writerows(filas)
    con_mail = sum(1 for r in filas if r["email"])
    print(f"{leidas} leídas → {len(filas)} únicas ({con_mail} con correo) → {salida}")
    resumen: dict[str, int] = {}
    for r in filas:
        resumen[f"{r['pais']} · {r['tipo']}"] = resumen.get(f"{r['pais']} · {r['tipo']}", 0) + 1
    for k, v in sorted(resumen.items()):
        print(f"  {v:4d}  {k}")


if __name__ == "__main__":
    main()
