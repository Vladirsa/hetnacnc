"""Bridge DXF -> G-code para corte 2.5D en router o láser.

Este archivo es un *bridge* en el sentido de rea (github.com/morluto/rea): la
plataforma no sabe cortar nada. Sabe pedirle a un motor que lo haga y entender
su respuesta. Si mañana este bridge se cambia por otro mejor, nada del resto
tiene que enterarse -- mientras devuelva la misma forma.

Esa forma es el contrato de abajo, copiado de rea/docs/error-contract.schema.json:
todo error trae `categoria`, `reintentable` y `remedio`, para que la pantalla
pueda decirle al taller qué hacer en vez de enseñarle un stacktrace.

Alcance a propósito: 2.5D, contorno exterior e interior, con pestañas. Nada de
3, 4 o 5 ejes -- el 90% de los routers y láseres del mercado hispano hacen
esto, y hacerlo bien vale más que hacer todo a medias.
"""
from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass, field
from typing import Any, Literal

import ezdxf
from ezdxf.addons import Importer  # noqa: F401  (se usa al leer bloques anidados)
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

RUTA_MATERIALES = os.path.join(os.path.dirname(__file__), "..", "materiales.json")

# Cuántos segmentos usa shapely al redondear una esquina en un desfase. Más
# segmentos = contorno más fiel = más líneas de G-code. 8 es el punto donde
# el ojo ya no distingue la diferencia en una pieza de taller.
SEGMENTOS_CURVA = 8

# Cuántos puntos se usan para convertir un círculo del DXF en polígono.
PUNTOS_CIRCULO = 72


# --- Contrato de respuesta (el de rea, en español) ---

Categoria = Literal[
    "entrada_invalida",
    "formato_no_soportado",
    "geometria_no_soportada",
    "sin_geometria",
    "fuera_de_rango",
    "fallo_de_ejecucion",
]


def error(
    categoria: Categoria, mensaje: str, remedio: str, reintentable: bool = False, **detalles: Any
) -> dict:
    """Un error que la pantalla puede mostrar tal cual, sin traducir nada."""
    return {
        "ok": False,
        "categoria": categoria,
        "mensaje": mensaje,
        "reintentable": reintentable,
        "remedio": remedio,
        "detalles": detalles or {},
    }


@dataclass
class Plan:
    """Lo que se va a hacer, antes de hacerlo. Es lo que ve el taller para
    decidir si le parece bien -- el punto 3 del prototipo: el plan se calcula
    solo a partir del material y la fresa."""

    material: str
    diametro_fresa: float
    espesor: float
    avance: int
    penetracion: int
    rpm: int
    profundidad_pasada: float
    pasadas: int
    contornos_exteriores: int
    contornos_interiores: int
    largo_corte_mm: float
    tiempo_estimado_min: float
    pestanas: int
    advertencias: list[str] = field(default_factory=list)


def cargar_materiales() -> dict:
    with open(os.path.abspath(RUTA_MATERIALES), encoding="utf-8") as f:
        return json.load(f)


def parametros_de_corte(material: str, diametro: float) -> dict | None:
    """Busca la receta para ese material y diámetro. Si el diámetro exacto no
    está en la tabla, usa el más cercano hacia abajo: pasarse de avance con una
    fresa más chica de la prevista rompe la fresa, quedarse corto sólo tarda."""
    datos = cargar_materiales()
    m = next((x for x in datos["materiales"] if x["clave"] == material), None)
    if not m:
        return None

    disponibles = sorted(float(d) for d in m["por_diametro"])
    menores = [d for d in disponibles if d <= diametro]
    elegido = menores[-1] if menores else disponibles[0]
    receta = dict(m["por_diametro"][str(int(elegido)) if elegido.is_integer() else str(elegido)])
    receta["nombre_material"] = m["nombre"]
    receta["notas"] = m.get("notas", "")
    receta["diametro_tabla"] = elegido
    return receta


# --- Lectura del DXF ---


def _poligono_de_circulo(centro, radio: float) -> Polygon:
    cx, cy = centro[0], centro[1]
    puntos = [
        (cx + radio * math.cos(2 * math.pi * i / PUNTOS_CIRCULO),
         cy + radio * math.sin(2 * math.pi * i / PUNTOS_CIRCULO))
        for i in range(PUNTOS_CIRCULO)
    ]
    return Polygon(puntos)


