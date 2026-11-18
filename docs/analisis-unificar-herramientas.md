# Análisis: juntar herramientas de Diseñar (2D/3D Studio)

Hoy la barra del 2D Studio tiene **20 pestañas** y la del 3D Studio **5**. Muchas hacen
casi lo mismo con otro nombre, o piden lo mismo para empezar (una foto, un texto o un
archivo). La propuesta es bajar el 2D Studio a **9 pestañas** sin perder ninguna
función. Cada herramienta vieja se convierte en un **modo** de una nueva, y conserva su
URL para no perder Google.

Todo lo de abajo sale del código actual (`lib/generador/*` y `components/hetna/generador/*`).

## Lo que ya comparten por dentro

- **Mismo formato de dibujo.** Casi todas las herramientas 2D producen un
  `Dibujo` (`lib/generador/vectores.ts`: trazos con capa corte/grabado). Por eso pueden
  pasarse piezas entre sí sin convertir nada.
- **Misma pantalla.** 10 herramientas ya usan la misma pantalla, `Estudio2D`: celosías,
  bisagra viva, QR, rebanado, engranes, relojes, organizador, lámparas, esténcil y marcos.
- **Tipografías comunes.** Las cargan letreros, esténcil, QR, relojes, llaveros y
  letras 3D (`lib/generador/fuentes.ts`).
- **Foto en común.** Foto a grabado y Litofanía comparten el procesado de la foto
  (`lib/generador/grabado.ts`).
- **El acomodo en hojas está repetido 5 veces**, cada vez con un motor distinto:
  - Anidado y Letras 3D usan `anidar()`, el mejor.
  - Organizador, Lámparas y Rebanado usan `acomodarEnHojas()`, más simple.
  - Muebles tiene uno propio.
  - Cajas tiene `acomodar()`.

## Propuesta: de 20 pestañas a 9

| # | Nueva herramienta | Junta a (modos) | Por qué van juntas | Esfuerzo |
|---|---|---|---|---|
| 1 | **Patrones de corte** | Celosías + Patrones radiales + Bisagra viva | Las tres son "un patrón que se repite o se escala dentro de un área". El patrón radial puede ir **dentro** de una celosía (mandala calado en un panel). La bisagra viva es un patrón de cortes en una franja. | Medio |
| 2 | **Letreros y placas** | Letreros + Esténcil + Código QR | Las tres son "texto (o QR) sobre una placa". El esténcil es un letrero con puentes en las letras. El QR es una placa con un código y texto abajo. Comparten tipografías. | Medio |
| 3 | **Imagen** | Vectorizador + Foto a grabado (+ Litofanía, del 3D) | Las tres empiezan igual: subes una foto. Después eliges qué sacar: vectores para cortar, grabado para láser o relieve en 3D. Grabado y litofanía ya comparten el procesado de la foto. | Medio |
| 4 | **Archivos** | Convertidor + Anidado + Rebanado (+ SVG a STL, del 3D) | Las cuatro empiezan subiendo un archivo (DXF, SVG, STL u OBJ). Después eliges: escalar o convertir, acomodar en hojas, rebanar en capas o extruir a 3D. | Medio |
| 5 | **Cajas** | Cajas + Organizador de cajón | El organizador son separadores a la medida de un cajón. Cajas ya tiene divisores cruzados y a medida, así que el organizador es un tipo más de caja ("solo separadores"). | Bajo |
| 6 | Muebles | (se queda) | Es otra cosa: despiece de tableros con cantos y herrajes. | — |
| 7 | Empaques | (se queda) | Plantillas de cartón con dobleces; otro material y otro proceso. | — |
| 8 | Decoración | Relojes + Marcos + Lámparas por capas | Las tres son piezas decorativas por capas para regalo o venta. Es la fusión más débil; se puede dejar para después. | Medio |
| 9 | Engranes y Rompecabezas | (se quedan o van a "Juegos y mecanismos") | Muy distintos entre sí. Basta con sacarlos de la barra principal y dejarlos en "Todas". | Bajo |

**Resultado en la barra del 2D Studio:** Cajas · Patrones · Letreros y placas · Imagen ·
Archivos · Muebles · Empaques · Decoración · Más. Son 9 en lugar de 20.

**En el 3D Studio** quedan 3: Imagen a 3D, Letras 3D y Llaveros y placas. Litofanía pasa a
"Imagen" y SVG a STL pasa a "Archivos", porque ahí es donde el usuario los busca. Llaveros
podría ir dentro de "Letreros y placas" como modo 3D, pero conviene esperar a que (1) y
(2) funcionen.

## Lo más valioso: un solo "Acomodar en hojas" para todas

Más que juntar pestañas, el cambio que más ayuda a vender es este: **cualquier
herramienta que genera piezas tiene un botón "Acomodar en hojas"** que usa el motor de
Anidado.

- **Dónde va:** dentro de `Estudio2D`. Con un solo cambio lo ganan de inmediato las 10
  herramientas que ya lo usan. Después se agrega a Cajas, Rompecabezas y Letreros.
- **Qué hace:** eliges la hoja (600×400, 1220×2440…) y la cantidad de copias. Ves cuántas
  hojas necesitas y qué porcentaje se aprovecha, y descargas un DXF por hoja.
- **Por qué vende:** con número de hojas y m² se puede **cotizar en automático**.
  Fabrícamelo ya podría mandar "3 hojas de MDF 3 mm, 72% de aprovechamiento".
- **Limpieza:** se borran 4 de los 5 motores de acomodo repetidos. Todo usa `anidar()`,
  que ya separa piezas, las gira y respeta márgenes.

## Cómo hacerlo sin romper nada

1. **Las URLs viejas siguen vivas.** `/disenar/celosias` abre "Patrones" en modo celosía,
   `/disenar/estencil-letras` abre "Letreros" en modo esténcil, y así. Cada modo conserva
   su título y descripción para Google. Nadie cae en un 404 ni se pierde posicionamiento.
2. **Un selector de modo arriba del panel**, con tarjetas con dibujo, igual que los tipos
   de Cajas. Al cambiar de modo se conservan medidas y material.
3. **Por fases, un PR por fase:**
   - Fase 1: "Acomodar en hojas" en `Estudio2D` y Organizador dentro de Cajas.
     Es lo de menor riesgo y lo de más valor.
   - Fase 2: Patrones de corte (celosías + radiales + bisagra viva).
   - Fase 3: Letreros y placas (letreros + esténcil + QR).
   - Fase 4: Imagen y Archivos. Ahí entran las dos del 3D.
   - Fase 5 (opcional): Decoración, y mover Engranes y Rompecabezas a "Más".
4. **Pruebas en cada fase.** Cada modo genera los mismos archivos que la herramienta
   vieja; se comparan los DXF de antes y después con las mismas medidas. Antes de
   publicar se revisan las capturas en escritorio y celular.

## Riesgos

- **Patrones radiales** hoy usa su propio formato (`Punto[][]`) en lugar de `Dibujo`.
  Hay que adaptarlo; es un cambio chico.
- **Vectorizador, Grabado y Convertidor** son pantallas grandes (350–500 líneas) con su
  propio diseño. Juntarlas lleva más trabajo que las de `Estudio2D`.
- **SEO:** si se cambian títulos o se quitan páginas sin redirección se pierde tráfico.
  Por eso cada modo conserva su URL y su texto.
