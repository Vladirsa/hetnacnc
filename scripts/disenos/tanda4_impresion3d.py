# Diseños para impresión 3D de HETNA CNC (27 nov 2026): STL listos para imprimir sin soportes.
#   - Maceta cónica de 10 cm con plato (drenaje)
#   - Soporte para celular o tableta (60°, con ranura para cable)
#   - Organizador de escritorio de 3 compartimentos
import math, struct, zipfile
import gmsh

def iniciar(nombre):
    gmsh.initialize(); gmsh.option.setNumber("General.Terminal", 0); gmsh.model.add(nombre)
    return gmsh.model.occ

def guardar(nombre, piezas_stl):
    gmsh.model.occ.synchronize()
    gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 36)
    gmsh.option.setNumber("Mesh.MeshSizeMax", 5)
    gmsh.option.setNumber("Mesh.Binary", 1)
    gmsh.model.mesh.generate(2)
    gmsh.write(piezas_stl); gmsh.finalize()
    b = open(piezas_stl, "rb").read()
    return struct.unpack("<I", b[80:84])[0]

def maceta():
    occ = iniciar("maceta")
    H, R_ARR, R_AB, PARED, FONDO = 90.0, 52.0, 40.0, 2.4, 3.0
    ext = occ.addCone(0, 0, 0, 0, 0, H, R_AB, R_ARR)
    k = (R_ARR - R_AB) / H
    inte = occ.addCone(0, 0, FONDO, 0, 0, H, R_AB + k * FONDO - PARED, R_ARR + k * FONDO - PARED)
    dren = [occ.addCylinder(dx, dy, -1, 0, 0, FONDO + 2, 4) for dx, dy in ((0, 0), (16, 0), (-16, 0), (0, 16), (0, -16))]
    occ.cut([(3, ext)], [(3, inte)] + [(3, d) for d in dren])
    # Plato aparte, a un lado: disco con borde
    PX = 130.0
    base = occ.addCylinder(PX, 0, 0, 0, 0, 12, 56)
    hueco = occ.addCylinder(PX, 0, 2.4, 0, 0, 12, 56 - 2.4)
    occ.cut([(3, base)], [(3, hueco)])
    n = guardar("maceta", "maceta-conica-10cm.stl")
    return "maceta-conica-10cm", ["maceta-conica-10cm.stl"], n, ("Maceta cónica de 10 cm con plato",
        "Maceta de 104 mm de diámetro arriba, 80 mm abajo y 90 mm de alto, pared de 2.4 mm y 5 barrenos de drenaje, con plato de 112 mm aparte (las dos piezas en el mismo STL, listas para imprimir). "
        "Imprime sin soportes con la boca hacia arriba: PETG para exterior, PLA para interior; 3 paredes, 15 % de relleno. Buen producto para vender en mercados y regalos.")

