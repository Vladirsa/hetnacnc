"""Bridge CAM 2D por operaciones (CAM Studio, fase B).

Igual que dxf_gcode.py, pero en vez de un solo "corta la pieza" recibe una
lista de operaciones, cada una con su capa del DXF, su herramienta y su
profundidad:

    corte          la pieza completa: barrenos por dentro, borde por fuera, pestañas
    fuera / dentro contorno por fuera o por dentro de la línea
    linea          sobre la línea (sirve con trazos abiertos)
    cajeado        vaciar el área a una profundidad
    grabado_v      grabado en V (profundidad según el ancho, como un V-carve)
    barrenado      barrenos en el centro de cada círculo
    laser_corte    láser: cortar el contorno
    laser_linea    láser: marcar la línea
    laser_relleno  láser: rellenar el área con líneas (grabado)

El postprocesador cambia el encabezado y el final (Mach3, GRBL, LinuxCNC o
láser GRBL). Devuelve el mismo contrato de errores que dxf_gcode.py.

uso: cam2d.py entrada.dxf salida.nc config.json
"""
from __future__ import annotations

import json
import math
import os
import sys
from dataclasses import dataclass
from functools import reduce

import ezdxf
from ezdxf import disassemble
from ezdxf import path as dxfpath
from shapely.geometry import LineString, MultiPolygon, Polygon

sys.path.insert(0, os.path.dirname(__file__))
from dxf_gcode import error, parametros_de_corte  # noqa: E402

TOL = 0.05  # mm al pasar curvas a rectas
UNIR = 0.02  # mm para unir trazos sueltos punta con punta
MAX_LINEAS = 400_000  # G-code demasiado grande = algo salió mal (relleno o V muy finos)

TIPOS_ROUTER = {"corte", "fuera", "dentro", "linea", "cajeado", "grabado_v", "barrenado"}
TIPOS_LASER = {"laser_corte", "laser_linea", "laser_relleno"}

NOMBRES = {
    "corte": "Corte de pieza",
    "fuera": "Contorno por fuera",
    "dentro": "Contorno por dentro",
    "linea": "Sobre la línea",
    "cajeado": "Cajeado",
    "grabado_v": "Grabado en V",
    "barrenado": "Barrenado",
    "laser_corte": "Láser: corte",
    "laser_linea": "Láser: línea",
    "laser_relleno": "Láser: relleno",
}


@dataclass
class Trazo:
    capa: str
    pts: list[tuple[float, float]]
    cerrado: bool


# --- Lectura -------------------------------------------------------------


def _unir_sueltos(trazos: list[Trazo]) -> list[Trazo]:
    """Une líneas y arcos sueltos que se tocan en la punta (muchos DXF traen
    el contorno en pedacitos). Sólo dentro de la misma capa."""
    abiertos = [t for t in trazos if not t.cerrado]
    listos = [t for t in trazos if t.cerrado]
    porcapa: dict[str, list[list[tuple[float, float]]]] = {}
    for t in abiertos:
        porcapa.setdefault(t.capa, []).append(list(t.pts))
    for capa, piezas in porcapa.items():
        while piezas:
            cadena = piezas.pop()
            cambio = True
            while cambio:
                cambio = False
                for i, p in enumerate(piezas):
                    a0, a1 = cadena[0], cadena[-1]
                    b0, b1 = p[0], p[-1]
                    d = lambda u, v: math.hypot(u[0] - v[0], u[1] - v[1])  # noqa: E731
                    if d(a1, b0) < UNIR:
                        cadena = cadena + p[1:]
                    elif d(a1, b1) < UNIR:
                        cadena = cadena + p[::-1][1:]
                    elif d(a0, b1) < UNIR:
                        cadena = p + cadena[1:]
                    elif d(a0, b0) < UNIR:
                        cadena = p[::-1] + cadena[1:]
                    else:
                        continue
                    piezas.pop(i)
                    cambio = True
                    break
            cerrado = len(cadena) > 3 and math.hypot(cadena[0][0] - cadena[-1][0], cadena[0][1] - cadena[-1][1]) < UNIR
            if cerrado:
                cadena = cadena[:-1]
            listos.append(Trazo(capa, cadena, cerrado))
    return listos


