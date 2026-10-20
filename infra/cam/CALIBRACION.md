# Pieza de calibración

`calibracion-60x60.dxf` — un cuadrado de **60.00 mm** por lado con un barreno
centrado de **20.00 mm** de diámetro.

Las medidas son redondas a propósito: al medirla con calibrador, cualquier
desviación se lee de inmediato sin hacer cuentas.

## Cómo usarla

1. Súbela en `hetnacnc.com/mx/cam/subir`.
2. Elige tu material, tu fresa y el espesor real de la placa.
3. Descarga el G-code y córtalo en **material de desecho**.
4. Mide la pieza con calibrador: el lado y el barreno.

En MDF de 9 mm con fresa de 6 son 3 pasadas y alrededor de un minuto.

## Cómo leer el resultado

| Lado | Barreno | Qué significa |
|---|---|---|
| 60.00 | 20.00 | Todo bien. Puedes confiar en el generador. |
| 54 (−6) | 26 (+6) | **Compensación invertida.** Es el error grave: corta por dentro del borde y por fuera del barreno. Avísame, es un error del programa. |
| 57 (−3) | 23 (+3) | **No está compensando.** Está siguiendo la línea con el centro de la fresa. También es error del programa. |
| 60.3 | 19.7 | La fresa mide menos de lo que dijiste, o flexiona. Mide tu fresa con calibrador y captura el valor real. |
| 59.7 | 20.3 | Al revés: la fresa corta más de lo nominal, o hay juego en la máquina. |
| Las dos chicas, o las dos grandes | | No es compensación: son los pasos por milímetro de tu máquina. Eso se calibra en el control, no aquí. |

La clave está en si los dos errores van **en sentido contrario** (problema de
compensación, mío) o **en el mismo sentido** (problema de la máquina, tuyo).

## Lo demás que vale la pena mirar

- **¿Se quemó el material?** El avance va lento o las revoluciones altas.
- **¿Se astilló o tembló?** El avance va rápido, o la profundidad por pasada
  es mucha para esa fresa.
- **¿La pieza se soltó antes de terminar?** Las pestañas quedaron cortas para
  ese material.

Cualquiera de esas tres se arregla en `materiales.json` con tus números
reales. Esa tabla es lo que vuelve el laboratorio tuyo en lugar de genérico:
hoy trae valores conservadores de referencia, no medidos contra tu máquina.
