# Recuperar los productos del sitio anterior

Google todavía tiene guardadas fichas de tu tienda anterior (WooCommerce).
Si subes el mismo producto con **la misma dirección**, la dirección vieja lleva sola a la ficha nueva
y recuperas lo que ya tenías ganado en Google. Si no, siguen dando "página no encontrada".

Encontradas en Google el 23 nov 2026 (no es la lista completa; ver "Lista completa" al final).

## A. Productos físicos → Admin › Cargar productos (Excel)

En la plantilla, escribe la dirección vieja en la columna **"Agrupador"**: de ahí sale la dirección del producto.
Precio, existencias, peso y medidas: los de hoy (los del sitio viejo ya no sirven).

| Agrupador (copiar tal cual) | Producto |
|---|---|
| cortador-v-d-3-17520d-3-17538l-broca-fresa-xcan | Cortador en V D3.175 20° D3.175 38L (XCAN) |
| end-mills-4-filos-d38d450l-broca-fresa-2 | Fresa End Mill 4 filos D3×8 D4×50L |
| cabezal-divisor-de-enrutador-cnc-de-4-ejes-giratorio | Cabezal divisor giratorio 4.º eje para router CNC |
| cepillo-electrico-para-carpinteria-y-metalurgica-rueda-de-pulido-de-tambor-de-alambre-abrasivo-de-nailon-de-120x100x19mm-1-pieza | Cepillo/rueda de pulido de nailon abrasivo 120×100×19 mm |

Si el grupo tiene varias medidas (por ejemplo, fresa de 3, 6 y 8 mm), todas van con el mismo agrupador,
una medida por renglón.

## B. Diseños digitales → Admin › Subir diseños

Sube el archivo y la imagen; la IA llena la ficha. Antes de publicar, en el campo **"Dirección (handle)"**
borra lo que puso la IA y pega la dirección vieja:

| Dirección / handle (copiar tal cual) | Diseño |
|---|---|
| archivos-stl-de-cuadros-para-proyectos-cnc-169 | Cuadro STL 169 |
| archivos-stl-de-cuadros-para-proyectos-cnc-pez | Cuadro STL Pez |
| gratis-5-archivos-stl-de-puertas-para-proyectos-cnc-14 | 5 puertas STL (gratis) |
| coleccion-de-89-disenos-de-relojes-artisticos-para-cnc-y-grabado-laser-archivos-stl-y-vectores-tematicos | Colección de 89 relojes artísticos |
| archivo-stl-de-virgen-de-guadalupe-para-proyectos-cnc | Virgen de Guadalupe STL |
| diseno-stl-corazon-con-detalle-router-cnc-o-impresion-3d | Corazón con bajorrelieve STL |
| modelo-3d-bufalo-man-arte-devocional-para-cnc-e-impresion-3d | Búfalo Man 3D |
| modelo-3d-stl-superman-gordo-arte-devocional-para-cnc-e-impresion-3d | Superman Gordo 3D |
| adorno-18 | Adorno 18 STL |
| salmon | Salmón STL |
| salmon-1 | Salmón 1 STL |

Cuidado con los gratis: márcalos como gratis en la ficha (así no piden pago).

## C. Lista completa (la saca Google por ti)

Cuando tengas Search Console verificado:
1. Entra a **Indexación › Páginas**.
2. Abre **"No se encontró (404)"**.
3. Dale **Exportar** (arriba a la derecha) → Hojas de cálculo de Google o Excel.

Ahí salen TODAS las direcciones viejas que Google conoce. Las que empiezan con
`/product/`, `/prod/` o `/producto/` son productos: lo que va después es el agrupador o handle.
Mándame ese archivo y te armo las tablas completas.

## También detecté

- Un artículo viejo del blog: `/que-diferencia-hay-entre-una-broca-una-fresa-y-un-cortador-para-los-router-cnc/`
  (hoy da "no encontrada"). Cuando publiques la guía "¿Qué fresa usar para MDF?", lo redirijo a ella.
- Páginas de etiquetas viejas (`/etiqueta/...`), que también dan "no encontrada".