def leer_trazos(ruta: str) -> tuple[list[Trazo], list[str], float]:
    doc = ezdxf.readfile(ruta)
    msp = doc.modelspace()
    avisos: list[str] = []
    # $INSUNITS: 1 pulgadas, 4 mm, 5 cm, 6 m
    escala = {1: 25.4, 5: 10.0, 6: 1000.0}.get(int(doc.header.get("$INSUNITS", 4) or 4), 1.0)
    if escala != 1.0:
        avisos.append(f"El DXF viene en otras unidades: se convirtió a milímetros (×{escala:g}).")
    trazos: list[Trazo] = []
    ignorados: dict[str, int] = {}
    for e in disassemble.recursive_decompose(msp):
        tipo = e.dxftype()
        if tipo in ("TEXT", "MTEXT"):
            ignorados["texto"] = ignorados.get("texto", 0) + 1
            continue
        if tipo in ("HATCH", "DIMENSION", "POINT", "IMAGE", "SOLID", "3DFACE", "MESH"):
            ignorados[tipo] = ignorados.get(tipo, 0) + 1
            continue
        try:
            p = dxfpath.make_path(e)
        except (TypeError, ValueError):
            ignorados[tipo] = ignorados.get(tipo, 0) + 1
            continue
        capa = str(getattr(e.dxf, "layer", "0") or "0")
        for sub in p.sub_paths():
            pts = [(v.x * escala, v.y * escala) for v in sub.flattening(TOL)]
            if len(pts) < 2:
                continue
            cerrado = sub.is_closed or (len(pts) > 3 and math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < UNIR)
            if cerrado and math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < UNIR:
                pts = pts[:-1]
            trazos.append(Trazo(capa, pts, cerrado and len(pts) >= 3))
    trazos = _unir_sueltos(trazos)
    if ignorados.get("texto"):
        avisos.append(f"{ignorados.pop('texto')} texto(s) del DXF no se cortan: conviértelos a curvas en tu programa de dibujo.")
    for tipo, n in sorted(ignorados.items()):
        avisos.append(f"{n} entidad(es) {tipo} se omitieron.")
    return trazos, avisos, escala


def _poligonos(trazos: list[Trazo]) -> list[Polygon]:
    salida = []
    for t in trazos:
        if not t.cerrado or len(t.pts) < 3:
            continue
        p = Polygon(t.pts)
        if not p.is_valid:
            p = p.buffer(0)
        if not p.is_empty and p.area > 0.01:
            salida.append(p)
    return salida


def _region(polys: list[Polygon]):
    """Área con la regla par-impar: una figura dentro de otra es hueco."""
    if not polys:
        return Polygon()
    return reduce(lambda a, b: a.symmetric_difference(b), polys[1:], polys[0]).buffer(0)


def _anillos(geom) -> list[list[tuple[float, float]]]:
    salida = []
    if geom is None or geom.is_empty:
        return salida
    partes = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
    for parte in partes:
        if isinstance(parte, Polygon):
            salida.append(list(parte.exterior.coords))
            for h in parte.interiors:
                salida.append(list(h.coords))
        elif isinstance(parte, LineString):
            salida.append(list(parte.coords))
        elif hasattr(parte, "geoms"):
            salida.extend(_anillos(parte))
    return salida


def _largo(pts) -> float:
    return sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))


# --- Escritor de G-code ----------------------------------------------------


class Gcode:
    def __init__(self, post: str, seguridad: float, laser: bool, smax: float):
        self.post = post
        self.seg = seguridad
        self.laser = laser
        self.smax = smax
        self.lineas: list[str] = []
        self.x = 0.0
        self.y = 0.0
        self.z = seguridad
        self.corte = 0.0
        self.rapido = 0.0
        self.minutos = 0.0

    def c(self, texto: str):
        self.lineas.append(f"({texto.replace('(', '[').replace(')', ']')})")

    def emitir(self, linea: str):
        self.lineas.append(linea)
        if len(self.lineas) > MAX_LINEAS:
            raise OverflowError("demasiadas líneas")

    def subir(self):
        if not self.laser and self.z < self.seg:
            self.emitir(f"G0 Z{self.seg:.3f}")
            self.z = self.seg

    def ir(self, x: float, y: float):
        d = math.hypot(x - self.x, y - self.y)
        if d < 1e-4:
            return
        self.subir()
        self.emitir(f"G0 X{x:.3f} Y{y:.3f}")
        self.rapido += d
        self.minutos += d / 5000
        self.x, self.y = x, y

    def bajar(self, z: float, f: float):
        if self.laser:
            return
        self.emitir(f"G1 Z{z:.3f} F{f:.0f}")
        self.minutos += abs(self.z - z) / max(1, f)
        self.z = z

    def mover(self, x: float, y: float, f: float, z: float | None = None):
        d = math.hypot(x - self.x, y - self.y)
        if d < 1e-4 and (z is None or abs(z - self.z) < 1e-4):
            return
        if z is not None and not self.laser:
            self.emitir(f"G1 X{x:.3f} Y{y:.3f} Z{z:.3f} F{f:.0f}")
            self.z = z
        else:
            self.emitir(f"G1 X{x:.3f} Y{y:.3f} F{f:.0f}")
        self.corte += d
        self.minutos += d / max(1, f)
        self.x, self.y = x, y

    def encender_laser(self, potencia: float):
        s = max(0, min(self.smax, self.smax * potencia / 100))
        self.emitir(f"M4 S{s:.0f}" if self.post == "laser_grbl" else f"M3 S{s:.0f}")

    def apagar_laser(self):
        self.emitir("M5")