def leer_contornos(ruta_dxf: str) -> tuple[list[Polygon], list[str]]:
    """Saca del DXF las figuras cerradas que se pueden cortar.

    Sólo entiende polilíneas cerradas y círculos, que es con lo que llega el
    99% de los archivos de corte. Lo que no entiende se reporta como
    advertencia en vez de ignorarse en silencio: un taller tiene que saber que
    su archivo traía algo que no se va a cortar.
    """
    doc = ezdxf.readfile(ruta_dxf)
    msp = doc.modelspace()

    poligonos: list[Polygon] = []
    advertencias: list[str] = []
    ignoradas: dict[str, int] = {}

    for e in msp:
        tipo = e.dxftype()
        try:
            if tipo == "LWPOLYLINE" and e.closed:
                puntos = [(p[0], p[1]) for p in e.get_points()]
                if len(puntos) >= 3:
                    poligonos.append(Polygon(puntos))
            elif tipo == "POLYLINE" and e.is_closed:
                puntos = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
                if len(puntos) >= 3:
                    poligonos.append(Polygon(puntos))
            elif tipo == "CIRCLE":
                poligonos.append(_poligono_de_circulo(e.dxf.center, e.dxf.radius))
            else:
                ignoradas[tipo] = ignoradas.get(tipo, 0) + 1
        except Exception:
            ignoradas[tipo] = ignoradas.get(tipo, 0) + 1

    for tipo, n in sorted(ignoradas.items()):
        if tipo in ("LINE", "ARC", "SPLINE"):
            advertencias.append(
                f"{n} entidad(es) {tipo}: son trazos abiertos y no forman una figura cerrada, "
                "así que no se cortaron. Únelas en una polilínea cerrada en tu programa de dibujo."
            )
        else:
            advertencias.append(f"{n} entidad(es) {tipo} no se pudieron cortar y se omitieron.")

    validos = [p for p in poligonos if p.is_valid and p.area > 0.01]
    if len(validos) < len(poligonos):
        advertencias.append(
            f"{len(poligonos) - len(validos)} figura(s) se descartaron por estar cruzadas sobre sí "
            "mismas o ser demasiado chicas."
        )
    return validos, advertencias


def separar_exteriores_e_interiores(poligonos: list[Polygon]) -> tuple[list[Polygon], list[Polygon]]:
    """Decide qué es borde de la pieza y qué es barreno.

    La regla es la que usa cualquier CAM: una figura contenida dentro de otra
    es un hueco. Importa porque el desfase va al revés -- el borde se corta por
    FUERA de la línea para que la pieza quede de su medida, y el hueco por
    DENTRO para que el agujero quede de la suya.
    """
    exteriores, interiores = [], []
    for i, p in enumerate(poligonos):
        dentro_de_otro = any(
            j != i and otro.contains(p) for j, otro in enumerate(poligonos)
        )
        (interiores if dentro_de_otro else exteriores).append(p)
    return exteriores, interiores


# --- Generación de trayectorias ---


def _anillos(geom) -> list[list[tuple[float, float]]]:
    """Aplana lo que devuelve shapely tras un desfase, que puede ser un
    polígono, varios, o nada si la figura era más chica que la fresa."""
    salida = []
    if geom.is_empty:
        return salida
    partes = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
    for parte in partes:
        if isinstance(parte, Polygon):
            salida.append(list(parte.exterior.coords))
            for hueco in parte.interiors:
                salida.append(list(hueco.coords))
        elif isinstance(parte, LineString):
            salida.append(list(parte.coords))
    return salida


def trayectoria_de_contorno(poligono: Polygon, radio: float, hacia_afuera: bool) -> list[list[tuple[float, float]]]:
    desfase = radio if hacia_afuera else -radio
    movido = poligono.buffer(desfase, join_style=2, quad_segs=SEGMENTOS_CURVA)
    return _anillos(movido)


