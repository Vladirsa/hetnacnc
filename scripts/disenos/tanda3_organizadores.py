# Organizadores de herramienta de HETNA CNC (27 nov 2026): STL para impresión 3D y DXF para router/láser.
#   - Organizador de fresas de router (zanco de 1/4" y 1/2")
#   - Porta llaves Allen métricas 1.5 a 10 mm
#   - Porta puntas de destornillador de 1/4" (40 puntas)
# El STL se arma con gmsh (OpenCASCADE): bloque menos barrenos ciegos. El DXF es para apilar:
# capa con barrenos pasados + base lisa, del espesor de tu material.
import math, struct, zipfile
import gmsh, ezdxf
from ezdxf import units

def stl_bloque(nombre, L, W, H, huecos, prof):
    """huecos: [(x, y, tipo, medida)] tipo 'c' = círculo (diámetro), 'h' = hexágono (entre caras)."""
    gmsh.initialize(); gmsh.option.setNumber("General.Terminal", 0); gmsh.model.add(nombre)
    occ = gmsh.model.occ
    bloque = occ.addBox(0, 0, 0, L, W, H)
    herramientas = []
    for x, y, tipo, med in huecos:
        if tipo == "c":
            herramientas.append((3, occ.addCylinder(x, y, H - prof, 0, 0, prof + 1, med / 2)))
        else:
            r = med / math.sqrt(3)  # radio a las puntas del hexágono
            pts = [occ.addPoint(x + r * math.cos(math.pi / 6 + k * math.pi / 3), y + r * math.sin(math.pi / 6 + k * math.pi / 3), H - prof) for k in range(6)]
            lin = [occ.addLine(pts[k], pts[(k + 1) % 6]) for k in range(6)]
            sup = occ.addPlaneSurface([occ.addCurveLoop(lin)])
            ext = occ.extrude([(2, sup)], 0, 0, prof + 1)
            herramientas.append([e for e in ext if e[0] == 3][0])
    occ.cut([(3, bloque)], herramientas)
    occ.synchronize()
    gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 24)
    gmsh.option.setNumber("Mesh.MeshSizeMax", 6)
    gmsh.option.setNumber("Mesh.Binary", 1)
    gmsh.model.mesh.generate(2)
    gmsh.write(f"{nombre}.stl"); gmsh.finalize()
    b = open(f"{nombre}.stl", "rb").read()
    return struct.unpack("<I", b[80:84])[0]

def dxf_capas(nombre, L, W, huecos, etiquetas):
    d = ezdxf.new("R2010", setup=True); d.units = units.MM; d.header["$INSUNITS"] = 4
    d.layers.add("CUT", color=1); d.layers.add("ENGRAVE", color=5)
    m = d.modelspace(); C = {"layer": "CUT"}
    for oy, con_huecos in ((0, True), (W + 15, False)):
        m.add_lwpolyline([(0, oy), (L, oy), (L, oy + W), (0, oy + W)], close=True, dxfattribs=C)
        if con_huecos:
            for x, y, tipo, med in huecos:
                if tipo == "c":
                    m.add_circle((x, oy + y), med / 2, dxfattribs=C)
                else:
                    r = med / math.sqrt(3)
                    m.add_lwpolyline([(x + r * math.cos(math.pi / 6 + k * math.pi / 3), oy + y + r * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)], close=True, dxfattribs=C)
            for t, x, y, alto in etiquetas:
                m.add_text(t, height=alto, dxfattribs={"layer": "ENGRAVE", "style": "OpenSans"}).set_placement((x, oy + y), align=ezdxf.enums.TextEntityAlignment.MIDDLE_CENTER)
        else:
            m.add_text("BASE (sin barrenos)", height=5, dxfattribs={"layer": "ENGRAVE", "style": "OpenSans"}).set_placement((L / 2, oy + W / 2), align=ezdxf.enums.TextEntityAlignment.MIDDLE_CENTER)
    d.saveas(f"{nombre}.dxf")