def _recorrer(g: Gcode, anillo, z: float, f: float, fz: float, tramos=(), z_pestana: float | None = None):
    """Un anillo (o trazo) a la profundidad z, subiendo a z_pestana dentro de
    los tramos de pestaña (distancias acumuladas desde el inicio)."""
    g.ir(anillo[0][0], anillo[0][1])
    g.bajar(z, fz)
    if not tramos:
        for x, y in anillo[1:]:
            g.mover(x, y, f)
        return
    rec = 0.0
    for i in range(1, len(anillo)):
        (x1, y1), (x2, y2) = anillo[i - 1], anillo[i]
        L = math.hypot(x2 - x1, y2 - y1)
        if L < 1e-6:
            continue
        # cortes del segmento en los bordes de las pestañas
        marcas = sorted({0.0, L, *[t - rec for par in tramos for t in par if rec < t < rec + L]})
        for a, b in zip(marcas, marcas[1:]):
            medio = rec + (a + b) / 2
            dentro = any(ini <= medio <= fin for ini, fin in tramos)
            zz = z_pestana if dentro and z_pestana is not None and z_pestana > z else z
            if abs(zz - g.z) > 1e-4:
                g.bajar(zz, fz)
            u = b / L
            g.mover(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, f)
        rec += L


def _pestanas(anillo, cuantas: int, largo: float):
    per = _largo(anillo)
    if cuantas <= 0 or per < largo * cuantas * 3:
        return []
    paso = per / cuantas
    return [(i * paso + paso / 2 - largo / 2, i * paso + paso / 2 + largo / 2) for i in range(cuantas)]


def _profundidades(total: float, pasada: float) -> list[float]:
    n = max(1, math.ceil(total / max(0.1, pasada) - 1e-6))
    return [-min(total, total * (i + 1) / n) for i in range(n)]


# --- Operaciones -----------------------------------------------------------


def op_contorno(g, polys, modo, r, prof, receta, pestanas, altura_pestana, avisos, nombre):
    figuras = 0
    if modo == "corte":
        # barrenos por dentro primero, luego el borde por fuera
        exteriores, interiores = [], []
        for i, p in enumerate(polys):
            (interiores if any(j != i and o.contains(p) for j, o in enumerate(polys)) else exteriores).append(p)
        trabajos = [(p, -r, False) for p in interiores] + [(p, r, True) for p in exteriores]
    else:
        trabajos = [(p, r if modo == "fuera" else -r, modo == "fuera") for p in polys]
    chicos = 0
    for p, desfase, con_pestanas in trabajos:
        anillos = _anillos(p.buffer(desfase, join_style=2 if desfase > 0 else 1, quad_segs=8)) if abs(desfase) > 1e-6 else _anillos(p)
        if not anillos:
            chicos += 1
            continue
        figuras += 1
        for anillo in anillos:
            if len(anillo) < 3:
                continue
            zs = _profundidades(prof, receta["profundidad_pasada"])
            for z in zs:
                tramos = _pestanas(anillo, pestanas, 6.0) if (con_pestanas and pestanas and z < -(prof - altura_pestana)) else []
                _recorrer(g, anillo, z, receta["avance"], receta["penetracion"], tramos, -(prof - altura_pestana))
        g.subir()
    if chicos:
        avisos.append(f"{nombre}: {chicos} figura(s) más chicas que la fresa se saltaron. Usa una fresa más delgada.")
    return figuras