def repartir_pestanas(anillo: list[tuple[float, float]], cuantas: int, largo: float) -> list[tuple[float, float]]:
    """Dónde van las pestañas que sostienen la pieza.

    Sin pestañas, en la última pasada la pieza se suelta, la fresa la avienta y
    se arruina (o se rompe la fresa). Se reparten parejo a lo largo del
    contorno; devuelve las distancias acumuladas donde empieza cada una.
    """
    if cuantas <= 0:
        return []
    perimetro = 0.0
    for i in range(len(anillo) - 1):
        (x1, y1), (x2, y2) = anillo[i], anillo[i + 1]
        perimetro += math.hypot(x2 - x1, y2 - y1)
    if perimetro < largo * cuantas * 2:
        return []
    paso = perimetro / cuantas
    return [(i * paso, i * paso + largo) for i in range(cuantas)]


# --- G-code ---


def _largo(anillo: list[tuple[float, float]]) -> float:
    return sum(
        math.hypot(anillo[i + 1][0] - anillo[i][0], anillo[i + 1][1] - anillo[i][1])
        for i in range(len(anillo) - 1)
    )


def generar(
    ruta_dxf: str,
    ruta_salida: str,
    material: str,
    diametro_fresa: float,
    espesor: float,
    altura_seguridad: float = 5.0,
    pestanas_por_contorno: int = 4,
    altura_pestana: float = 1.5,
    largo_pestana: float = 6.0,
) -> dict:
    """DXF a G-code. Devuelve el plan y las advertencias, o un error del
    contrato. Nunca lanza excepciones hacia afuera: el que llama no debería
    tener que envolver esto en un try."""
    try:
        if diametro_fresa <= 0:
            return error("entrada_invalida", "El diámetro de la fresa debe ser mayor que cero.",
                         "Captura el diámetro real de tu fresa, en milímetros.")
        if espesor <= 0:
            return error("entrada_invalida", "El espesor del material debe ser mayor que cero.",
                         "Captura el espesor de la placa que vas a cortar, en milímetros.")

        receta = parametros_de_corte(material, diametro_fresa)
        if not receta:
            datos = cargar_materiales()
            nombres = ", ".join(m["clave"] for m in datos["materiales"])
            return error("entrada_invalida", f"No conozco el material '{material}'.",
                         f"Elige uno de estos: {nombres}.", materiales=nombres)

        try:
            poligonos, advertencias = leer_contornos(ruta_dxf)
        except ezdxf.DXFStructureError as e:
            return error("formato_no_soportado", f"El archivo no se pudo leer como DXF: {e}",
                         "Vuelve a exportarlo desde tu programa de dibujo como DXF R2010 o posterior.")

        if not poligonos:
            return error("sin_geometria",
                         "El archivo no trae ninguna figura cerrada que se pueda cortar.",
                         "Revisa que tus contornos estén cerrados: en la mayoría de los programas "
                         "es el comando 'unir' o 'cerrar polilínea'.",
                         advertencias=advertencias)

        radio = diametro_fresa / 2
        exteriores, interiores = separar_exteriores_e_interiores(poligonos)

        # Un barreno más chico que la fresa no se puede hacer. Decirlo antes de
        # cortar vale más que descubrirlo con la máquina andando.
        muy_chicos = [p for p in interiores if math.sqrt(p.area / math.pi) <= radio]
        if muy_chicos:
            advertencias.append(
                f"{len(muy_chicos)} barreno(s) son más chicos que tu fresa de {diametro_fresa} mm "
                "y se omitieron. Para esos necesitas una fresa más delgada o taladrarlos aparte."
            )

        profundidad_pasada = float(receta["profundidad_pasada"])
        pasadas = max(1, math.ceil(espesor / profundidad_pasada))

        lineas: list[str] = []
        emitir = lineas.append
        total_corte = 0.0
        total_pestanas = 0

        emitir("; G-code generado por HETNA CNC - Laboratorio CAM")
        emitir(f"; material: {receta['nombre_material']} | espesor: {espesor} mm")
        emitir(f"; fresa: {diametro_fresa} mm | avance {receta['avance']} mm/min | {receta['rpm']} rpm")
        emitir(f"; {pasadas} pasada(s) de {profundidad_pasada} mm")
        if receta.get("notas"):
            emitir(f"; nota del material: {receta['notas']}")
        emitir("G21 ; milimetros")
        emitir("G90 ; coordenadas absolutas")
        emitir("G17 ; plano XY")
        emitir(f"M3 S{receta['rpm']} ; husillo")
        emitir(f"G0 Z{altura_seguridad}")

        def cortar(anillos: list[list[tuple[float, float]]], con_pestanas: bool, etiqueta: str):
            nonlocal total_corte, total_pestanas
            for anillo in anillos:
                if len(anillo) < 3:
                    continue
                largo_anillo = _largo(anillo)
                emitir(f"; {etiqueta}")
                for n in range(1, pasadas + 1):
                    z = -min(n * profundidad_pasada, espesor)
                    ultima = n == pasadas
                    emitir(f"G0 X{anillo[0][0]:.3f} Y{anillo[0][1]:.3f}")
                    emitir(f"G1 Z{z:.3f} F{receta['penetracion']}")
                    tramos = (
                        repartir_pestanas(anillo, pestanas_por_contorno, largo_pestana)
                        if (con_pestanas and ultima)
                        else []
                    )
                    recorrido = 0.0
                    for i in range(1, len(anillo)):
                        (x1, y1), (x2, y2) = anillo[i - 1], anillo[i]
                        paso = math.hypot(x2 - x1, y2 - y1)
                        en_pestana = any(ini <= recorrido <= fin for ini, fin in tramos)
                        if en_pestana:
                            emitir(f"G1 Z{-(espesor - altura_pestana):.3f} F{receta['penetracion']}")
                            emitir(f"G1 X{x2:.3f} Y{y2:.3f} F{receta['avance']}")
                            emitir(f"G1 Z{z:.3f} F{receta['penetracion']}")
                        else:
                            emitir(f"G1 X{x2:.3f} Y{y2:.3f} F{receta['avance']}")
                        recorrido += paso
                    total_corte += largo_anillo
                    if tramos:
                        total_pestanas += len(tramos)
                emitir(f"G0 Z{altura_seguridad}")

        # Los barrenos primero: mientras la pieza sigue sujeta al material es
        # cuando mejor se cortan. Al revés, se mueve.
        for p in interiores:
            if p in muy_chicos:
                continue
            cortar(trayectoria_de_contorno(p, radio, hacia_afuera=False), False, "barreno")
        for p in exteriores:
            cortar(trayectoria_de_contorno(p, radio, hacia_afuera=True), True, "contorno exterior")

        emitir(f"G0 Z{altura_seguridad}")
        emitir("M5 ; husillo apagado")
        emitir("G0 X0 Y0")
        emitir("M30")

        with open(ruta_salida, "w", encoding="utf-8") as f:
            f.write("\n".join(lineas) + "\n")

        minutos = total_corte / max(1, receta["avance"]) + pasadas * 0.1 * (len(exteriores) + len(interiores))

        plan = Plan(
            material=receta["nombre_material"],
            diametro_fresa=diametro_fresa,
            espesor=espesor,
            avance=receta["avance"],
            penetracion=receta["penetracion"],
            rpm=receta["rpm"],
            profundidad_pasada=profundidad_pasada,
            pasadas=pasadas,
            contornos_exteriores=len(exteriores),
            contornos_interiores=len(interiores) - len(muy_chicos),
            largo_corte_mm=round(total_corte, 1),
            tiempo_estimado_min=round(minutos, 1),
            pestanas=total_pestanas,
            advertencias=advertencias,
        )

        return {"ok": True, "gcode": ruta_salida, "lineas": len(lineas), "plan": plan.__dict__}

    except Exception as e:  # noqa: BLE001
        return error("fallo_de_ejecucion", f"No se pudo generar el G-code: {e}",
                     "Vuelve a intentarlo. Si sigue fallando, mándanos el archivo y lo revisamos.",
                     reintentable=True)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 6:
        print("uso: dxf_gcode.py entrada.dxf salida.nc MATERIAL DIAMETRO ESPESOR")
        raise SystemExit(2)
    r = generar(sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5]))
    print(json.dumps(r, ensure_ascii=False, indent=2))
