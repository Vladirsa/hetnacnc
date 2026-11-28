# Diseños para casa de HETNA CNC (28 nov 2026):
#   - Porta llaves de pared con repisa (DXF para router o láser, se arma con taquetes)
#   - Ménsula decorativa para repisa (DXF, par)
#   - Gancho de pared para audífonos (STL)
import math, struct, zipfile, os
import ezdxf, gmsh
from ezdxf import units
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tanda1_plantillas.py")).read().split("# 1) Plantilla para jaladeras")[0])

# 1) Porta llaves: placa de 300 x 120 mm con 5 barrenos para taquete de 8 mm (los ganchos son
#    taquetes de madera pegados a 15°), repisa de 300 x 70 mm que se ensambla con caja y espiga.
def porta_llaves():
    d, m = nuevo()
    L, A, T = 300.0, 120.0, 15.0
    rect_redondo(m, 0, 0, L, A, 10)
    for i in range(5):
        m.add_circle((40 + i * 55, 35), 4.0, dxfattribs=C)            # taquetes de 8 mm para colgar llaves
    # Ranuras para las espigas de la repisa (2 de 40 x 15.4 mm, material de 15 mm)
    for x in (75, 225):
        m.add_lwpolyline([(x - 20, A - 30), (x + 20, A - 30), (x + 20, A - 30 + 15.4), (x - 20, A - 30 + 15.4)], close=True, dxfattribs=C)
    # Barrenos avellanados para colgar en la pared
    for x in (20, L - 20):
        m.add_circle((x, A - 15), 2.5, dxfattribs=C)
    texto(m, "LLAVES", L / 2, 70, 12)
    # Repisa con dos espigas
    oy = A + 20
    pts = [(0, oy), (55, oy), (55, oy - 15), (95, oy - 15), (95, oy), (205, oy), (205, oy - 15), (245, oy - 15), (245, oy), (L, oy), (L, oy + 70), (0, oy + 70)]
    m.add_lwpolyline(pts, close=True, dxfattribs=C)
    return d, ("Porta llaves de pared con repisa",
               "Placa de 300 x 120 mm con 5 barrenos para taquete de madera de 8 mm (los ganchos: pégalos a 15° hacia arriba), letrero LLAVES grabado y dos barrenos para colgar. "
               "La repisa de 300 x 70 mm entra con dos espigas en las ranuras de la placa y aguanta cartas, lentes o el celular. Para MDF o triplay de 15 mm: si tu material es de otro espesor, ajusta las ranuras.")

# 2) Ménsula decorativa para repisa: escuadra de 200 x 150 mm con curva y barrenos (par)
def mensula():
    d, m = nuevo()
    def una(ox):
        P, H = 200.0, 150.0
        # Contorno: canto de pared (vertical), canto de repisa (horizontal arriba) y curva decorativa
        poly = [(ox, 0), (ox + 32, 0)]
        for k in range(1, 21):
            t = k / 20
            poly.append((ox + 32 + (P - 32) * t, (H - 32) * (1 - math.cos(t * math.pi / 2)) + 0))
        poly += [(ox + P, H), (ox, H)]
        m.add_lwpolyline(poly, close=True, dxfattribs=C)
        # Hueco decorativo y barrenos
        m.add_circle((ox + 45, H - 45), 18, dxfattribs=C)
        for y in (25, H - 90):
            m.add_circle((ox + 12, y), 2.5, dxfattribs=C)
        for x in (60, P - 30):
            m.add_circle((ox + x, H - 12), 2.5, dxfattribs=C)
    una(0); una(220)
    return d, ("Ménsula decorativa para repisa (par)",
               "Dos ménsulas de 200 x 150 mm con curva y hueco decorativo, barrenos para tornillo en el canto de pared y en el de la repisa. "
               "Córtalas en MDF o triplay de 18 mm para repisas de hasta 25 cm de fondo; para más peso usa madera sólida o tres ménsulas.")

