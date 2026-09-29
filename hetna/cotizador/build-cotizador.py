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
    "<style>html,body{margin:0}:root{padding-top:env(safe-area-inset-top,0px)}img{max-width:100%}[hidden]{display:none!important}</style>"
    "</head><body>"
)
os.makedirs(os.path.dirname(salida), exist_ok=True)
with open(salida, "w", encoding="utf-8") as f:
    f.write(cabeza + pagina + "</body></html>")
print("cotizador armado:", os.path.relpath(salida, raiz), len(cabeza + pagina) + 14, "caracteres")
