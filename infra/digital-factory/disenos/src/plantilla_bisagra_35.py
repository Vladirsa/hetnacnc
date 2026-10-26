# Plantilla de taladro para bisagra europea de cazoleta de 35 mm.
# El canto recto de arriba es la referencia: se pone a ras del canto de la
# puerta, se prensa por las ranuras de los extremos y se taladra.
# Medidas estandar: cazoleta de 35 mm a 22.5 mm del canto y dos guias de
# tornillo a 45 mm de separacion, sobre la linea de 9.5 mm.
from cadgen import build123d as bd
from cadgen import dxf

LARGO = 160.0
ANCHO = 90.0
CAZOLETA_D = 35.0
CAZOLETA_BORDE = 22.5     # centro de la cazoleta desde el canto de referencia
TORNILLO_D = 4.0
TORNILLO_SEP = 45.0
TORNILLO_BORDE = 9.5      # linea de tornillos desde el canto de referencia
PRENSA_LARGO = 28.0       # ranura para el sargento
PRENSA_ANCHO = 9.0
PRENSA_BORDE = 16.0       # centro de la ranura desde el canto lateral
RADIO_ESQ = 8.0

_CANTO = ANCHO / 2        # el canto de referencia es el borde superior


@dxf(out="../DXF/plantilla-bisagra-35.dxf")
def plantilla_bisagra_35():
    with bd.BuildSketch() as corte:
        bd.Rectangle(LARGO, ANCHO)
        bd.fillet(corte.vertices(), RADIO_ESQ)
        with bd.Locations((0, _CANTO - CAZOLETA_BORDE)):
            bd.Circle(CAZOLETA_D / 2, mode=bd.Mode.SUBTRACT)
        with bd.Locations(
            (-TORNILLO_SEP / 2, _CANTO - TORNILLO_BORDE),
            (TORNILLO_SEP / 2, _CANTO - TORNILLO_BORDE),
        ):
            bd.Circle(TORNILLO_D / 2, mode=bd.Mode.SUBTRACT)
        # Ranuras de prensado en los extremos, lejos de las guias.
        with bd.Locations(
            (-LARGO / 2 + PRENSA_BORDE, -_CANTO + ANCHO / 3),
            (LARGO / 2 - PRENSA_BORDE, -_CANTO + ANCHO / 3),
        ):
            bd.SlotOverall(PRENSA_LARGO, PRENSA_ANCHO, rotation=90,
                           mode=bd.Mode.SUBTRACT)

    with bd.BuildLine() as marca:
        # Lineas abiertas de referencia: eje de simetria y centro de cazoleta.
        bd.Line((0, -(ANCHO / 2 - 10)), (0, ANCHO / 2 - 10))
        bd.Line((-(LARGO / 2 - 15), _CANTO - CAZOLETA_BORDE),
                (LARGO / 2 - 15, _CANTO - CAZOLETA_BORDE))

    return {"CUT": corte.sketch, "ENGRAVE": marca.line}


if __name__ == "__main__":
    plantilla_bisagra_35()
