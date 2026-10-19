# Laboratorio CAM

Del archivo a la máquina. Esta carpeta tiene los **motores**; la plataforma
sólo los llama.

## El patrón: bridges

Tomado de [rea](https://github.com/morluto/rea), que resuelve el mismo
problema en otro dominio: una sola aplicación que habla con muchas
herramientas externas sin casarse con ninguna.

- La plataforma **no sabe cortar nada**. Sabe pedirle a un motor que lo haga.
- Cada motor vive detrás de un bridge delgado en `bridges/`.
- Todos los bridges devuelven **la misma forma**, así que la pantalla no tiene
  que saber cuál respondió.
- Si un bridge falta o falla, **ese camino se apaga y el resto sigue**.

### El contrato

Éxito:

```json
{ "ok": true, "...": "lo que produjo el motor" }
```

Error — con los mismos campos siempre, copiados de
`rea/docs/error-contract.schema.json`:

```json
{
  "ok": false,
  "categoria": "sin_geometria",
  "mensaje": "El archivo no trae ninguna figura cerrada que se pueda cortar.",
  "reintentable": false,
  "remedio": "Revisa que tus contornos estén cerrados: en la mayoría de los programas es el comando 'unir' o 'cerrar polilínea'.",
  "detalles": {}
}
```

`remedio` es el campo que hace la diferencia: la pantalla le dice al taller
**qué hacer**, no le enseña un stacktrace. `reintentable` separa "esto no va a
funcionar nunca con este archivo" de "se cayó la red, vuelve a intentar".

## Bridges

### `dxf_gcode.py` — DXF a G-code 2.5D

El primero y el que importa: el 90% de los routers y láseres del mercado
hispano hacen 2.5D. Hacer eso bien vale más que hacer 5 ejes a medias.

Qué hace:

- Lee polilíneas cerradas y círculos de un DXF.
- Decide qué es borde y qué es barreno (una figura dentro de otra es un hueco).
- Compensa el radio de la fresa: el borde por fuera, los barrenos por dentro,
  para que la pieza salga de su medida.
- Reparte las pasadas según el espesor y lo que aguanta el material.
- Pone pestañas en el contorno exterior para que la pieza no se suelte en la
  última pasada.
- Avisa de lo que no pudo cortar en vez de ignorarlo en silencio.

```bash
python3 bridges/dxf_gcode.py placa.dxf placa.nc mdf 6 18
#                             entrada    salida  material fresa espesor
```

Verificado contra una placa de 200×120 con dos barrenos de 24: el contorno
sale de −3 a 203 y la trayectoria del barreno con radio 9, que es exactamente
la compensación correcta para una fresa de 6 mm.

### `materiales.json` — la receta de corte

El material y la fresa mandan: el avance, las rpm y la profundidad por pasada
salen de aquí, no se capturan a mano. Los valores son conservadores a
propósito — una pasada lenta de más cuesta minutos, una rápida de más cuesta la
fresa y la pieza.

## Qué falta

- **Cajeado** (vaciar un área, no sólo cortar su contorno).
- **SVG** como entrada, además de DXF.
- **Láser**: mismo contorno, pero con potencia y pasadas en vez de profundidad.
- **Agente local opcional**: hoy el taller descarga el G-code. Con un agente
  instalado podría mandarlo a la máquina y ver el estado. Es la pieza más
  frágil de todas (instalación, permisos, firewall, antivirus), así que se
  diseña como opcional desde el día uno: sin agente, el producto funciona
  completo.

## Lo que este laboratorio NO hace

3, 4 y 5 ejes siguen siendo un servicio manual, el que describe la página de
`laboratorio-cam` en el storefront. No es una limitación temporal: es la
decisión de dominar 2.5D antes de tocar lo demás.
