# Tres plantillas más de HETNA CNC (27 nov 2026): chalupa eléctrica, bisagra de piano y guía de sierra circular.
import math, zipfile
import ezdxf
from ezdxf import units
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tanda1_plantillas.py")).read().split("# 1) Plantilla para jaladeras")[0])   # nuevo(), rect_redondo(), ranura(), texto()

def ventana(m, cx, cy, w, h, r):
    rect_redondo(m, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, r)

# 4) Plantilla para chalupa eléctrica (tablaroca, madera): ventanas para copiar con fresa recta con balero
#    del mismo diámetro (copiado a ras). Sencilla 2x4" y doble 4x4". Esquinas con el radio de la fresa de 1/2".
def chalupa():
    d, m = nuevo()
    L, A = 300.0, 180.0
    rect_redondo(m, 0, 0, L, A, 8)
    R = 6.35
    ventana(m, 80, 95, 54.0, 104.0, R)        # sencilla 2x4" (con 1.5 mm de holgura por lado)
    ventana(m, 210, 95, 105.0, 105.0, R)      # doble 4x4"
    texto(m, "2x4  54x104", 80, 30, 4)
    texto(m, "4x4  105x105", 210, 30, 4)
    for cx, h in ((80, 104.0), (210, 105.0)):
        m.add_line((cx, 95 + h / 2 + 4), (cx, A - 6), dxfattribs=E)        # marca de centro vertical
        m.add_line((cx, 95 - h / 2 - 4), (cx, 40), dxfattribs=E)
    m.add_line((6, 95), (80 - 27 - 4, 95), dxfattribs=E)                  # marca de centro horizontal
    m.add_line((L - 6, 95), (210 + 52.5 + 4, 95), dxfattribs=E)
    ranura(m, 145, 155, 8, 40, vertical=False)
    ranura(m, 145, 30, 8, 40, vertical=False)
    return d, ("Plantilla para chalupa eléctrica 2x4 y 4x4 (fresa copiadora)",
               "Placa de 300 x 180 mm con dos ventanas: 54 x 104 mm para chalupa sencilla 2x4\" y 105 x 105 mm para caja doble 4x4\", con esquinas de 6.35 mm de radio (fresa de 1/2\"). "
               "Se copia con fresa recta con balero del mismo diámetro (copiado a ras) en rebajadora. Las líneas grabadas marcan el centro para alinear con tu trazo. "
               "Las chalupas varían entre marcas: mide la tuya antes; si es más grande, escala la ventana en tu CAM.")

# 5) Plantilla para bisagra de piano: regleta de 600 mm con barrenos guía de 2.5 mm cada 2" (50.8 mm),
#    en dos líneas a 6.5 y 9.5 mm del canto, con tope en un extremo.
def piano():
    d, m = nuevo()
    L, A = 620.0, 50.0
    rect_redondo(m, 0, 0, L, A, 3)
    # Una fila por canto: arriba a 6.5 mm (hoja de 25 mm), abajo a 9.5 mm (hoja de 32 mm); se voltea la regleta
    for y in (A - 6.5, 9.5):
        x = 15.0
        while x <= L - 10:
            m.add_circle((x, y), 1.25, dxfattribs=C)
            x += 50.8
    texto(m, "ESTE CANTO: 6.5 mm (hoja 25 mm)", L / 2, A - 17, 3.5)
    texto(m, "ESTE CANTO: 9.5 mm (hoja 32 mm)", L / 2, 20, 3.5)
    texto(m, "barrenos cada 50.8 mm (2\")", L / 2, A / 2, 3)
    for x in (80, L - 80):
        m.add_lwpolyline([(x - 4, A - 15), (x, A - 11), (x + 4, A - 15)], dxfattribs=E)
        m.add_lwpolyline([(x - 4, 15), (x, 11), (x + 4, 15)], dxfattribs=E)
    return d, ("Plantilla para bisagra de piano (barrenos cada 2\")",
               "Regleta de 620 x 50 mm con barrenos guía de 2.5 mm cada 50.8 mm (2\"). Un canto tiene la fila a 6.5 mm (bisagra de hoja de 25 mm) y el otro a 9.5 mm (hoja de 32 mm): voltea la regleta según tu bisagra. "
               "Pon el canto con flechas a ras del canto de la tapa, marca o taladra con broca de 2 mm para tornillo #4 y recorre la regleta usando el último barreno. "
               "Revisa la separación de barrenos de tu bisagra: la mayoría de las de piano vienen a 2\".")

# 6) Guía de corte recto para sierra circular (1.22 m): base y valla en piezas para cortar en router;
#    barrenos avellanados cada 150 mm para unirlas. La base se recorta con tu sierra en el primer corte.
def guia_sierra():
    d, m = nuevo()
    L = 1220.0
    rect_redondo(m, 0, 0, L, 300, 3)                 # base (MDF de 6 mm)
    rect_redondo(m, 0, 330, L, 330 + 70, 3)          # valla (MDF de 15 o 18 mm)
    for i in range(8):
        x = 35 + i * 164.3
        m.add_circle((x, 330 + 35), 2.25, dxfattribs=C)     # barrenos de la valla (tornillo de 4 mm)
        m.add_circle((x, 300 - 35), 1.5, dxfattribs=E)      # marca en la base donde va cada tornillo
    m.add_circle((25, 150), 4, dxfattribs=C); m.add_circle((L - 25, 150), 4, dxfattribs=C)   # para colgar
    texto(m, "BASE  -  MDF 6 mm  -  se recorta con tu sierra en el primer corte", L / 2, 150, 6)
    texto(m, "VALLA  -  MDF 15/18 mm", L / 2, 330 + 15, 5)
    return d, ("Guía de corte recto para sierra circular de 1.22 m",
               "Dos piezas: base de 1220 x 300 mm (MDF de 6 mm) y valla de 1220 x 70 mm (MDF de 15 o 18 mm) con 8 barrenos para tornillo de 4 mm; en la base van grabadas las marcas de cada tornillo. "
               "Atornilla la valla sobre la base pegada al canto lejano, apoya tu sierra contra la valla y haz el primer corte: el canto de la base queda exactamente en la línea de corte de TU sierra. "
               "Después sólo pones ese canto sobre tu trazo y prensas.")

LIC = "\nDiseño original de HETNA CNC. Puedes usarlo y vender las piezas que fabriques con él.\nNo se permite revender ni compartir este archivo.\nhetnacnc.com\n"
import matplotlib; matplotlib.use("Agg")
from ezdxf.addons.drawing import matplotlib as dm
for nombre, fn in (("plantilla-chalupa-electrica", chalupa), ("plantilla-bisagra-piano", piano), ("guia-sierra-circular", guia_sierra)):
    d, (titulo, desc) = fn()
    aud = d.audit()
    dxf = f"{nombre}.dxf"; d.saveas(dxf)
    open("LEEME.txt", "w").write(f"{titulo.upper()} - HETNA CNC\n\nArchivo: {dxf} (milímetros, escala 1:1)\nCapas: CUT (corte) y ENGRAVE (grabado o marcado).\n\n{desc}\n" + LIC)
    with zipfile.ZipFile(f"{nombre}.zip", "w", zipfile.ZIP_DEFLATED) as z:
        z.write(dxf); z.write("LEEME.txt")
    dm.qsave(d.modelspace(), f"{nombre}.png", bg="#FFFFFF", dpi=150)
    print(nombre, "errores:", len(aud.errors))
