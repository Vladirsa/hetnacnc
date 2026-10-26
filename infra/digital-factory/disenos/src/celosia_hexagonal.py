# Celosia decorativa de panal para router CNC: panel de 600 x 600 mm con
# hexagonos calados, marco perimetral solido y barrenos de montaje.
# Hexagonos de cara plana arriba (vertices a izquierda y derecha).
import math

from cadgen import build123d as bd
from cadgen import dxf

LADO_PANEL = 600.0
MARCO = 48.0        # franja solida perimetral
HEX_R = 38.0        # radio al vertice del hexagono (76 mm de punta a punta)
NERVIO = 10.0       # material entre hexagono y hexagono
MONTAJE_D = 6.5     # barreno de montaje
MONTAJE_BORDE = 24.0
RADIO_ESQ = 14.0

# Paso del panal para hexagonos de cara plana arriba.
PASO_X = 1.5 * HEX_R + NERVIO * math.sqrt(3) / 2
PASO_Y = math.sqrt(3) * HEX_R + NERVIO


def _rejilla_panal():
    """Centros de los hexagonos que caben enteros dentro del marco."""
    # Mitad del hueco util, menos el medio ancho del hexagono en cada eje.
    util = LADO_PANEL / 2 - MARCO
    limite_x = util - HEX_R
    limite_y = util - math.sqrt(3) / 2 * HEX_R
    centros = []
    cols = int(limite_x / PASO_X) + 2
    filas = int(limite_y / PASO_Y) + 2
    for c in range(-cols, cols + 1):
        x = c * PASO_X
        # Las columnas impares bajan media fila: asi se traban como un panal.
        desfase = PASO_Y / 2 if c % 2 else 0.0
        for f in range(-filas, filas + 1):
            y = f * PASO_Y + desfase
            if abs(x) <= limite_x and abs(y) <= limite_y:
                centros.append((x, y))
    return centros


@dxf(out="../DXF/celosia-hexagonal-600.dxf")
def celosia_hexagonal():
    with bd.BuildSketch() as corte:
        bd.Rectangle(LADO_PANEL, LADO_PANEL)
        bd.fillet(corte.vertices(), RADIO_ESQ)
        with bd.Locations(*_rejilla_panal()):
            bd.RegularPolygon(HEX_R, 6, mode=bd.Mode.SUBTRACT)
        media = LADO_PANEL / 2 - MONTAJE_BORDE
        with bd.Locations(
            (-media, -media), (media, -media), (-media, media), (media, media)
        ):
            bd.Circle(MONTAJE_D / 2, mode=bd.Mode.SUBTRACT)
    return corte.sketch


if __name__ == "__main__":
    celosia_hexagonal()
