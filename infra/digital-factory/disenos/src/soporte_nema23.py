# Soporte en L para motor NEMA 23 (brida de 57 mm).
# Placa vertical con el patron NEMA 23 y paso para la brida del motor, base
# con ranuras para ajustar tension de banda, y dos escuadras de refuerzo.
# Aluminio 6061 de 8 mm o acero 1018.
import math

from cadgen import build123d as bd
from cadgen import step, stl

ESPESOR = 8.0
ANCHO = 76.0            # ancho comun de placa y base

PLACA_ALTO = 76.0
NEMA_PATRON = 47.14     # separacion entre barrenos NEMA 23
NEMA_BARRENO = 5.3      # paso holgado para tornillo M5
NEMA_BRIDA = 39.0       # paso de la brida saliente del motor (38.1 nominal)

BASE_FONDO = 62.0
RANURA_LARGO = 22.0     # ranura de ajuste
RANURA_ANCHO = 6.6      # paso holgado para tornillo M6
RANURA_SEP_X = 56.0
RANURA_Y = 36.0         # centro de la ranura desde la cara de la placa

ESCUADRA = 34.0         # cateto del refuerzo
ESCUADRA_ESP = 7.0
CHAFLAN = 1.0

_CENTRO_MOTOR = PLACA_ALTO / 2 + ESPESOR


@step(out="../STEP/soporte-nema23.step")
@stl(out="../STL/soporte-nema23.stl", mesh_tolerance=1.2e-3)
def soporte_nema23():
    # Placa vertical, en el plano XZ, con la cara trasera en y = 0.
    placa = bd.Box(
        ANCHO, ESPESOR, PLACA_ALTO,
        align=(bd.Align.CENTER, bd.Align.MIN, bd.Align.MIN),
    ).moved(bd.Location((0, 0, ESPESOR)))

    # Paso de la brida del motor y los cuatro barrenos del patron NEMA 23.
    paso_brida = bd.Cylinder(
        NEMA_BRIDA / 2, ESPESOR * 3, rotation=(90, 0, 0)
    ).moved(bd.Location((0, 0, _CENTRO_MOTOR)))
    placa -= paso_brida

    media = NEMA_PATRON / 2
    for dx in (-media, media):
        for dz in (-media, media):
            placa -= bd.Cylinder(
                NEMA_BARRENO / 2, ESPESOR * 3, rotation=(90, 0, 0)
            ).moved(bd.Location((dx, 0, _CENTRO_MOTOR + dz)))

    # Base horizontal con ranuras de ajuste.
    base = bd.Box(
        ANCHO, BASE_FONDO, ESPESOR,
        align=(bd.Align.CENTER, bd.Align.MIN, bd.Align.MIN),
    )
    for dx in (-RANURA_SEP_X / 2, RANURA_SEP_X / 2):
        ranura = bd.extrude(
            bd.Plane.XY * bd.SlotOverall(RANURA_LARGO, RANURA_ANCHO,
                                         rotation=90).face(),
            amount=ESPESOR,
        ).moved(bd.Location((dx, RANURA_Y, 0)))
        base -= ranura

    pieza = placa + base

    # Dos escuadras triangulares, una por costado.
    with bd.BuildPart() as refuerzo:
        with bd.BuildSketch(bd.Plane.YZ):
            with bd.BuildLine():
                bd.Polyline(
                    (ESPESOR, ESPESOR),
                    (ESPESOR + ESCUADRA, ESPESOR),
                    (ESPESOR, ESPESOR + ESCUADRA),
                    close=True,
                )
            bd.make_face()
        bd.extrude(amount=ESCUADRA_ESP)
    for dx in (-ANCHO / 2, ANCHO / 2 - ESCUADRA_ESP):
        pieza += refuerzo.part.moved(bd.Location((dx, 0, 0)))

    # Solo circulos completos: los arcos de las ranuras no se pueden
    # achaflanar sueltos, sin los tramos rectos que los acompañan.
    redondos = [
        a for a in pieza.edges().filter_by(bd.GeomType.CIRCLE)
        if a.radius > CHAFLAN * 1.5
        and abs(a.length - 2 * math.pi * a.radius) < 1e-6
    ]
    pieza = bd.chamfer(redondos, CHAFLAN)
    pieza.label = "soporte-nema23"
    return pieza


if __name__ == "__main__":
    soporte_nema23()
