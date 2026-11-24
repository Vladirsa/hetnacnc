# GUÍA 5 — datos para el panel (Admin → Blog → Nuevo)

Título: G-code para principiantes: los comandos que necesitas para tu primer programa CNC
Dirección (slug): gcode-para-principiantes-comandos-basicos
Sección del foro: Diseño y CAM
Autor: Equipo HETNA
Resumen: Qué es el G-code, cómo se lee una línea y los comandos básicos (G0, G1, G2, G3, G90, G21, M3, M5) con un programa de ejemplo que puedes probar gratis en un simulador antes de usar tu máquina.
Título para Google: G-code para principiantes: comandos básicos y ejemplo
Descripción para Google: Aprende G-code desde cero: G0, G1, G2, G3, G90, G21, M3 y M5 explicados con un programa de ejemplo que puedes probar gratis en un simulador CNC.

----- CONTENIDO (copiar desde aquí) -----

El G-code es el idioma que entiende tu router, fresadora o torno CNC. Aunque casi siempre lo genera un programa de CAM, saber leerlo te ayuda a entender qué va a hacer la máquina, a corregir errores y a no chocar. Aquí van los comandos básicos y un primer programa que puedes probar gratis en el [Simulador CNC de HETNA](https://hetnacnc.com/mx/cam/simulador), sin arriesgar una fresa.

## Cómo se lee una línea

Cada línea es una orden. Por ejemplo:

**G1 X50 Y20 Z-3 F800**

- **G1**: qué hacer (moverse en línea recta cortando).
- **X50 Y20 Z-3**: a dónde ir, en milímetros.
- **F800**: a qué velocidad de avance (800 mm por minuto).

La máquina lee las líneas una por una, de arriba hacia abajo. Muchas órdenes se "quedan puestas": si escribes G1 una vez, las siguientes líneas siguen siendo G1 hasta que pongas otra.

## El cero de la pieza

Antes de programar, decide dónde está el cero. Lo más común en router y fresadora:

- **X0 Y0** en la esquina inferior izquierda del material (o en el centro).
- **Z0** en la cara de arriba del material. Hacia abajo los números son negativos: Z-3 es 3 mm adentro del material.

En el torno es distinto: Z0 es la cara de la pieza y X se escribe en diámetro.

## Los comandos que más vas a usar

- **G21**: trabajar en milímetros (G20 es pulgadas).
- **G90**: coordenadas absolutas, siempre desde el cero de la pieza (G91 es relativo a donde está la herramienta).
- **G0**: movimiento rápido, sin cortar. Úsalo sólo por arriba del material.
- **G1**: corte en línea recta con el avance F.
- **G2 / G3**: arcos en el sentido del reloj (G2) o al revés (G3). El centro se da con I y J, o el radio con R.
- **M3 S…**: encender el husillo a S revoluciones por minuto. **M5** lo apaga.
- **M30**: fin del programa.

## Tu primer programa: un contorno

Este programa recorre un rectángulo de 100 × 60 mm a 3 mm de profundidad:

- G21 G90 (milímetros y coordenadas absolutas)
- M3 S18000 (enciende el husillo)
- G0 Z5 (sube 5 mm por seguridad)
- G0 X10 Y10 (va rápido a la primera esquina, por arriba)
- G1 Z-3 F300 (baja cortando, despacio)
- G1 X110 F1200 (corta hasta la siguiente esquina)
- G1 Y70
- G1 X10
- G1 Y10
- G0 Z5 (sube)
- M5 (apaga el husillo)
- M30 (fin)

Cópialo sin los textos entre paréntesis, pégalo en el [simulador](https://hetnacnc.com/mx/cam/simulador) y dale **Ciclo de inicio**: verás la fresa cortar en 3D línea por línea.

## Los 3 errores que más chocan máquinas

1. **G0 dentro del material.** El rápido no corta: si lo usas para bajar o moverte adentro de la pieza, choca. Baja siempre con G1 y un avance F.
2. **Cortar con el husillo apagado.** Si olvidas M3, la fresa entra parada y se rompe.
3. **Olvidar el avance F.** Sin F, la máquina no sabe a qué velocidad cortar.

El simulador detecta los tres: la máquina virtual se detiene en la línea del error y te dice qué corregir. Prueba el ejercicio "Encuentra los errores".

## Siguiente paso: practica con ejercicios

En el simulador hay 10 ejercicios de fresadora y torno que se califican solos: te dan un plano, escribes tu programa y te dice si la pieza quedó bien, dónde cortaste de más o qué te faltó. Al aprobarlos todos te llevas tu constancia.

Y cuando quieras calcular las RPM y el avance para tu fresa y material, usa la [Calculadora CNC](https://hetnacnc.com/mx/calculadora-cnc).
