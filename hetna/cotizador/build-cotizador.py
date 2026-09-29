#!/usr/bin/env python3
# Arma la pagina del cotizador (public/hetna-cotizador/app.html) con los archivos de esta carpeta.
# Se corre desde instalar-taller.sh; tambien se puede correr solo despues de cambiar cualquier archivo.
import os

aqui = os.path.dirname(os.path.abspath(__file__))
raiz = os.path.abspath(os.path.join(aqui, "..", ".."))
salida = os.path.join(raiz, "apps", "storefront", "public", "hetna-cotizador", "app.html")


def leer(nombre):
    with open(os.path.join(aqui, nombre), encoding="utf-8") as f:
        return f.read()


pagina = leer("plantilla.html")
partes = {
    "__DATOS__": leer("datos.json"),
    "__ENGINE__": leer("engine.js") + "\nconst calcular_hetna = calcular;\n",
    "__GEO__": leer("geo.js"),
    "__EJEMPLOS__": leer("ejemplos.js"),
    "__APP__": leer("app.js"),
}
for marca, contenido in partes.items():
    assert pagina.count(marca) == 1, "falta la marca " + marca
    pagina = pagina.replace(marca, contenido)

cabeza = (
    '<!doctype html><html lang="es"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    '<meta name="robots" content="noindex">'
    "<style>html,body{margin:0}:root{padding-top:env(safe-area-inset-top,0px)}img{max-width:100%}[hidden]{display:none!important}"
    # Va debajo del encabezado de la tienda: la barra de la app es clara y discreta, no un segundo encabezado.
    "html body .top{background:#fff;color:#1B1B18;border-bottom:1px solid #E7E4DC;padding-top:8px;padding-bottom:8px}"
    "html body .marca b{font-size:17px}html body .marca svg{width:24px;height:24px}"
    "html body .taller-pill{background:#FAF6EF;border-color:#E7E4DC;color:#1B1B18}"
    "html body .volver{border-color:#E7E4DC;color:#1B1B18}"
    # Pantalla completa en computadora: ancho total, cabecera de lado a lado y dos columnas (pieza | datos).
    "@media(min-width:900px){"
    "html body .app{max-width:none;padding-inline:0}"
    "html body .top{margin-inline:0;padding:14px 32px}html body .taller-pill{max-width:none}"
    "#vista-cotizar{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:18px;align-items:start;max-width:1600px;margin:0 auto;padding:24px 32px}"
    "#vista-cotizar>#banner-plan{grid-column:1/-1;grid-row:1}"
    "#vista-cotizar>section{grid-column:2}"
    "#vista-cotizar>section:nth-of-type(1){grid-column:1;grid-row:2/span 4;position:sticky;top:84px}"
    "#vista-historial,#vista-taller{max-width:1100px;margin:0 auto;padding:24px 32px}"
    "html body .tabs{max-width:720px}"
    "}</style>"
    "</head><body>"
)
os.makedirs(os.path.dirname(salida), exist_ok=True)
with open(salida, "w", encoding="utf-8") as f:
    f.write(cabeza + pagina + "</body></html>")
print("cotizador armado:", os.path.relpath(salida, raiz), len(cabeza + pagina) + 14, "caracteres")
