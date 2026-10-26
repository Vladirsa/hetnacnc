# Organizador de cajon para juego de brocas de 1 a 13 mm (25 medidas de
# 0.5 en 0.5). Bloque escalonado: cada fila sube un escalon, asi se ve de
# frente que broca falta sin sacar ninguna.
from cadgen import build123d as bd
from cadgen import stl

BROCA_MIN = 1.0
BROCA_MAX = 13.0
PASO_BROCA = 0.5
HOLGURA = 0.35         # juego por diametro, para que entre impresa
POR_FILA = 5
PASO_X = 32.0          # separacion entre barrenos en la fila
PASO_Y = 30.0          # fondo de cada escalon
ESCALON = 9.0          # cuanto sube cada fila
BASE = 14.0            # espesor de material bajo el barreno mas hondo
PROF = 22.0            # profundidad del barreno
MARGEN = 12.0
CHAFLAN = 1.0

_MEDIDAS = [round(BROCA_MIN + i * PASO_BROCA, 2)
            for i in range(int((BROCA_MAX - BROCA_MIN) / PASO_BROCA) + 1)]
_FILAS = (len(_MEDIDAS) + POR_FILA - 1) // POR_FILA

LARGO = POR_FILA * PASO_X + 2 * MARGEN
FONDO = _FILAS * PASO_Y + 2 * MARGEN


@stl(out="../STL/organizador-brocas-1-13.stl", mesh_tolerance=1.2e-3)
def organizador_brocas():
    cuerpo = None
    for fila in range(_FILAS):
        alto = BASE + PROF + fila * ESCALON
        # Cada escalon arranca en su fila y corre hasta el fondo del bloque.
        largo_y = FONDO - MARGEN - fila * PASO_Y
        peldano = bd.Box(
            LARGO, largo_y, alto,
            align=(bd.Align.CENTER, bd.Align.MIN, bd.Align.MIN),
        ).moved(bd.Location((0, MARGEN + fila * PASO_Y - MARGEN, 0)))
        cuerpo = peldano if cuerpo is None else cuerpo + peldano

    for i, medida in enumerate(_MEDIDAS):
        fila, col = divmod(i, POR_FILA)
        x = (col - (POR_FILA - 1) / 2) * PASO_X
        y = MARGEN + fila * PASO_Y + PASO_Y / 2 - MARGEN
        techo = BASE + PROF + fila * ESCALON
        broca = bd.Cylinder(
            (medida + HOLGURA) / 2, PROF,
            align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.MAX),
        ).moved(bd.Location((x, y, techo)))
        cuerpo = cuerpo - broca

    # Solo se achaflana la boca de cada barreno: el fondo del barreno y los
    # barrenos mas chicos que el chaflan no admiten el corte.
    techos = {BASE + PROF + f * ESCALON for f in range(_FILAS)}
    bocas = [
        a for a in cuerpo.edges().filter_by(bd.GeomType.CIRCLE)
        if a.radius > CHAFLAN * 1.5
        and any(abs(a.center().Z - t) < 1e-6 for t in techos)
    ]
    cuerpo = bd.chamfer(bocas, CHAFLAN)
    cuerpo.label = "organizador-brocas-1-13"
    return cuerpo


if __name__ == "__main__":
    organizador_brocas()
