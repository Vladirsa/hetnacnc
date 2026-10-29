#!/usr/bin/env python3
"""API de HETNA sobre Boxes.py (GPL-3.0, https://github.com/florianfesti/boxes).

Corre como servicio aparte en el VPS (puerto interno, no público). La tienda le
pide la lista de generadores, los parámetros de cada uno (ya en español) y el
archivo generado; la interfaz la pone la tienda.

Rutas (todas GET):
  /salud                      -> {"ok": true, "generadores": N}
  /generadores                -> lista [{id, nombre, grupo, descripcion, miniatura}]
  /generadores/<Id>           -> {id, nombre, descripcion, grupos:[{titulo, args:[...]}], formatos:[...]}
  /generar/<Id>?formato=svg&x=100&...  -> el archivo (svg, dxf, pdf, lbrn2, ps)
  /miniatura/<Id>             -> la imagen de muestra de Boxes.py (jpg)

Boxes.py mismo no se modifica: se importa tal cual. Esto es sólo un envoltorio.
"""
import gettext
import importlib
import io
import json
import mimetypes
import os
import pkgutil
import sys
import tempfile
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

import boxes
import boxes.generators as generadores_mod
from boxes import ArgparseEdgeType, BoolArg

PUERTO = int(os.environ.get("PUERTO", "8012"))
RAIZ_BOXES = os.environ.get("BOXES_SRC", "/opt/boxes")
MINIATURAS = os.path.join(RAIZ_BOXES, "static", "samples")
LOCALE = os.path.join(RAIZ_BOXES, "locale")

# Grupos de Boxes.py con su nombre para la tienda y su orden
GRUPOS = {
    "Box": ("cajas", "Cajas"),
    "FlexBox": ("cajas-curvas", "Cajas curvas y redondas"),
    "Tray": ("bandejas", "Bandejas y organizadores"),
    "Shelf": ("estantes", "Estantes y soportes"),
    "WallMounted": ("pared", "Para colgar en la pared"),
    "Holes": ("agujeros", "Patrones de agujeros"),
    "Part": ("piezas", "Piezas y mecanismos"),
    "Misc": ("varios", "Lámparas, juegos y más"),
}
# Grupos que no se ofrecen: inestables, apicultura y plantillas internas
OCULTOS = {"Unstable", "Beekeeping"}
OCULTOS_ID = {"BOX", "WallXXX", "TrayLayout", "TrayLayout2"}
# Argumentos de Boxes.py que la tienda maneja sola o que no tienen sentido en web
ARGS_OCULTOS = {"output", "format", "debug", "qr_code", "reference", "labels"}
# Etiquetas cortas en español para los parámetros más comunes (el resto sale
# de la traducción de Boxes.py)
ETIQUETAS = {
    "x": "Ancho (x)", "y": "Fondo (y)", "h": "Alto (h)", "hi": "Alto interior", "sx": "Anchos (x)", "sy": "Fondos (y)", "sh": "Altos",
    "thickness": "Espesor del material", "burn": "Kerf (corrección de corte)", "outside": "Medidas exteriores",
    "top_edge": "Canto superior", "bottom_edge": "Canto inferior", "vertical_edges": "Uniones verticales",
    "tabs": "Pestañas de sujeción", "spacing": "Separación entre piezas", "inner_corners": "Esquinas interiores",
    "radius": "Radio", "width": "Ancho", "height": "Alto", "depth": "Fondo", "length": "Largo", "diameter": "Diámetro",
    "lid": "Tapa", "angle": "Ángulo", "n": "Cantidad", "d": "Diámetro",
}

try:
    TRAD = gettext.translation("boxes.py", localedir=LOCALE, languages=["es"])
except Exception:
    TRAD = gettext.NullTranslations()
_ = TRAD.gettext


def _sin_liga(texto):
    """Quita el '[🛈](url)' que Boxes.py agrega a muchas ayudas."""
    if not texto:
        return ""
    i = texto.find("[\U0001F6C8]")
    return (texto[:i] if i >= 0 else texto).strip()


def cargar_generadores():
    res = {}
    for m in pkgutil.iter_modules(generadores_mod.__path__):
        try:
            mod = importlib.import_module("boxes.generators." + m.name)
        except Exception:
            continue
        for nombre, clase in vars(mod).items():
            if not (isinstance(clase, type) and issubclass(clase, boxes.Boxes)):
                continue
            if clase.__module__ != mod.__name__ or clase is boxes.Boxes:
                continue
            grupo = getattr(clase, "ui_group", "Misc")
            if grupo in OCULTOS or nombre in OCULTOS_ID or grupo not in GRUPOS:
                continue
            res[nombre] = clase
    return res


GENERADORES = cargar_generadores()


def ficha(nombre, clase):
    doc = (clase.__doc__ or "").strip().split("\n")[0]
    gid, gnombre = GRUPOS[getattr(clase, "ui_group", "Misc")]
    return {
        "id": nombre,
        "nombre": _(nombre),
        "descripcion": _(doc) if doc else "",
        "grupo": gid,
        "grupoNombre": gnombre,
        "miniatura": f"/miniatura/{nombre}",
    }


def tipo_arg(accion):
    t = accion.type
    if isinstance(t, BoolArg):
        return "bool"
    if isinstance(t, ArgparseEdgeType):
        return "borde"
    if t is int:
        return "int"
    if t is float:
        return "float"
    return "texto"


