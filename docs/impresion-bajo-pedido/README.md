# Impresión 3D bajo pedido

Diseños propios de HETNA (hechos con el Texturizador, con los Cortadores de galletas y con Modelos 3D: macetas, soportes, organizadores…) que se venden **impresos**. Cualquier taller con impresora pone su oferta (material, precio, días, colores) y el cliente elige.

## Cómo funciona

- **Productos:** colección `impresion-3d-bajo-pedido`. Cada diseño es un producto maestro con una variante por material: PLA, PETG, ABS, PLA-CF, TPU y Resina.
- **Ofertas:**
  - Cada taller las pone desde su panel, en **Imprime diseños HETNA** (`/seller/imprimir`).
  - Precio: lo que paga el cliente (con IVA, sin envío).
  - Días hábiles: `leadtime_to_ship`.
  - Colores: `metadata.colores`.
  - El color que elige el cliente viaja en el renglón del carrito (`metadata.color`).
- **Precio recomendado:** sale del volumen real de la pieza, con el mismo motor de `/store/precio-instantaneo`. Ya incluye IVA.
- **Destacado:**
  - Cuesta $150 por 30 días; se paga con Mercado Pago desde el mismo panel.
  - Webhook: `https://hetnacnc.com/api/mp-destacado`.
  - Se guarda en `seller.metadata.destacado_impresion`, una llave protegida que el taller no puede escribir.
  - El taller destacado sale primero y con insignia en la ficha.
  - Para cambiar el precio, usa la variable `PRECIO_DESTACADO_IMPRESION`.
- **Ficha:**
  - Debajo de las fotos (con la vista 3D para girar la pieza) sale "Talleres que te lo imprimen".
  - En la columna de compra van el precio desde, cuántos talleres lo imprimen y la liga para descargarlo gratis o cambiarle las medidas en la herramienta.

## Llaveros y placas con nombre

- Están en `LLAVEROS_IMPRESION` (`catalogo-disenos.ts`) y se arman con la misma herramienta de llaveros (`lib/generador/llaveros.ts`).
- Son `personalizable`: en la ficha el cliente escribe su nombre antes de agregarlo, y va en `metadata.texto` del renglón. El taller lo ve en el correo del pedido como «Texto: …».
- "Modificar" abre `/disenar/llaveros?texto=…&forma=…&fuente=…`, donde puede cambiar la forma, poner un ícono o su logo, o bajar muchos nombres en un ZIP.

## Letras 3D listas

- Están en `LETRAS_IMPRESION` y se arman con `lib/generador/letras3dImpresion.ts` (de pie con base, para colgar o huecas para LED).
- También son `personalizables`: el cliente escribe su palabra al agregarlas.
- Las fotos y la vista 3D salen paradas y de frente. El STL que baja el cliente en la herramienta viene en la posición para imprimir.
- "Modificar" abre `/disenar/letras-3d?modo=impresion&texto=…&estilo=…`. Las de colgar traen la plantilla de montaje en PDF a tamaño real.

## Mapas topográficos

- Están en `MAPAS_IMPRESION` (`catalogo-disenos.ts`): Pico de Orizaba, Popocatépetl e Iztaccíhuatl, Nevado de Toluca y Cerro de la Silla.
- Se arman con `mallaMapa` (`lib/generador/mapaTopo.ts`): una base de 2 mm y 10 capas de 2 mm, cada una sólo en su grosor, de 120 × 120 mm.
- Van a dos colores: «Base y montaña» y «Cumbre» (las capas de arriba).
- Las alturas están guardadas en `alturas/<handle>.json` (la misma cuadrícula de 160 px que usa la herramienta), así que el generador no usa la red. Para un lugar nuevo, o si cambias `lat`, `lon` o `km`, corre `npx tsx scripts/alturas-mapas.ts` en `apps/storefront`. El generador y la prueba se detienen si las alturas son de otro lugar.
- La foto va en degradado por capa (de verde a café). La cumbre sale blanca sólo en los que llevan `nevado`.
- El crédito de las alturas sale en la descripción de la ficha (`CREDITO` en `mapaTopo.ts`). Para México lo exige INEGI (Relieve continental, 2016).
- "Modificar" abre `/disenar/mapa-topografico?lat=…&lon=…&km=…`, que carga el lugar solo. Ahí el cliente baja el STL para su impresora o las capas en DXF para láser.

## Publicar o actualizar el catálogo

1. Edita `apps/storefront/src/lib/impresion/catalogo-disenos.ts`.
2. Genera `catalogo.json` (volumen y medidas de cada pieza), las fotos y los modelos 3D. Se corre en `apps/storefront`:
   ```
   FUENTES_DIR=/ruta/fuentes OPENTYPE_JS=/ruta/opentype.js/dist/opentype.js MESHOPT_JS=/ruta/node_modules/meshoptimizer npx tsx scripts/generar-catalogo-impresion.ts
   ```
   - `FUENTES_DIR` tiene los paquetes `@fontsource/*` de npm (montserrat, pacifico, lobster, bebas-neue, oswald, cinzel y alfa-slab-one para el catálogo actual).
   - `OPENTYPE_JS`: `opentype.js@1.3.4`, la misma que usa la página (la 2.x no lee Oswald).
   - `MESHOPT_JS` es el paquete `meshoptimizer` de npm: simplifica el modelo 3D de la ficha a 20 mil triángulos (~1 MB) para que cargue rápido en celular.
   - Para rehacer sólo las piezas de Modelos 3D (sin tipografías): `SOLO_MODELOS=1 npx tsx scripts/generar-catalogo-impresion.ts`.
3. Fotos y vista 3D: el mismo script las dibuja de la malla.
   - `fotos/<handle>.png`: 1000 × 1000, vista isométrica, **fondo blanco** (la regla de la tienda, `utils/fondo-blanco.ts`).
   - `modelos/<handle>.stl`: el modelo que el cliente gira en la ficha ("Vista 3D").
   - Los cortadores salen con el sello a un lado.
   - En las piezas de pura pared (cortadores) el JSON lleva `"relleno": 100` para que los gramos salgan bien.
4. Publica (en `packages/api`, en el servidor):
   ```
   COLORES="ABS=Amarillo dorado;PLA-CF=Negro" ./node_modules/.bin/medusa exec ./src/scripts/sembrar-impresion-bajo-pedido.ts
   ```
   - Es idempotente.
   - Para corregir el color de ofertas de HETNA que ya existen (sin tocar precio ni días): agrega `ACTUALIZAR_COLORES=1`.
   - Para volver a subir la foto de productos ya publicados: `ACTUALIZAR_FOTOS="handle1,handle2"` (o `todas`).
   - Crea la colección y los productos que falten.
   - Pone la oferta de HETNA: ABS y PLA-CF, 3 días hábiles, al precio recomendado, en los colores de `COLORES`, por material (`ABS=Amarillo dorado;PLA-CF=Negro`) o iguales para todos (`Negro`). Sin `COLORES` no pone la oferta de HETNA.
   - No cambia las ofertas que ya existan.
   - Si la foto o el modelo 3D cambiaron (huella sha1 en la metadata), los vuelve a subir. La foto sólo se cambia si es la que puso este script; una foto puesta a mano se respeta.
