# Tres plantillas de taller originales de HETNA CNC (27 nov 2026), en mm, capas CUT y ENGRAVE.
import math, sys, zipfile, os
import ezdxf
from ezdxf import units

def nuevo():
    d = ezdxf.new("R2010", setup=True); d.units = units.MM; d.header["$INSUNITS"] = 4; d.header["$MEASUREMENT"] = 1
    d.layers.add("CUT", color=1); d.layers.add("ENGRAVE", color=5)
    return d, d.modelspace()
C = {"layer": "CUT"}; E = {"layer": "ENGRAVE"}
B90 = math.tan(math.radians(90) / 4)

def rect_redondo(m, x0, y0, x1, y1, r):
    pts = [(x0 + r, y0, 0), (x1 - r, y0, B90), (x1, y0 + r, 0), (x1, y1 - r, B90), (x1 - r, y1, 0), (x0 + r, y1, B90), (x0, y1 - r, 0), (x0, y0 + r, B90)]
    m.add_lwpolyline([(x, y, 0, 0, b) for x, y, b in pts], format="xyseb", close=True, dxfattribs=C)

def ranura(m, x, y, ancho, largo, vertical=True):
    r = ancho / 2; h = largo / 2 - r; b = math.tan(math.radians(180) / 4)
    if vertical: pts = [(x - r, y - h, 0), (x - r, y + h, -b), (x + r, y + h, 0), (x + r, y - h, -b)]
    else: pts = [(x - h, y + r, 0), (x + h, y + r, -b), (x + h, y - r, 0), (x - h, y - r, -b)]
    m.add_lwpolyline([(px, py, 0, 0, pb) for px, py, pb in pts], format="xyseb", close=True, dxfattribs=C)

def texto(m, t, x, y, alto=4):
    m.add_text(t, height=alto, dxfattribs={"layer": "ENGRAVE", "style": "OpenSans"}).set_placement((x, y), align=ezdxf.enums.TextEntityAlignment.MIDDLE_CENTER)

# 1) Plantilla para jaladeras: barrenos de 5 mm a 64, 96, 128, 160 y 192 mm entre centros,
#    tope en L para el canto del cajón/puerta, distancia al canto de 20, 30 o 40 mm.
def jaladeras():
    d, m = nuevo()
    L, A, T = 240.0, 70.0, 12.0          # placa, alto y ancho del tope (en el plano: ala de referencia)
    rect_redondo(m, 0, 0, L, A, 4)
    CX = L / 2
    for i, off in enumerate((20.0, 30.0, 40.0)):
        y = A - off                         # el canto de arriba es la referencia
        for sep in (64, 96, 128, 160, 192):
            for s in (-1, 1):
                m.add_circle((CX + s * sep / 2, y), 2.5, dxfattribs=C)
        texto(m, f"{int(off)}", 8, y, 3.5)
    for sep in (64, 96, 128, 160, 192):
        texto(m, str(sep), CX + sep / 2, 8, 3)
        texto(m, str(sep), CX - sep / 2, 8, 3)
    m.add_line((CX, 3), (CX, A - 3), dxfattribs=E)
    texto(m, "CENTRO", CX + 14, 20, 3)
    for x in (24, L - 24):
        m.add_lwpolyline([(x - 4, A - 7), (x, A - 3), (x + 4, A - 7)], dxfattribs=E)
    return d, ("Plantilla para jaladeras de 64 a 192 mm",
               "Placa de 240 x 70 mm. Barrenos de 5 mm para jaladeras de 64, 96, 128, 160 y 192 mm entre centros, en tres líneas a 20, 30 y 40 mm del canto. "
               "El canto recto de arriba (flechas) es la referencia; la línea CENTRO va al centro del frente. Para tornillo de jaladera M4 usa broca de 5 mm.")

