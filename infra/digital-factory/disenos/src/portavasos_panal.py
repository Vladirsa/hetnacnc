# Portavasos de 100 mm con relieve de panal, para impresion 3D o grabado 3D
# en router. Bisel perimetral, cajuela central rebajada y hexagonos en
# relieve que frenan el vaso y dejan correr la condensacion.
import math

from cadgen import build123d as bd
from cadgen import stl, threemf

DIAM = 100.0
ESPESOR = 9.0
BISEL = 1.2            # chaflan del canto, para que no corte al tacto
CEJA = 7.0             # ancho del aro liso perimetral
CAJUELA_PROF = 2.4     # cuanto se rebaja la cajuela central
HEX_R = 7.5            # radio al vertice de cada hexagono en relieve
NERVIO = 2.0           # separacion entre hexagonos
RELIEVE = 1.6          # altura del hexagono dentro de la cajuela

PASO_X = 1.5 * HEX_R + NERVIO * math.sqrt(3) / 2
PASO_Y = math.sqrt(3) * HEX_R + NERVIO


def _centros_panal(radio_util: float):
    """Centros de hexagonos cuyo circulo envolvente cabe en la cajuela."""
    limite = radio_util - HEX_R
    centros = []
    pasos = int(limite / min(PASO_X, PASO_Y)) + 2
    for c in range(-pasos, pasos + 1):
        x = c * PASO_X
        desfase = PASO_Y / 2 if c % 2 else 0.0
        for f in range(-pasos, pasos + 1):
            y = f * PASO_Y + desfase
            if math.hypot(x, y) <= limite:
                centros.append((x, y))
    return centros


@stl(out="../STL/portavasos-panal-100.stl", mesh_tolerance=4e-4)
@threemf(out="../STL/portavasos-panal-100.3mf", mesh_tolerance=4e-4)
def portavasos_panal():
    cuerpo = bd.Cylinder(DIAM / 2, ESPESOR,
                         align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.MIN))
    cuerpo = bd.chamfer(cuerpo.edges().filter_by(bd.GeomType.CIRCLE), BISEL)

    radio_cajuela = DIAM / 2 - CEJA
    cajuela = bd.Cylinder(
        radio_cajuela, CAJUELA_PROF,
        align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.MIN),
    ).moved(bd.Location((0, 0, ESPESOR - CAJUELA_PROF)))
    cuerpo = cuerpo - cajuela

    piso = ESPESOR - CAJUELA_PROF
    with bd.BuildPart() as panal:
        with bd.BuildSketch(bd.Plane.XY.offset(piso)):
            with bd.Locations(*_centros_panal(radio_cajuela)):
                bd.RegularPolygon(HEX_R, 6)
        bd.extrude(amount=RELIEVE)

    pieza = cuerpo + panal.part
    pieza.label = "portavasos-panal-100"
    return pieza


if __name__ == "__main__":
    portavasos_panal()
