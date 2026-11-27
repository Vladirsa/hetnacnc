# Plantilla de taladro para bisagra europea de cazoleta 35 mm (regenerada 27 nov 2026).
# Medidas de la ficha: placa 160 x 90 mm; canto recto superior = referencia (a ras del
# canto de la puerta); cazoleta de 35 mm con el centro a 22.5 mm del canto; dos guías
# de 4 mm separadas 45 mm sobre la línea a 9.5 mm del centro de la cazoleta; dos
# ranuras de prensado en los extremos; capa CUT y capa ENGRAVE; mm, escala 1:1.
import sys, math, zipfile
import ezdxf
from ezdxf import units

ANCHO, ALTO = 160.0, 90.0
R_ESQ = 8.0                       # esquinas inferiores redondeadas (las de arriba quedan rectas: referencia)
CX = ANCHO / 2
Y_CANTO = ALTO                    # canto superior
Y_CAZ = Y_CANTO - 22.5            # centro de la cazoleta
D_CAZ = 35.0
Y_TORN = Y_CAZ - 9.5              # línea de tornillos
SEP_TORN = 45.0
D_GUIA = 4.0
RAN_ANCHO, RAN_LARGO = 8.0, 30.0  # ranuras de prensado (verticales)
X_RAN = 12.0
Y_RAN = 38.0

doc = ezdxf.new("R2010", setup=True)
doc.units = units.MM
doc.header["$INSUNITS"] = 4
doc.header["$MEASUREMENT"] = 1
doc.layers.add("CUT", color=1)
doc.layers.add("ENGRAVE", color=5)
msp = doc.modelspace()
cut = {"layer": "CUT"}
eng = {"layer": "ENGRAVE"}

# Contorno: arriba recto, abajo con esquinas redondeadas (bulge = tan(90°/4))
b = math.tan(math.radians(90) / 4)
puntos = [
    (0, ALTO, 0), (ANCHO, ALTO, 0),
    (ANCHO, R_ESQ, -b), (ANCHO - R_ESQ, 0, 0),
    (R_ESQ, 0, -b), (0, R_ESQ, 0),
]
msp.add_lwpolyline([(x, y, 0, 0, bb) for x, y, bb in puntos], format="xyseb", close=True, dxfattribs=cut)

# Barrenos
msp.add_circle((CX, Y_CAZ), D_CAZ / 2, dxfattribs=cut)
for dx in (-SEP_TORN / 2, SEP_TORN / 2):
    msp.add_circle((CX + dx, Y_TORN), D_GUIA / 2, dxfattribs=cut)

# Ranuras de prensado (obround vertical)
def ranura(x, y):
    r = RAN_ANCHO / 2
    h = RAN_LARGO / 2 - r
    bb = math.tan(math.radians(180) / 4)
    pts = [(x - r, y - h, 0), (x - r, y + h, -bb), (x + r, y + h, 0), (x + r, y - h, -bb)]
    msp.add_lwpolyline([(px, py, 0, 0, pb) for px, py, pb in pts], format="xyseb", close=True, dxfattribs=cut)
for x in (X_RAN, ANCHO - X_RAN):
    ranura(x, Y_RAN)

# Líneas de eje (ENGRAVE): eje vertical, línea de la cazoleta y línea de tornillos,
# sin cruzar los barrenos para que el grabado no se coma el borde
def segmentos_h(y, huecos):
    x = 4.0
    for (a, c) in sorted(huecos):
        if a > x:
            msp.add_line((x, y), (a, y), dxfattribs=eng)
        x = max(x, c)
    if x < ANCHO - 4:
        msp.add_line((x, y), (ANCHO - 4, y), dxfattribs=eng)
m = 1.5
segmentos_h(Y_CAZ, [(CX - D_CAZ / 2 - m, CX + D_CAZ / 2 + m)])
segmentos_h(Y_TORN, [(CX - SEP_TORN / 2 - 2 - m, CX - SEP_TORN / 2 + 2 + m), (CX + SEP_TORN / 2 - 2 - m, CX + SEP_TORN / 2 + 2 + m), (CX - D_CAZ / 2 - m, CX + D_CAZ / 2 + m)])
# eje vertical: del canto inferior al borde de la cazoleta
msp.add_line((CX, 4), (CX, Y_CAZ - D_CAZ / 2 - m), dxfattribs=eng)
msp.add_line((CX, Y_CAZ + D_CAZ / 2 + m), (CX, ALTO - 2), dxfattribs=eng)
# Marca del canto de referencia: flechas pequeñas junto al borde superior
for x in (30, ANCHO - 30):
    msp.add_lwpolyline([(x - 4, ALTO - 7), (x, ALTO - 3), (x + 4, ALTO - 7)], dxfattribs=eng)

salida = "plantilla-bisagra-35.dxf"
doc.saveas(salida)
LEEME = """PLANTILLA DE TALADRO PARA BISAGRA EUROPEA DE 35 MM - HETNA CNC

Archivo: plantilla-bisagra-35.dxf  (milímetros, escala 1:1)
Capas: CUT (contorno, cazoleta, guías y ranuras) y ENGRAVE (ejes y flechas del canto de referencia).

Placa de 160 x 90 mm; el canto recto de arriba es la referencia. Cazoleta de 35 mm a 22.5 mm del canto;
dos guías de 4 mm separadas 45 mm sobre la línea a 9.5 mm del centro de la cazoleta; ranuras de 8 x 30 mm.
Material: acrílico de 6 mm, MDF de 9 mm o policarbonato de 6 mm.

Diseño original de HETNA CNC. Puedes usarlo y vender las piezas que fabriques con él.
No se permite revender ni compartir este archivo.
hetnacnc.com
"""
open("LEEME.txt", "w").write(LEEME)
with zipfile.ZipFile("plantilla-bisagra-35.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.write(salida); z.write("LEEME.txt")
import matplotlib; matplotlib.use("Agg")
from ezdxf.addons.drawing import matplotlib as dm
dm.qsave(doc.modelspace(), "plantilla-bisagra-35.png", bg="#FFFFFF", dpi=150)
print("plantilla-bisagra-35 listo")