# 2) Plantilla sistema 32 para repisas: barrenos de 5 mm a 32 mm, a 37 mm del canto frontal,
#    con regleta de 9 barrenos (256 mm) y ventana para ver la marca.
def sistema32():
    d, m = nuevo()
    N, PASO, OFF = 9, 32.0, 37.0
    L = (N - 1) * PASO + 2 * 22
    A = 60.0
    rect_redondo(m, 0, 0, L, A, 4)
    y = A - OFF            # barrenos a 37 mm del canto de referencia (el de arriba, con flechas)
    for i in range(N):
        x = 22 + i * PASO
        m.add_circle((x, y), 2.5, dxfattribs=C)
        texto(m, str(i + 1), x, y - 9, 3)
    ranura(m, L / 2, 8, 6, 60, vertical=False)
    m.add_line((22, y + 6), (22 + (N - 1) * PASO, y + 6), dxfattribs=E)
    texto(m, "CANTO FRONTAL", L / 2, A - 5, 3.5)
    for x in (12, L - 12):
        m.add_lwpolyline([(x - 4, A - 7), (x, A - 3), (x + 4, A - 7)], dxfattribs=E)
    return d, ("Plantilla sistema 32 para soportes de repisa",
               f"Regleta de {L:.0f} x {A:.0f} mm con {N} barrenos de 5 mm a 32 mm entre centros (sistema 32), a 37 mm del canto frontal. "
               "Pon el canto con flechas a ras del frente del costado, taladra y recorre la plantilla al siguiente tramo usando el último barreno con un perno de 5 mm.")

# 3) Escuadras de ensamble a 90°: juego de dos escuadras de 150 mm con ranuras para sargento
#    y alivio en la esquina para que el pegamento o la arista no estorben.
def escuadras():
    d, m = nuevo()
    def escuadra(ox, oy):
        P, AN = 150.0, 45.0
        r = 6.0  # alivio de la esquina interior, integrado al contorno (arco de 270° hacia adentro de la pieza)
        b270 = -math.tan(math.radians(270) / 4)
        pts = [(ox, oy, 0), (ox + P, oy, 0), (ox + P, oy + AN, 0), (ox + AN + r, oy + AN, b270), (ox + AN, oy + AN + r, 0), (ox + AN, oy + P, 0), (ox, oy + P, 0)]
        m.add_lwpolyline([(x, y, 0, 0, bb) for x, y, bb in pts], format="xyseb", close=True, dxfattribs=C)
        ranura(m, ox + 105, oy + AN / 2, 10, 50, vertical=False)
        ranura(m, ox + AN / 2, oy + 105, 10, 50, vertical=True)
        texto(m, "90", ox + 20, oy + 20, 8)
    escuadra(0, 0)
    escuadra(170, 0)
    return d, ("Escuadras de ensamble a 90 grados (juego de 2)",
               "Dos escuadras de 150 mm por lado y 45 mm de ancho, con ranuras de 10 x 50 mm para prensar con sargento y alivio de 12 mm en la esquina interior. "
               "Córtalas en MDF de 18 mm o triplay; revisa la escuadra con una escuadra de acero antes de usarlas.")

LIC = "\nDiseño original de HETNA CNC. Puedes usarlo y vender las piezas que fabriques con él.\nNo se permite revender ni compartir este archivo.\nhetnacnc.com\n"
for nombre, fn in (("plantilla-jaladeras", jaladeras), ("plantilla-sistema-32", sistema32), ("escuadras-ensamble-90", escuadras)):
    d, (titulo, desc) = fn()
    aud = d.audit()
    dxf = f"{nombre}.dxf"; d.saveas(dxf)
    leeme = f"{titulo.upper()} - HETNA CNC\n\nArchivo: {dxf} (milímetros, escala 1:1)\nCapas: CUT (corte) y ENGRAVE (grabado: números, líneas y flechas, con punta en V o láser).\n\n{desc}\n" + LIC
    open("LEEME.txt", "w").write(leeme)
    with zipfile.ZipFile(f"{nombre}.zip", "w", zipfile.ZIP_DEFLATED) as z:
        z.write(dxf); z.write("LEEME.txt")
    import matplotlib; matplotlib.use("Agg")
    from ezdxf.addons.drawing import matplotlib as dm
    dm.qsave(d.modelspace(), f"{nombre}.png", bg="#FFFFFF", dpi=150)
    print(nombre, "errores:", len(aud.errors))