# 1) Fresas de router: 12 de zanco 1/4" (6.35 mm, barreno 6.7) y 4 de 1/2" (12.7 mm, barreno 13.1)
def fresas():
    # Separación pensada para las cabezas: hasta ~30 mm en 1/4" (tresbolillo a 32 mm) y ~48 mm en 1/2"
    L, W, H, P = 230.0, 112.0, 30.0, 24.0
    h = []
    for fila, y in enumerate((20.0, 46.0)):
        for i in range(6):
            h.append((24 + i * 32.0 + (16.0 if fila else 0), y, "c", 6.7))
    for i in range(4):
        h.append((40 + i * 50.0, 86.0, "c", 13.1))
    et = [("1/4\"", 9, 33, 4), ("1/2\"", 9, 86, 4)]
    return "organizador-fresas-router", L, W, H, P, h, et, ("Organizador de fresas para router (1/4\" y 1/2\")",
        "Bloque de 230 x 112 x 30 mm para 12 fresas de zanco de 1/4\" (barreno de 6.7 mm, en tresbolillo a 32 mm) y 4 de 1/2\" (13.1 mm, a 50 mm), con 24 mm de profundidad: "
        "caben fresas con cabeza de hasta 30 mm (1/4\") y 48 mm (1/2\") sin chocar. "
        "STL listo para imprimir (PLA o PETG, 3 paredes, 20 % de relleno). El DXF trae la capa con barrenos y la base para cortar en MDF o acrílico y pegar: "
        "con material de 18 mm encima de una base de 6 mm queda igual.")

# 2) Llaves Allen métricas 1.5 a 10 mm (hexágono entre caras + 0.35 mm de juego)
def allen():
    medidas = [1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    x = 8.0; h = []; et = []
    for mm in medidas:
        af = mm + 0.35
        x += af / 2 + 3
        h.append((x, 22.0, "h", af)); et.append((f"{mm:g}", x, 8, 3.2))
        x += af / 2 + 3
    L = x + 8
    return "porta-llaves-allen", L, 34.0, 28.0, 22.0, h, et, ("Porta llaves Allen métricas de 1.5 a 10 mm",
        f"Bloque de {L:.0f} x 34 x 28 mm con huecos hexagonales para llaves de 1.5, 2, 2.5, 3, 4, 5, 6, 8 y 10 mm (0.35 mm de juego), de 22 mm de profundidad, con la medida grabada en el DXF. "
        "STL para imprimir parado (los hexágonos salen limpios sin soportes). Si tu impresora aprieta, escala en X y Y al 101 %.")

# 3) Puntas de destornillador de 1/4" (hexágono 6.35 + 0.35 = 6.7 mm), 4 filas de 10
def puntas():
    h = [(10 + i * 11.0, 9 + f * 11.0, "h", 6.7) for f in range(4) for i in range(10)]
    return "porta-puntas-destornillador", 119.0, 52.0, 16.0, 12.0, h, [], ("Porta puntas de destornillador de 1/4\" (40 puntas)",
        "Bloque de 119 x 52 x 16 mm con 40 huecos hexagonales de 6.7 mm para puntas de 1/4\" (de las de taladro y atornillador), 12 mm de profundidad. "
        "STL para imprimir sin soportes; el DXF es para cortar en MDF de 12 mm sobre una base de 3 o 6 mm.")

LIC = "\nDiseño original de HETNA CNC. Puedes usarlo y vender las piezas que fabriques con él.\nNo se permite revender ni compartir este archivo.\nhetnacnc.com\n"
import matplotlib; matplotlib.use("Agg")
from ezdxf.addons.drawing import matplotlib as dm
for fn in (fresas, allen, puntas):
    nombre, L, W, H, P, h, et, (titulo, desc) = fn()
    n = stl_bloque(nombre, L, W, H, h, P)
    dxf_capas(nombre, L, W, h, et)
    open("LEEME.txt", "w").write(f"{titulo.upper()} - HETNA CNC\n\nArchivos: {nombre}.stl (impresión 3D) y {nombre}.dxf (router o láser, milímetros, escala 1:1)\n\n{desc}\n" + LIC)
    with zipfile.ZipFile(f"{nombre}.zip", "w", zipfile.ZIP_DEFLATED) as z:
        z.write(f"{nombre}.stl"); z.write(f"{nombre}.dxf"); z.write("LEEME.txt")
    dm.qsave(ezdxf.readfile(f"{nombre}.dxf").modelspace(), f"{nombre}.png", bg="#FFFFFF", dpi=150)
    print(nombre, "triangulos:", n, "medidas:", f"{L:.0f}x{W:.0f}x{H:.0f}")
