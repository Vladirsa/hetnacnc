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
- **Ficha:** en lugar de "Fabrícalo" sale "Talleres que te lo imprimen", más la liga para descargarlo gratis o cambiarle las medidas en la herramienta.

## Publicar o actualizar el catálogo

1. Edita `apps/storefront/src/lib/impresion/catalogo-disenos.ts`.
2. Genera `catalogo.json` (volumen y medidas de cada pieza). Se corre en `apps/storefront`:
   ```
   FUENTES_DIR=/ruta/fuentes OPENTYPE_JS=/ruta/opentype.js/dist/opentype.js npx tsx scripts/generar-catalogo-impresion.ts
   ```
   - `FUENTES_DIR` tiene los paquetes `@fontsource/*` de npm.
   - Para rehacer sólo las piezas de Modelos 3D (sin tipografías): `SOLO_MODELOS=1 npx tsx scripts/generar-catalogo-impresion.ts`. Sus fotos las dibuja el mismo script.
3. Fotos de rodillos y placas: `fotos/<handle>.png`, de 1:1. Se toman del Texturizador con el diseño cargado:
   - abre `/disenar/texturizador?…` (la liga `herramienta_url` del JSON);
   - agrega `&soporte=1` para ver el rodillo puesto en el soporte;
   - los cortadores se abren en `/disenar/cortadores-galletas?…` (cortador y sello juntos en la vista 3D).
   - En las piezas de pura pared (cortadores) el JSON lleva `"relleno": 100` para que los gramos salgan bien.
4. Publica (en `packages/api`, en el servidor):
   ```
   COLORES="Negro" ./node_modules/.bin/medusa exec ./src/scripts/sembrar-impresion-bajo-pedido.ts
   ```
   - Es idempotente.
   - Crea la colección y los productos que falten.
   - Pone la oferta de HETNA: ABS y PLA-CF, 3 días hábiles, al precio recomendado, en los colores de `COLORES` (por ejemplo `COLORES="Negro"`). Sin `COLORES` no pone la oferta de HETNA.
   - No cambia las ofertas que ya existan.
