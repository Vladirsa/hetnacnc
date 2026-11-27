# GUÍA 9 — datos para el panel (Admin → Blog → Nuevo)

Título: Diseño paramétrico gratis: dale un patrón Voronoi, panal u ondas a tu maceta (impresión 3D y router CNC)
Dirección (slug): diseno-parametrico-patrones-3d-maceta
Sección del foro: Impresión 3D
Autor: Equipo HETNA
Resumen: Sube tu maceta, florero o pantalla de lámpara en STL y aplícale un patrón paramétrico (Voronoi, panal, ondas, espiral, estrías…) con torsión. Cómo elegir medidas, imprimirlo bien y tallar el mismo patrón en router CNC.
Título para Google: Diseño paramétrico gratis: patrones Voronoi y panal en tu STL | HETNA
Descripción para Google: Aplica patrones paramétricos (Voronoi, panal, ondas, espiral) a tu maceta o florero en STL. Gratis, en el navegador, para impresión 3D o relieve en router CNC.

----- CONTENIDO (copiar desde aquí) -----

El diseño paramétrico es diseñar con reglas en lugar de dibujar cada detalle: dices "celdas de 12 mm, 1.5 mm de relieve, que giren 60° de abajo hacia arriba" y la computadora arma la superficie. Si cambias un número, todo se recalcula. Así se hacen esas macetas y lámparas con textura de panal o de piel que se ven en tiendas de diseño. Aquí te explicamos cómo hacerlo gratis, sin instalar nada.

## 1. Elige el modelo

Abre [Patrones paramétricos 3D](https://hetnacnc.com/mx/disenar/patrones-3d) y elige de dónde sale la pieza:

- **Uno de los nuestros:** florero, pantalla de lámpara, portavelas o maceta recta, con su escala en porcentaje.
- **El tuyo:** sube un STL u OBJ. Funciona mejor con piezas redondas o casi redondas (macetas, vasos, floreros, pantallas). Si tu modelo llega acostado, usa **Arriba es Y** o **Arriba es X** para pararlo.

El archivo no sale de tu navegador: todo se calcula en tu computadora o celular.

## 2. Elige el patrón

- **Ondas:** anillos ondulados alrededor.
- **Espiral:** ondas que suben girando.
- **Estrías:** canales verticales, como una columna.
- **Rombos:** puntas de diamante, como un moleteado.
- **Panal:** celdas hexagonales con borde.
- **Voronoi:** celdas orgánicas, como piel o espuma. Con **Otra variación** sale un acomodo distinto.
- **Burbujas:** círculos en relieve acomodados.
- **Orgánico:** relieve irregular, como piedra.

El patrón cierra exacto alrededor de la pieza: la herramienta ajusta el número de celdas por vuelta para que no quede una costura.

## 3. Ajusta los números

- **Tamaño de la celda:** de 8 a 20 mm se ve bien en una maceta de mano. Celdas chicas dan una textura fina; celdas grandes, un patrón que se nota de lejos.
- **Profundidad:** cuánto sobresale el patrón. Con número negativo se hunde en lugar de sobresalir.
- **Torsión:** gira el patrón de abajo hacia arriba (por ejemplo 60° o 90°). Con estrías o panal da un efecto de remolino.
- **Liso arriba y liso abajo:** deja una franja sin patrón en el borde y en la base, para que asiente bien y el borde se vea limpio.
- **Sólo por fuera:** activado, el interior de la maceta se queda liso.

Revisa el resultado en **Vista 3D** y gíralo con el dedo o el ratón.

## 4. Para impresión 3D

- Descarga el **STL** en Exportación. Sale como una pieza cerrada, lista para el laminador.
- Usa una profundidad de **0.8 mm o más**: los relieves más bajos casi no se ven en una impresora de filamento.
- Imprime con **paredes normales**, no en "modo jarrón": el patrón necesita pared con grosor.
- Una boquilla de 0.4 mm y capas de 0.2 mm bastan. Para un acabado más fino en Voronoi o burbujas, baja a 0.12–0.16 mm.
- Si es una **pantalla de lámpara**, úsala sólo con focos LED: el plástico se deforma con el calor de un foco incandescente.

## 5. Para router CNC

La herramienta también da el patrón **desenrollado como relieve plano**: una placa con el mismo diseño para tallar en madera o MDF (un panel decorativo, la cabecera de una cama, el frente de una puerta o de un cajón).

- Descarga el **STL del relieve plano** y ábrelo en tu programa de CAM como relieve 3D.
- Desbasta con una fresa plana y da el acabado con una **fresa de punta de bola**; entre más chica la bola, más detalle (3 mm es un buen punto de partida para celdas de 12 mm).
- También puedes mandar el modelo al [Laboratorio CAM de HETNA](https://hetnacnc.com/mx/laboratorio-cam) para sacar el G-code en 3 a 5 ejes.

## Ideas para vender

- **Macetas con patrón** para viveros, florerías y tiendas de decoración: el mismo modelo con Voronoi, panal y espiral es una colección de tres.
- **Pantallas de lámpara** con panal o burbujas: con un foco LED cálido, la textura se marca con la luz.
- **Paneles tallados en router** con el mismo patrón que las macetas: un juego que combina para un local o un restaurante.

## ¿No tienes impresora 3D?

Diseña tu pieza y toca **Imprimir en 3D** en Exportación: un taller de la red HETNA te la imprime y te la envía.

Y para seguir diseñando: lee [Cómo hacer un rodillo texturizador con nombre en impresión 3D](https://hetnacnc.com/mx/foro-cnc/blog/como-hacer-rodillo-texturizador-impresion-3d) o [Cómo partir un STL grande en piezas](https://hetnacnc.com/mx/foro-cnc/blog/como-partir-stl-para-imprimir-en-partes).