def esquema(nombre):
    clase = GENERADORES[nombre]
    caja = clase()
    caja.translations = TRAD
    grupos = []
    for g in caja.argparser._action_groups:
        args = []
        for a in g._group_actions:
            if a.dest in ("help",) or a.dest in ARGS_OCULTOS:
                continue
            tipo = tipo_arg(a)
            opciones = None
            if isinstance(a.type, ArgparseEdgeType):
                opciones = [{"valor": e, "nombre": _(f"{e} {a.type.names.get(e, '')}").strip()} for e in a.type.edges]
            elif a.choices:
                opciones = [{"valor": c, "nombre": _(str(c))} for c in a.choices]
            default = a.default
            if isinstance(a.type, BoolArg):
                default = bool(default)
            args.append({
                "nombre": a.dest,
                "etiqueta": ETIQUETAS.get(a.dest) or _(a.dest.split("_")[-1]).replace("_", " ").capitalize(),
                "tipo": tipo,
                "default": default if isinstance(default, (int, float, bool, str)) or default is None else str(default),
                "ayuda": _sin_liga(_(a.help or "")),
                "opciones": opciones,
            })
        if not args:
            continue
        titulo = g.title or ""
        if titulo == "positional arguments":
            continue
        titulo = "Material y corte" if titulo == "Default Settings" else _(titulo)
        grupos.append({"titulo": titulo, "args": args})
    return {**ficha(nombre, clase), "grupos": grupos, "formatos": caja.formats.getFormats()}


def generar(nombre, params, formato):
    clase = GENERADORES[nombre]
    caja = clase()
    caja.translations = TRAD
    argv = []
    for a in caja.argparser._actions:
        if a.dest in ("help", "output", "format") or a.dest not in params:
            continue
        v = params[a.dest]
        if isinstance(a.type, BoolArg):
            v = "1" if v in ("1", "true", "on", "True") else "0"
        argv.append(f"--{a.dest}={v}")
    # labels/reference: siempre sin rectángulo de referencia; etiquetas si el usuario las pidió
    argv.append("--reference=0")
    with tempfile.TemporaryDirectory() as d:
        salida = os.path.join(d, "pieza." + formato)
        argv += [f"--format={formato}", f"--output={salida}"]
        caja.parseArgs(argv)
        caja.open()
        caja.render()
        datos = caja.close()
        if datos is not None:
            if hasattr(datos, "read"):
                return datos.read()
            return bytes(datos)
        with open(salida, "rb") as f:
            return f.read()


class Manejador(BaseHTTPRequestHandler):
    def _json(self, obj, codigo=200):
        cuerpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        self.wfile.write(cuerpo)

    def _bytes(self, datos, tipo, nombre=None, cache=3600):
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(datos)))
        self.send_header("Cache-Control", f"public, max-age={cache}")
        if nombre:
            self.send_header("Content-Disposition", f'inline; filename="{nombre}"')
        self.end_headers()
        self.wfile.write(datos)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    def do_GET(self):
        u = urlparse(self.path)
        partes = [unquote(p) for p in u.path.strip("/").split("/") if p]
        q = {k: v[-1] for k, v in parse_qs(u.query, keep_blank_values=True).items()}
        try:
            if partes == ["salud"]:
                return self._json({"ok": True, "generadores": len(GENERADORES)})
            if partes == ["generadores"]:
                lista = [ficha(n, c) for n, c in sorted(GENERADORES.items())]
                return self._json({"grupos": [{"id": g, "nombre": n} for g, n in GRUPOS.values()], "generadores": lista})
            if len(partes) == 2 and partes[0] == "generadores" and partes[1] in GENERADORES:
                return self._json(esquema(partes[1]))
            if len(partes) == 2 and partes[0] == "miniatura" and partes[1] in GENERADORES:
                ruta = os.path.join(MINIATURAS, partes[1] + "-thumb.jpg")
                if not os.path.exists(ruta):
                    ruta = os.path.join(RAIZ_BOXES, "static", "nothing.png")
                with open(ruta, "rb") as f:
                    return self._bytes(f.read(), mimetypes.guess_type(ruta)[0] or "image/jpeg", cache=86400)
            if len(partes) == 2 and partes[0] == "generar" and partes[1] in GENERADORES:
                formato = q.pop("formato", "svg")
                caja = GENERADORES[partes[1]]()
                if formato not in caja.formats.getFormats():
                    return self._json({"error": f"formato no disponible: {formato}"}, 400)
                datos = generar(partes[1], q, formato)
                tipos = {"svg": "image/svg+xml; charset=utf-8", "dxf": "image/vnd.dxf", "pdf": "application/pdf",
                         "lbrn2": "application/octet-stream", "ps": "application/postscript", "gcode": "text/plain"}
                return self._bytes(datos, tipos.get(formato, "application/octet-stream"), f"{partes[1]}.{formato}", cache=0)
            return self._json({"error": "no existe"}, 404)
        except SystemExit:
            return self._json({"error": "parámetros inválidos"}, 400)
        except Exception as e:
            traceback.print_exc()
            return self._json({"error": str(e)[:300]}, 500)


if __name__ == "__main__":
    print(f"HETNA cajas: {len(GENERADORES)} generadores en :{PUERTO}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PUERTO), Manejador).serve_forever()