def op_linea(g, trazos, prof, receta):
    n = 0
    for t in trazos:
        pts = list(t.pts) + ([t.pts[0]] if t.cerrado else [])
        if len(pts) < 2:
            continue
        n += 1
        for z in _profundidades(prof, receta["profundidad_pasada"]):
            # trazo abierto: ida y vuelta para no levantar entre pasadas
            _recorrer(g, pts, z, receta["avance"], receta["penetracion"])
            if not t.cerrado:
                pts = pts[::-1]
        g.subir()
    return n


def op_cajeado(g, polys, r, prof, receta, traslape, avisos):
    region = _region(polys)
    if region.is_empty:
        return 0
    paso = max(0.1, 2 * r * (1 - traslape))
    partes = list(region.geoms) if isinstance(region, MultiPolygon) else [region]
    hechas = 0
    for parte in partes:
        anillos_por_nivel = []
        d = r
        while True:
            g_ = parte.buffer(-d, join_style=1, quad_segs=8)
            if g_.is_empty:
                break
            anillos_por_nivel.append(_anillos(g_))
            d += paso
            if len(anillos_por_nivel) > 2000:
                break
        if not anillos_por_nivel:
            avisos.append("Cajeado: una zona es más angosta que la fresa y no se vació.")
            continue
        hechas += 1
        for z in _profundidades(prof, receta["profundidad_pasada"]):
            # de adentro hacia afuera: la orilla queda al final, más limpia
            for nivel in reversed(anillos_por_nivel):
                for anillo in nivel:
                    if len(anillo) >= 2:
                        _recorrer(g, anillo, z, receta["avance"], receta["penetracion"] * 0.5)
            g.subir()
    return hechas


def op_grabado_v(g, polys, angulo, prof_max, receta, avisos):
    """V-carve aproximado por desfases: la punta va a una distancia d de la
    orilla y a una profundidad d / tan(ángulo/2), así la pared queda justo en
    la línea. Donde se llega al máximo, se sigue plano."""
    region = _region(polys)
    if region.is_empty:
        return 0
    t = math.tan(math.radians(max(10, min(150, angulo)) / 2))
    paso = max(0.15, min(0.6, prof_max * t / 6))
    d = paso / 2
    niveles = 0
    while True:
        z = -min(prof_max, d / t)
        g_ = region.buffer(-d, join_style=1, quad_segs=6)
        if g_.is_empty:
            break
        for anillo in _anillos(g_):
            if len(anillo) >= 2:
                _recorrer(g, anillo, z, receta["avance"] * 0.8, receta["penetracion"])
        g.subir()
        niveles += 1
        # en lo plano el ancho de corte es mayor: se avanza más
        d += paso if d / t < prof_max else max(paso, 2 * prof_max * t * 0.7)
        if niveles > 3000:
            avisos.append("Grabado en V: la figura es muy grande para grabar en V; se cortó a la mitad. Usa cajeado.")
            break
    return 1 if niveles else 0


def op_barrenado(g, polys, diam, prof, receta, avisos):
    hechos = 0
    grandes = []
    for p in polys:
        # ¿es un círculo? (área contra perímetro)
        circ = 4 * math.pi * p.area / max(1e-9, p.length**2)
        if circ < 0.9:
            continue
        D = 2 * math.sqrt(p.area / math.pi)
        c = p.centroid
        if D > diam * 1.15:
            grandes.append(p)
            continue
        if D < diam * 0.85:
            avisos.append(f"Barreno de Ø{D:.1f} mm más chico que la fresa: sale de Ø{diam:g} mm.")
        g.ir(c.x, c.y)
        # picoteo: baja de a poco y sube para sacar viruta
        z = 0.0
        while z > -prof + 1e-6:
            z = max(-prof, z - receta["profundidad_pasada"])
            g.bajar(z, receta["penetracion"] * 0.6)
            g.emitir(f"G0 Z{0.5:.3f}")
            g.z = 0.5
        g.subir()
        hechos += 1
    if grandes:
        hechos += op_contorno(g, grandes, "dentro", diam / 2, prof, receta, 0, 0, avisos, "Barrenado")
    return hechos