# 3) Gancho de pared para audífonos (STL): placa con barrenos avellanados y brazo curvo con tope
def gancho():
    gmsh.initialize(); gmsh.option.setNumber("General.Terminal", 0); gmsh.model.add("gancho")
    occ = gmsh.model.occ
    placa = occ.addBox(0, 0, 0, 40, 6, 70)
    brazo = occ.addBox(5, 0, 18, 30, 55, 10)
    tope = occ.addBox(5, 48, 18, 30, 7, 26)
    cuerpo, _ = occ.fuse([(3, placa)], [(3, brazo), (3, tope)])
    huecos = []
    for z in (50, 60):
        huecos.append((3, occ.addCylinder(20, -1, z, 0, 8, 0, 2.2)))
        huecos.append((3, occ.addCone(20, -0.01, z, 0, 3, 0, 4.2, 2.2)))
    occ.cut(cuerpo, huecos)
    occ.synchronize()
    gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 24); gmsh.option.setNumber("Mesh.MeshSizeMax", 4); gmsh.option.setNumber("Mesh.Binary", 1)
    gmsh.model.mesh.generate(2); gmsh.write("gancho-audifonos-pared.stl"); gmsh.finalize()
    return ("Gancho de pared para audífonos",
            "Gancho de 40 x 55 x 70 mm con brazo de 30 mm de ancho y tope para que no se resbale la diadema, dos barrenos avellanados para tornillo de 4 mm. "
            "Imprime acostado sobre la placa (sin soportes), PETG o PLA, 4 paredes y 30 % de relleno. También sirve para colgar cables, correas o bolsas ligeras.")

LIC = "\nDiseño original de HETNA CNC. Puedes usarlo y vender las piezas que fabriques con él.\nNo se permite revender ni compartir este archivo.\nhetnacnc.com\n"
import matplotlib; matplotlib.use("Agg")
from ezdxf.addons.drawing import matplotlib as dm
for nombre, fn in (("porta-llaves-pared", porta_llaves), ("mensula-repisa-decorativa", mensula)):
    d, (titulo, desc) = fn()
    aud = d.audit(); d.saveas(f"{nombre}.dxf")
    open("LEEME.txt", "w").write(f"{titulo.upper()} - HETNA CNC\n\nArchivo: {nombre}.dxf (milímetros, escala 1:1)\nCapas: CUT (corte) y ENGRAVE (grabado).\n\n{desc}\n" + LIC)
    with zipfile.ZipFile(f"{nombre}.zip", "w", zipfile.ZIP_DEFLATED) as z:
        z.write(f"{nombre}.dxf"); z.write("LEEME.txt")
    dm.qsave(d.modelspace(), f"{nombre}.png", bg="#FFFFFF", dpi=150)
    print(nombre, "errores:", len(aud.errors))

titulo, desc = gancho()
nombre = "gancho-audifonos-pared"
open("LEEME.txt", "w").write(f"{titulo.upper()} - HETNA CNC\n\nArchivo: {nombre}.stl (milímetros, escala 1:1)\n\n{desc}\n" + LIC)
with zipfile.ZipFile(f"{nombre}.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.write(f"{nombre}.stl"); z.write("LEEME.txt")
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
b = open(f"{nombre}.stl", "rb").read(); t = struct.unpack("<I", b[80:84])[0]
a = np.frombuffer(b[84:84 + t * 50], dtype=np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("x", "<u2")]))["v"]
fig = plt.figure(figsize=(6, 6)); ax = fig.add_subplot(111, projection="3d")
nrm = np.cross(a[:, 1] - a[:, 0], a[:, 2] - a[:, 0]); nrm /= (np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9)
luz = np.clip(nrm @ np.array([0.3, -0.5, 0.8]), 0.2, 1)
pc = Poly3DCollection(a, edgecolor="none"); pc.set_facecolor([(0.85 * l, 0.42 * l, 0.12 * l) for l in luz]); ax.add_collection3d(pc)
mn, mx = a.reshape(-1, 3).min(0), a.reshape(-1, 3).max(0); s = (mx - mn).max()
ax.set_xlim(mn[0], mn[0] + s); ax.set_ylim(mn[1], mn[1] + s); ax.set_zlim(mn[2], mn[2] + s)
ax.view_init(20, -60); ax.set_axis_off(); plt.tight_layout(); plt.savefig(f"{nombre}.png", dpi=120, facecolor="white"); plt.close(fig)
print(nombre, "triangulos:", t)
