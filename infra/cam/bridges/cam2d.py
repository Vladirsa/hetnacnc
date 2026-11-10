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

import random

import ezdxf
from ezdxf import disassemble
from ezdxf import path as dxfpath
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(__file__))
from dxf_gcode import error, parametros_de_corte  # noqa: E402

TOL = 0.05  # mm al pasar curvas a rectas
UNIR = 0.02  # mm para unir trazos sueltos punta con punta
MAX_LINEAS = 400_000  # G-code demasiado grande = algo salió mal (relleno o V muy finos)

TIPOS_ROUTER = {"corte", "fuera", "dentro", "linea", "cajeado", "grabado_v", "barrenado", "roscado", "acanalado", "textura", "incrustacion_hembra", "incrustacion_macho"}
TIPOS_LASER = {"laser_corte", "laser_linea", "laser_relleno"}

NOMBRES = {
    "corte": "Corte de pieza",
    "fuera": "Perfilado por fuera",
    "dentro": "Perfilado por dentro",
    "linea": "Perfilado sobre la línea",
    "cajeado": "Cajeado",
    "grabado_v": "Grabado en V",
    "barrenado": "Barrenado",
    "roscado": "Roscado",
    "acanalado": "Acanalado",
    "textura": "Textura",
    "incrustacion_hembra": "Incrustación: caja",
    "incrustacion_macho": "Incrustación: pieza",
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
        # Al arrancar no se sabe dónde está la máquina: el primer traslado se
        # escribe siempre, aunque la figura empiece justo en X0 Y0.
        self.ubicado = False
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
        if d < 1e-4 and self.ubicado:
            return
        self.subir()
        self.emitir(f"G0 X{x:.3f} Y{y:.3f}")
        self.ubicado = True
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


def _pestanas(anillo, cuantas: int, largo: float, diametro: float = 0.0):
    """Tramos donde la fresa sube. `largo` es el material que debe quedar: la
    fresa se come un radio por cada lado, así que el tramo levantado mide el
    largo más el diámetro."""
    largo += diametro
    per = _largo(anillo)
    # en una pieza chica caben menos: mejor dos pestañas que ninguna
    while cuantas > 2 and per < largo * cuantas * 3:
        cuantas -= 1
    if cuantas <= 0 or per < largo * cuantas * 3:
        return []
    paso = per / cuantas
    return [(i * paso + paso / 2 - largo / 2, i * paso + paso / 2 + largo / 2) for i in range(cuantas)]


def _profundidades(total: float, pasada: float) -> list[float]:
    n = max(1, math.ceil(total / max(0.1, pasada) - 1e-6))
    return [-min(total, total * (i + 1) / n) for i in range(n)]


# --- Operaciones -----------------------------------------------------------


def op_contorno(g, polys, modo, r, prof, receta, pestanas, altura_pestana, avisos, nombre, sobre=0.0):
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
        def anillos_a(d, p=p):
            return _anillos(p.buffer(d, join_style=2 if d > 0 else 1, quad_segs=8)) if abs(d) > 1e-6 else _anillos(p)

        anillos = anillos_a(desfase)
        if not anillos:
            chicos += 1
            continue
        figuras += 1
        lleva_pestanas = bool(con_pestanas and pestanas)
        z_pest = -(prof - altura_pestana)
        desbaste = anillos_a(desfase + math.copysign(sobre, desfase)) if sobre > 0 and abs(desfase) > 1e-6 else []
        if desbaste:
            # Desbaste separado de la línea y una pasada de acabado sobre ella.
            # La zona de pestañas la corta sólo el acabado: así las pestañas
            # quedan donde deben y con todo su ancho.
            hasta = prof - altura_pestana if lleva_pestanas else prof
            for anillo in desbaste:
                if len(anillo) < 3:
                    continue
                for z in _profundidades(hasta, receta["profundidad_pasada"]):
                    _recorrer(g, anillo, z, receta["avance"], receta["penetracion"])
                g.subir()
            for anillo in anillos:
                if len(anillo) < 3:
                    continue
                _recorrer(g, anillo, -hasta, receta["avance"], receta["penetracion"])
                if lleva_pestanas:
                    tramos = _pestanas(anillo, pestanas, 6.0, 2 * r)
                    for z in _profundidades(altura_pestana, receta["profundidad_pasada"]):
                        _recorrer(g, anillo, -hasta + z, receta["avance"], receta["penetracion"], tramos, z_pest)
            g.subir()
            continue
        for anillo in anillos:
            if len(anillo) < 3:
                continue
            zs = _profundidades(prof, receta["profundidad_pasada"])
            for z in zs:
                tramos = _pestanas(anillo, pestanas, 6.0, 2 * r) if (lleva_pestanas and z < z_pest) else []
                _recorrer(g, anillo, z, receta["avance"], receta["penetracion"], tramos, z_pest)
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


def _muestrear(pts, paso: float, marcas=()):
    """Puntos (x, y, s) a lo largo de un trazo, cada `paso` mm como máximo y
    con un punto exacto en cada distancia de `marcas`."""
    salida = [(pts[0][0], pts[0][1], 0.0)]
    rec = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        L = math.hypot(x2 - x1, y2 - y1)
        if L < 1e-9:
            continue
        cortes = sorted({L, *[m - rec for m in marcas if rec < m < rec + L]})
        a = 0.0
        for b in cortes:
            n = max(1, math.ceil((b - a) / paso))
            for i in range(1, n + 1):
                u = (a + (b - a) * i / n) / L
                salida.append((x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, rec + u * L))
            a = b
        rec += L
    return salida


def op_acanalado(g, trazos, prof, receta, rampa):
    """Canal que sigue la línea y entra y sale del material en rampa: en las
    puntas la fresa está a ras y baja a toda la profundidad a `rampa` mm."""
    n = 0
    for t in trazos:
        pts = list(t.pts) + ([t.pts[0]] if t.cerrado else [])
        L = _largo(pts)
        if len(pts) < 2 or L < 0.5:
            continue
        n += 1
        r = 0.0 if t.cerrado else min(rampa, L / 2)
        puntos = _muestrear(pts, 2.0 if r else 1e9, (r, L - r) if r else ())
        factor = (lambda s_: min(1.0, s_ / r, (L - s_) / r)) if r else (lambda s_: 1.0)
        ida = True
        for z in _profundidades(prof, receta["profundidad_pasada"]):
            camino = puntos if ida else puntos[::-1]
            g.ir(camino[0][0], camino[0][1])
            g.bajar(z * factor(camino[0][2]), receta["penetracion"])
            for x, y, s_ in camino[1:]:
                g.mover(x, y, receta["avance"], z * factor(s_))
            if not t.cerrado:
                ida = not ida
        g.subir()
    return n


def op_textura(g, polys, prof, receta, separacion, angulo, onda, avisos):
    """Surcos paralelos cuya profundidad sube y baja en ondas, con el arranque
    de cada surco desfasado: el aspecto de tallado a mano."""
    region = _region(polys)
    if region.is_empty:
        return 0
    azar = random.Random(20240607)  # siempre el mismo dibujo para el mismo archivo
    a = math.radians(angulo)
    d, nrm = (math.cos(a), math.sin(a)), (-math.sin(a), math.cos(a))
    x0, y0, x1, y1 = region.bounds
    esquinas = [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]
    bs = [px * nrm[0] + py * nrm[1] for px, py in esquinas]
    ts = [px * d[0] + py * d[1] for px, py in esquinas]
    hechos, ida = 0, True
    b = min(bs) + separacion / 2
    while b < max(bs):
        linea = LineString([(nrm[0] * b + d[0] * (min(ts) - 1), nrm[1] * b + d[1] * (min(ts) - 1)),
                            (nrm[0] * b + d[0] * (max(ts) + 1), nrm[1] * b + d[1] * (max(ts) + 1))])
        tramos = [t for t in _anillos(linea.intersection(region)) if _largo(t) > 1.0]
        fase = azar.uniform(0, onda)
        estira = azar.uniform(0.8, 1.25)
        for tramo in (tramos if ida else [t[::-1] for t in tramos[::-1]]):
            puntos = _muestrear(tramo, max(0.5, onda / 24))
            L = puntos[-1][2]
            # a ras en las dos puntas y en cada valle de la onda
            hondo = lambda s_: -prof * (0.5 - 0.5 * math.cos(2 * math.pi * (s_ + fase) / (onda * estira))) * min(1.0, s_ / 3.0, (L - s_) / 3.0)
            g.ir(puntos[0][0], puntos[0][1])
            g.bajar(0.0, receta["penetracion"])
            for x, y, s_ in puntos[1:]:
                g.mover(x, y, receta["avance"], hondo(s_))
            g.subir()
            hechos += 1
        ida = not ida
        b += separacion
    return 1 if hechos else 0


def forma_incrustable(polys, r: float, holgura: float):
    """La figura tal como la deja una fresa de radio r al vaciarla (esquinas
    interiores redondeadas), reducida por la holgura: es la pieza que embona."""
    region = _region(polys)
    if region.is_empty:
        return []
    forma = region.buffer(-r, join_style=1, quad_segs=8).buffer(r, join_style=1, quad_segs=8).buffer(-holgura, join_style=1, quad_segs=8)
    return [p for p in getattr(forma, "geoms", [forma]) if isinstance(p, Polygon) and p.area > 0.5]


def op_cajeado(g, polys, r, prof, receta, traslape, avisos, sobre=0.0):
    region = _region(polys)
    if region.is_empty:
        return 0
    paso = min(2 * r, max(0.1, 2 * r * (1 - traslape)))
    partes = list(region.geoms) if isinstance(region, MultiPolygon) else [region]
    hechas = 0
    for parte in partes:
        anillos_por_nivel = []
        desfases = []
        d = r + max(0.0, sobre)
        while True:
            g_ = parte.buffer(-d, join_style=1, quad_segs=8)
            if g_.is_empty:
                break
            anillos_por_nivel.append(_anillos(g_))
            desfases.append(d)
            d += paso
            if len(anillos_por_nivel) > 2000:
                break
        if not anillos_por_nivel:
            avisos.append("Cajeado: una zona es más angosta que la fresa y no se vació.")
            continue
        if paso > r + 1e-9:
            # Cada anillo sólo asegura un radio hacia adentro. Con un paso
            # mayor, donde el anillo siguiente ya no cabe (el centro de una
            # franja, las esquinas) queda material: se repasa sólo ahí, con el
            # tramo del anillo que va un radio más adentro.
            barrido = unary_union([LineString(a) for nivel in anillos_por_nivel for a in nivel if len(a) >= 2])
            resto = parte.buffer(-r, join_style=1, quad_segs=8).buffer(r, quad_segs=8).difference(barrido.buffer(r, quad_segs=8))
            islas = [p for p in getattr(resto, "geoms", [resto]) if isinstance(p, Polygon) and p.area > 0.05]
            if islas:
                cerca = unary_union(islas).buffer(r)
                repaso = []
                for dd in desfases:
                    borde = parte.buffer(-(dd + r), join_style=1, quad_segs=8).boundary
                    repaso.extend(a for a in _anillos(borde.intersection(cerca)) if _largo(a) > 0.01)
                if repaso:
                    anillos_por_nivel.append(repaso)
        hechas += 1
        for z in _profundidades(prof, receta["profundidad_pasada"]):
            # de adentro hacia afuera: la orilla queda al final, más limpia
            for nivel in reversed(anillos_por_nivel):
                for anillo in nivel:
                    if len(anillo) >= 2:
                        _recorrer(g, anillo, z, receta["avance"], receta["penetracion"] * 0.5)
            g.subir()
        if sobre > 0:
            # pasada de acabado: la pared, a toda la profundidad, quitando sólo el sobrematerial
            for anillo in _anillos(parte.buffer(-r, join_style=1, quad_segs=8)):
                if len(anillo) >= 2:
                    _recorrer(g, anillo, -prof, receta["avance"], receta["penetracion"] * 0.5)
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


def op_roscado(g, polys, diam, prof, receta, paso, izquierda, avisos):
    """Rosca interior fresada en cada círculo, con fresa de roscar de un solo
    perfil. El círculo dibujado es el diámetro nominal (M10 = círculo de 10) y
    el barreno previo ya debe estar hecho. La fresa baja por el centro, entra
    en arco y recorre una hélice de un paso por vuelta; todo va en tramos
    rectos cortos para que cualquier controlador lo corra."""
    hechos = 0
    for p in polys:
        circ = 4 * math.pi * p.area / max(1e-9, p.length**2)
        if circ < 0.9:
            continue
        x0, y0, x1, y1 = p.bounds
        D = ((x1 - x0) + (y1 - y0)) / 2  # por la caja: el área de un círculo hecho de rectas sale un poco chica
        menor = D - 1.0825 * paso  # diámetro del barreno previo
        if diam >= menor - 0.2:
            avisos.append(f"Roscado: la fresa de Ø{diam:g} mm no entra en el barreno de una rosca de Ø{D:.1f} × {paso:g} (Ø{menor:.1f} mm). Usa una fresa de roscar más delgada.")
            continue
        c = p.centroid
        R = (D - diam) / 2
        vueltas = max(1, math.ceil(prof / paso))
        alto = -prof + vueltas * paso  # punto alto de la hélice (a ras o un poco arriba del material)
        # derecha: sube en contra del reloj (corte en concordancia); izquierda: baja en el mismo giro
        z0, z1 = (alto, -prof) if izquierda else (-prof, alto)
        f = max(20.0, receta["avance"] * (D - diam) / D)  # avance del centro de la fresa
        dth = 2 * math.acos(max(-1.0, 1 - 0.01 / max(R, 0.02)))
        dth = min(math.radians(15), max(math.radians(2), dth))
        g.ir(c.x, c.y)
        g.bajar(z0, receta["penetracion"])
        # entrada: medio círculo del centro a la pared, llega tangente
        n = max(6, math.ceil(math.pi / dth))
        for k in range(1, n + 1):
            a = math.pi + math.pi * k / n
            g.mover(c.x + R / 2 + R / 2 * math.cos(a), c.y + R / 2 * math.sin(a), f * 0.5)
        n = max(12, math.ceil(2 * math.pi / dth)) * vueltas
        for k in range(1, n + 1):
            a = 2 * math.pi * vueltas * k / n
            g.mover(c.x + R * math.cos(a), c.y + R * math.sin(a), f, z0 + (z1 - z0) * k / n)
        # salida: medio círculo de regreso al centro
        n = max(6, math.ceil(math.pi / dth))
        for k in range(1, n + 1):
            a = math.pi * k / n
            g.mover(c.x + R / 2 + R / 2 * math.cos(a), c.y + R / 2 * math.sin(a), f * 0.5)
        g.subir()
        hechos += 1
    if hechos:
        g.c("Roscado: el barreno previo debe estar hecho; prueba con el tornillo y ajusta el diametro de la fresa si queda apretado")
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
        if not (math.isfinite(seguridad) and 1 <= seguridad <= 100):
            return error("entrada_invalida", "La altura de seguridad no es válida.", "Captúrala en mm, entre 1 y 100.")
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
        if tipo_maquina != "laser":
            # Antes de cualquier traslado: la máquina puede venir de poner el
            # cero con la fresa tocando el material.
            g.emitir(f"G0 Z{seguridad:.3f}")
        herramienta_actual = None
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
                # Parámetros propios de la herramienta (base de herramientas del
                # cliente). Lo que no venga se queda con la receta del material.
                for campo, llave, lo, hi in (("pasada", "profundidad_pasada", 0.05, 50), ("avance", "avance", 10, 30000),
                                             ("penetracion", "penetracion", 5, 10000), ("rpm", "rpm", 500, 60000)):
                    if op.get(campo) not in (None, "", 0):
                        v = float(op[campo])
                        if not (math.isfinite(v) and lo <= v <= hi):
                            return error("entrada_invalida", f"Operación {i}: el valor de {campo} no es válido.", f"Captúralo entre {lo} y {hi}.")
                        receta[llave] = int(round(v)) if campo == "rpm" else v
                sobre = float(op.get("sobrematerial") or 0)
                if not (math.isfinite(sobre) and 0 <= sobre <= 5):
                    return error("entrada_invalida", f"Operación {i}: el sobrematerial no es válido.", "Captúralo en mm, entre 0 y 5.")
                traslape = float(op.get("traslape", 0.4))
                if not (math.isfinite(traslape) and 0 <= traslape <= 0.95):
                    return error("entrada_invalida", f"Operación {i}: el traslape no es válido.", "Captúralo entre 0 y 95 %.")
                prof = float(op.get("profundidad") or espesor)
                prof = max(0.05, min(prof, espesor + 2))
                try:
                    largo_filo = float(op.get("largo_corte") or 0)
                except (TypeError, ValueError):
                    largo_filo = 0
                if tipo != "grabado_v" and math.isfinite(largo_filo) and 0 < largo_filo < prof - 0.01:
                    avisos.append(f"{nombre}: la profundidad ({prof:g} mm) es mayor que el largo de corte de la fresa ({largo_filo:g} mm): el zanco rozaría el material. Usa una fresa de filo más largo.")
                # La herramienta es el diámetro y si es recta o en V (no las
                # rpm: una recta de 8 y una V de 12 giran igual en la tabla).
                en_v = tipo == "grabado_v"
                herramienta = (round(diam, 3), "v", float(op.get("angulo", 90))) if en_v else (round(diam, 3), "recta")
                if herramienta_actual != herramienta:
                    if herramienta_actual is not None:
                        g.subir()
                        g.emitir("M5")
                        de_fabrica = f"fresa en V de {herramienta[2]:g} grados" if en_v else f"fresa {diam:g} mm"
                        g.c(f"Cambia la herramienta: {op.get('herramienta') or de_fabrica}")
                        g.emitir("M0")
                    g.emitir(f"M3 S{receta['rpm']}")
                    herramienta_actual = herramienta
                    rpm_actual = receta["rpm"]
                elif rpm_actual != receta["rpm"]:
                    g.emitir(f"S{receta['rpm']}")
                    rpm_actual = receta["rpm"]
                if tipo in ("corte", "fuera", "dentro"):
                    figuras = op_contorno(g, polys, tipo, diam / 2, prof, receta,
                                          int(op.get("pestanas", 4 if tipo != "dentro" else 0)) if op.get("con_pestanas", True) else 0,
                                          min(prof * 0.5, float(op.get("alto_pestana", 1.5))), avisos, nombre, sobre)
                elif tipo == "linea":
                    figuras = op_linea(g, sel, prof, receta)
                elif tipo in ("cajeado", "incrustacion_hembra"):
                    figuras = op_cajeado(g, polys, diam / 2, prof, receta, traslape, avisos, sobre)
                elif tipo == "incrustacion_macho":
                    holgura = float(op.get("holgura", 0.1))
                    if not (math.isfinite(holgura) and 0 <= holgura <= 2):
                        return error("entrada_invalida", f"Operación {i}: la holgura no es válida.", "Captúrala en mm, entre 0 y 2.")
                    piezas = forma_incrustable(polys, diam / 2, holgura)
                    figuras = op_contorno(g, piezas, "fuera", diam / 2, prof, receta,
                                          4 if op.get("con_pestanas", True) else 0, min(prof * 0.5, 1.5), avisos, nombre, sobre)
                elif tipo == "acanalado":
                    rampa = float(op.get("rampa", 10))
                    if not (math.isfinite(rampa) and 0 <= rampa <= 500):
                        return error("entrada_invalida", f"Operación {i}: el largo de rampa no es válido.", "Captúralo en mm, entre 0 y 500.")
                    figuras = op_acanalado(g, sel, prof, receta, rampa)
                elif tipo == "textura":
                    sep = float(op.get("separacion_textura") or diam * 0.8)
                    onda = float(op.get("onda", 30))
                    ang = float(op.get("angulo_textura", 0))
                    if not (math.isfinite(sep) and 0.5 <= sep <= 100 and math.isfinite(onda) and 5 <= onda <= 500 and math.isfinite(ang)):
                        return error("entrada_invalida", f"Operación {i}: los datos de la textura no son válidos.", "Separación entre 0.5 y 100 mm, largo de onda entre 5 y 500 mm.")
                    figuras = op_textura(g, polys, prof, receta, sep, ang, onda, avisos)
                elif tipo == "roscado":
                    paso = float(op.get("paso") or 0)
                    if not (math.isfinite(paso) and 0.2 <= paso <= 10):
                        return error("entrada_invalida", f"Operación {i}: el paso de la rosca no es válido.", "Captúralo en mm, entre 0.2 y 10 (M6 = 1, M8 = 1.25, M10 = 1.5).")
                    figuras = op_roscado(g, polys, diam, prof, receta, paso, bool(op.get("rosca_izquierda")), avisos)
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