def soporte():
    occ = iniciar("soporte")
    W = 70.0  # ancho (eje Y)
    # Perfil en XZ: base, respaldo inclinado a 60° y tope delantero; extruido en Y
    perfil = [(0, 0), (100, 0), (100, 5), (60, 5), (95, 95), (89, 98), (50, 8), (20, 8), (20, 20), (12, 20), (12, 5), (0, 5)]
    pts = [occ.addPoint(x, 0, z) for x, z in perfil]
    lin = [occ.addLine(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]
    sup = occ.addPlaneSurface([occ.addCurveLoop(lin)])
    cuerpo = [e for e in occ.extrude([(2, sup)], 0, W, 0) if e[0] == 3]
    # Ranura para el cable al centro del tope delantero y de la base
    ranura = occ.addBox(8, W / 2 - 6, -1, 16, 12, 30)
    occ.cut(cuerpo, [(3, ranura)])
    n = guardar("soporte", "soporte-celular-tableta.stl")
    return "soporte-celular-tableta", ["soporte-celular-tableta.stl"], n, ("Soporte para celular o tableta a 60°",
        "Soporte de 100 x 70 mm y 98 mm de alto, respaldo inclinado, tope delantero de 12 mm para fundas gruesas y ranura de 12 mm para cargar con el cable puesto. "
        "Aguanta celulares y tabletas de hasta 11\". Imprime acostado de lado (el perfil sobre la cama) sin soportes; PLA o PETG, 4 paredes, 25 % de relleno.")

def organizador():
    occ = iniciar("organizador")
    L, W, H, P = 150.0, 90.0, 95.0, 2.4
    caja = occ.addBox(0, 0, 0, L, W, H)
    # Tres compartimentos: plumas (alto), tarjetas/clips (medio) y celular (bajo, al frente)
    huecos = [
        occ.addBox(P, P, P, 60 - 1.5 * P, W - 2 * P, H),          # plumas, todo el alto
        occ.addBox(60, P, 35, 90 - P, W / 2 - 1.5 * P, H),          # atrás: notas (fondo a 35 mm)
        occ.addBox(60, W / 2 + P / 2, 55, 90 - P, W / 2 - 1.5 * P, H),  # frente: clips/celular (fondo a 55 mm)
    ]
    # Rebaje frontal para sacar las cosas del compartimento de adelante
    rebaje = occ.addCylinder(105, W + 1, H + 10, 0, -(P + 2), 0, 28)
    occ.cut([(3, caja)], [(3, h) for h in huecos] + [(3, rebaje)])
    n = guardar("organizador", "organizador-escritorio.stl")
    return "organizador-escritorio", ["organizador-escritorio.stl"], n, ("Organizador de escritorio de 3 compartimentos",
        "Organizador de 150 x 90 x 95 mm con un compartimento alto para plumas y tijeras y dos escalonados para notas, clips o el celular, con rebaje al frente para sacar las cosas. "
        "Pared de 2.4 mm. Imprime sin soportes; PLA, 3 paredes, 15 % de relleno. Se puede vender con logo grabado o en colores de empresa.")

LIC = "\nDiseño original de HETNA CNC. Puedes usarlo y vender las piezas que fabriques con él.\nNo se permite revender ni compartir este archivo.\nhetnacnc.com\n"

def vista(nombre, stl):
    import numpy as np, matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    b = open(stl, "rb").read(); t = struct.unpack("<I", b[80:84])[0]
    a = np.frombuffer(b[84:84 + t * 50], dtype=np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("x", "<u2")]))["v"]
    fig = plt.figure(figsize=(6, 6)); ax = fig.add_subplot(111, projection="3d")
    nrm = np.cross(a[:, 1] - a[:, 0], a[:, 2] - a[:, 0]); nrm /= (np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9)
    luz = np.clip(nrm @ np.array([0.3, -0.5, 0.8]), 0.2, 1)
    pc = Poly3DCollection(a, edgecolor="none"); pc.set_facecolor([(0.85 * l, 0.42 * l, 0.12 * l) for l in luz]); ax.add_collection3d(pc)
    mn, mx = a.reshape(-1, 3).min(0), a.reshape(-1, 3).max(0); s = (mx - mn).max()
    ax.set_xlim(mn[0], mn[0] + s); ax.set_ylim(mn[1], mn[1] + s); ax.set_zlim(mn[2], mn[2] + s)
    ax.view_init(28, -55); ax.set_axis_off(); plt.tight_layout(); plt.savefig(f"{nombre}.png", dpi=120, facecolor="white"); plt.close(fig)

for fn in (maceta, soporte, organizador):
    nombre, archivos, n, (titulo, desc) = fn()
    open("LEEME.txt", "w").write(f"{titulo.upper()} - HETNA CNC\n\nArchivo: {', '.join(archivos)} (milímetros, escala 1:1)\n\n{desc}\n" + LIC)
    with zipfile.ZipFile(f"{nombre}.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for f in archivos: z.write(f)
        z.write("LEEME.txt")
    vista(nombre, archivos[0])
    print(nombre, "triangulos:", n)
