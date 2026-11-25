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

## Publicar o actualizar el catálogo

1. Edita `apps/storefront/src/lib/impresion/catalogo-disenos.ts`.
2. Genera `catalogo.json` (volumen y medidas de cada pieza), las fotos y los modelos 3D. Se corre en `apps/storefront`:
   ```
   FUENTES_DIR=/ruta/fuentes OPENTYPE_JS=/ruta/opentype.js/dist/opentype.js MESHOPT_JS=/ruta/node_modules/meshoptimizer npx tsx scripts/generar-catalogo-impresion.ts
   ```
   - `FUENTES_DIR` tiene los paquetes `@fontsource/*` de npm (montserrat y pacifico para el catálogo actual).
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