def op_laser(g, trazos, polys, modo, potencia, velocidad, pasadas, separacion, avisos):
    n = 0
    if modo in ("corte", "linea"):
        for t in trazos:
            pts = list(t.pts) + ([t.pts[0]] if t.cerrado else [])
            if len(pts) < 2 or (modo == "corte" and not t.cerrado):
                continue
            n += 1
            for _ in range(max(1, pasadas)):
                g.ir(pts[0][0], pts[0][1])
                g.encender_laser(potencia)
                for x, y in pts[1:]:
                    g.mover(x, y, velocidad)
                g.apagar_laser()
        return n
    # relleno: líneas horizontales en zigzag, recortadas al área
    region = _region(polys)
    if region.is_empty:
        return 0
    x0, y0, x1, y1 = region.bounds
    sep = max(0.05, separacion)
    if (y1 - y0) / sep > 20000:
        avisos.append("Láser relleno: el área es muy grande para esa separación; se subió la separación.")
        sep = (y1 - y0) / 20000
    y = y0 + sep / 2
    derecha = True
    for _ in range(max(1, pasadas)):
        while y < y1:
            linea = LineString([(x0 - 1, y), (x1 + 1, y)]).intersection(region)
            partes = [linea] if isinstance(linea, LineString) else list(getattr(linea, "geoms", []))
            partes = [p for p in partes if isinstance(p, LineString) and p.length > 0.01]
            partes.sort(key=lambda p: p.bounds[0], reverse=not derecha)
            for p in partes:
                a, b = list(p.coords)[0], list(p.coords)[-1]
                if (a[0] > b[0]) == derecha:
                    a, b = b, a
                g.ir(a[0], a[1])
                g.encender_laser(potencia)
                g.mover(b[0], b[1], velocidad)
                g.apagar_laser()
            derecha = not derecha
            y += sep
        y = y0 + sep / 2
    return 1


# --- Principal -------------------------------------------------------------


