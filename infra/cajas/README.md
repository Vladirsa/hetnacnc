# Servicio de cajas (Boxes.py) para HETNA CNC

Los 178 generadores de [Boxes.py](https://github.com/florianfesti/boxes)
(cajas con juntas de dedo, bisagras, cajones, tapas corredizas, bandejas,
estantes, soportes de pared, engranajes, lámparas…) servidos para la tienda,
con los parámetros en español. La interfaz la pone el storefront en
`/disenar/cajas`; aquí sólo vive el motor.

## Licencia

Boxes.py es GPL-3.0. Se usa **sin modificar**, como programa aparte que la
tienda consulta por HTTP; eso no obliga a liberar el código de HETNA. Lo que
sí hay que cumplir y ya está en la página de la tienda:

- Decir que el motor es Boxes.py y enlazar su código fuente.
- No quitar su aviso de licencia.
- Si algún día se cambia Boxes.py mismo, publicar ese cambio con la misma licencia.

## Instalar en el VPS

```bash
cd ~/hetnacnc/infra/cajas
docker compose up -d --build
curl -s localhost:8012/salud      # {"ok": true, "generadores": 178}
```

Y en `apps/storefront/.env`:

```
CAJAS_URL=http://127.0.0.1:8012
```

Después `./scripts/desplegar.sh`. Sin `CAJAS_URL` la tienda muestra la
sección de cajas como "se está preparando" y no falla.

## Rutas de la API

| Ruta | Qué devuelve |
|---|---|
| `/salud` | `{"ok": true, "generadores": N}` |
| `/generadores` | grupos y lista de generadores (id, nombre, descripción, grupo) |
| `/generadores/<Id>` | parámetros por grupo, con tipo, default, ayuda y opciones |
| `/generar/<Id>?formato=svg&x=120&y=80&h=50&thickness=3` | el archivo: `svg`, `dxf`, `pdf`, `lbrn2` (LightBurn), `ps` |
| `/miniatura/<Id>` | imagen de muestra |

## Actualizar Boxes.py

Cambiar `BOXES_COMMIT` en el `Dockerfile` por el commit nuevo y volver a
construir. Probar antes `/generadores/UniversalBox` y un SVG.