def generar(ruta_dxf: str, ruta_salida: str, config: dict) -> dict:
    try:
        material = str(config.get("material", "mdf"))
        espesor = float(config.get("espesor", 18))
        maquina = config.get("maquina") or {}
        tipo_maquina = "laser" if maquina.get("tipo") == "laser" else "router"
        post = str(maquina.get("post", "mach3"))
        if tipo_maquina == "laser" and post not in ("laser_grbl", "grbl"):
            post = "laser_grbl"
        seguridad = float(maquina.get("seguridad", 5))
        smax = float(maquina.get("smax", 1000))
        ops = config.get("operaciones") or []
        if not ops:
            return error("entrada_invalida", "No hay operaciones.", "Agrega al menos una operación (por ejemplo, Corte de pieza).")
        if len(ops) > 20:
            return error("fuera_de_rango", "Son demasiadas operaciones.", "Usa 20 o menos.")
        try:
            trazos, avisos, _ = leer_trazos(ruta_dxf)
        except (ezdxf.DXFStructureError, IOError) as e:
            return error("formato_no_soportado", f"El archivo no se pudo leer como DXF: {e}",
                         "Vuelve a exportarlo como DXF R2010 o posterior.")
        if not trazos:
            return error("sin_geometria", "El archivo no trae trazos que se puedan cortar.",
                         "Revisa que el dibujo tenga líneas o curvas (no sólo texto o imágenes).", advertencias=avisos)

        tipos = [str(o.get("tipo", "")) for o in ops]
        for corte in ("corte", "fuera", "laser_corte"):
            if corte in tipos and any(t not in ("corte", "fuera", "laser_corte") for t in tipos[tipos.index(corte) + 1:]):
                avisos.append("Conviene dejar el corte de la pieza al final: si la pieza se suelta antes, las demás operaciones se mueven.")
                break
        g = Gcode(post, seguridad, tipo_maquina == "laser", smax)
        g.c(f"HETNA CAM Studio 2D - {material} {espesor:g} mm - post {post}")
        g.emitir("G21 G90 G17 G94")
        rpm_actual = None
        resumen = []
        for i, op in enumerate(ops, 1):
            tipo = str(op.get("tipo", ""))
            if tipo not in TIPOS_ROUTER | TIPOS_LASER:
                avisos.append(f"Operación {i}: tipo desconocido, se omitió.")
                continue
            if (tipo in TIPOS_LASER) != (tipo_maquina == "laser"):
                avisos.append(f"Operación {i} ({NOMBRES[tipo]}): no es para esta máquina, se omitió.")
                continue
            capa = op.get("capa")
            sel = [t for t in trazos if not capa or t.capa == capa]
            polys = _poligonos(sel)
            antes = (g.corte, g.minutos)
            nombre = f"{i}. {NOMBRES[tipo]}"
            g.c(nombre + (f" - capa {capa}" if capa else ""))
            if tipo in TIPOS_ROUTER:
                diam = float(op.get("diametro", 6))
                if not (0.1 <= diam <= 30):
                    return error("entrada_invalida", f"Operación {i}: diámetro de fresa no válido.", "Captúralo en mm, entre 0.1 y 30.")
                receta = parametros_de_corte(material, diam if tipo != "grabado_v" else max(3, diam))
                if not receta:
                    return error("entrada_invalida", f"No conozco el material '{material}'.", "Elige uno de la lista.")
                if op.get("pasada"):
                    receta["profundidad_pasada"] = max(0.1, float(op["pasada"]))
                prof = float(op.get("profundidad") or espesor)
                prof = max(0.05, min(prof, espesor + 2))
                if rpm_actual != receta["rpm"]:
                    if rpm_actual is not None:
                        g.subir()
                        g.emitir("M5")
                        g.c(f"Cambia la herramienta: {op.get('herramienta') or f'fresa {diam:g} mm'}")
                        g.emitir("M0")
                    g.emitir(f"M3 S{receta['rpm']}")
                    rpm_actual = receta["rpm"]
                if tipo in ("corte", "fuera", "dentro"):
                    figuras = op_contorno(g, polys, tipo, diam / 2, prof, receta,
                                          int(op.get("pestanas", 4 if tipo != "dentro" else 0)) if op.get("con_pestanas", True) else 0,
                                          min(prof * 0.5, float(op.get("alto_pestana", 1.5))), avisos, nombre)
                elif tipo == "linea":
                    figuras = op_linea(g, sel, prof, receta)
                elif tipo == "cajeado":
                    figuras = op_cajeado(g, polys, diam / 2, prof, receta, float(op.get("traslape", 0.4)), avisos)
                elif tipo == "grabado_v":
                    figuras = op_grabado_v(g, polys, float(op.get("angulo", 90)), prof, receta, avisos)
                else:
                    figuras = op_barrenado(g, polys, diam, prof, receta, avisos)
                g.subir()
            else:
                figuras = op_laser(g, sel, polys, tipo.split("_")[1], float(op.get("potencia", 80)),
                                   float(op.get("velocidad", 1500)), int(op.get("pasadas", 1)), float(op.get("separacion", 0.15)), avisos)
            if figuras == 0:
                avisos.append(f"{nombre}: no encontró figuras para trabajar" + (" (revisa la capa)." if capa else " (necesita contornos cerrados)."))
            resumen.append({
                "tipo": tipo,
                "nombre": NOMBRES[tipo],
                "capa": capa or None,
                "figuras": figuras,
                "largo_mm": round(g.corte - antes[0], 1),
                "minutos": round(g.minutos - antes[1], 2),
            })
        g.subir()
        g.emitir("M5")
        g.emitir("G0 X0 Y0")
        g.emitir("M2" if post == "linuxcnc" else "M30")
        with open(ruta_salida, "w", encoding="utf-8") as f:
            if post == "linuxcnc":
                f.write("%\n")
            f.write("\n".join(g.lineas) + "\n")
            if post == "linuxcnc":
                f.write("%\n")
        todos = [p for t in trazos for p in t.pts]
        xs = [p[0] for p in todos]
        ys = [p[1] for p in todos]
        if min(xs) < -0.01 or min(ys) < -0.01:
            avisos.append("El dibujo tiene partes con X o Y negativas: revisa el origen antes de cortar.")
        return {
            "ok": True,
            "plan": {
                "operaciones": resumen,
                "largo_corte_mm": round(g.corte, 1),
                "recorrido_rapido_mm": round(g.rapido, 1),
                "tiempo_estimado_min": round(g.minutos * 1.15, 1),  # +15%: aceleraciones
                "lineas": len(g.lineas),
                "capas": sorted({t.capa for t in trazos}),
                "medidas": [round(max(xs) - min(xs), 1), round(max(ys) - min(ys), 1)],
                "post": post,
                "advertencias": avisos,
            },
        }
    except OverflowError:
        return error("fuera_de_rango", "El programa sale demasiado grande.",
                     "Sube la separación del relleno o el paso, o usa una fresa más grande.")
    except Exception as e:  # noqa: BLE001
        return error("fallo_de_ejecucion", f"No se pudo generar el G-code: {e}",
                     "Vuelve a intentarlo. Si sigue fallando, mándanos el archivo y lo revisamos.", reintentable=True)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("uso: cam2d.py entrada.dxf salida.nc config.json")
        raise SystemExit(2)
    with open(sys.argv[3], encoding="utf-8") as f:
        cfg = json.load(f)
    print(json.dumps(generar(sys.argv[1], sys.argv[2], cfg), ensure_ascii=False))
