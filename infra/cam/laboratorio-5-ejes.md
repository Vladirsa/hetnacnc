# Laboratorio CAM 3, 4 y 5 ejes

El cliente sube su pieza (STL, OBJ, STEP o IGES) en `hetnacnc.com/mx/cam/lab`, configura su
máquina, ve la trayectoria con anticolisión y paga el programa. HETNA recibe el trabajo en el
panel (**Trabajos CAM**), lo revisa y sube los archivos finales. El cliente los descarga en
**Mis trabajos CAM** (`/mx/user/cam`).

Viene del paquete `hetna-cam-medusa` (EJE 4 Y 5), adaptado a Mercur:

| Parte | Dónde |
|---|---|
| Laboratorio (HTML + Three.js) | `apps/storefront/public/cam-lab/index.html` |
| Página `/cam/lab` y marco | `apps/storefront/src/app/[locale]/(main)/cam/lab`, `components/hetna/cam/lab` |
| Mis trabajos CAM | `apps/storefront/src/app/[locale]/(main)/user/cam` |
| Carrito y lista (servidor) | `apps/storefront/src/lib/data/cam.ts` |
| Módulo `cam` (tabla `cam_job`) | `packages/api/src/modules/cam` |
| API tienda y admin | `packages/api/src/api/store/cam`, `packages/api/src/api/admin/cam` |
| Subida de archivos | `packages/api/src/api/cam-multipart.ts` (sin multer: usa el lector de Node) |
| Pedido pagado → trabajo pagado | `packages/api/src/subscribers/cam-order-placed.ts` |
| Productos y ofertas | `packages/api/src/scripts/seed-cam-services.ts` |
| Panel "Trabajos CAM" | `apps/admin/src/routes/trabajos-cam/page.tsx` |

## Cómo cobra

1. El servidor elige el servicio por la estrategia (3, 4 o 5 ejes) y el nivel por el trabajo
   calculado (`TIER_RULES` en `modules/cam/catalog.ts`): **Alta** si pasa de 90 min,
   60 000 puntos o 500 000 triángulos; **Media** si pasa de 20 min, 15 000 puntos o
   100 000 triángulos; si no, **Básica**.
2. En Mercur el carrito vende **ofertas** de una tienda. Los servicios los vende la tienda
   `hetna-cnc` (o la que diga `CAM_SELLER_HANDLE`), con una oferta por nivel.
3. Los productos llevan la etiqueta `digital`: usan el perfil "Producto digital" y en el pago
   sale **Entrega digital** a $0.
4. Al colocarse el pedido, el trabajo pasa solo a **Pagado**.

## Poner en marcha (una vez)

Después de `./scripts/desplegar.sh` (que ya corre la migración de la tabla `cam_job`):

```bash
cd ~/hetnacnc/packages/api
NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/seed-cam-services.ts
```

Crea los 5 productos (CAM 3, 4 y 5 ejes, posprocesador y revisión) y las 11 ofertas de la
tienda HETNA con precios de ejemplo en MXN. Se puede correr varias veces. Para ver qué haría
sin cambiar nada: `DRY_RUN=1`. Los precios se cambian después en el panel de la tienda.

## Variables opcionales (`packages/api/.env`)

| Variable | Para qué |
|---|---|
| `CAM_SELLER_HANDLE` | Tienda que vende los servicios. Por defecto `hetna-cnc`. |
| `CAM_MAX_UPLOAD_MB` | Tamaño máximo de la pieza. Por defecto 80. |
| `CAM_WEBHOOK_URL`, `CAM_WEBHOOK_SECRET` | Aviso a n8n en cada evento (`cam_job.created`, `paid`, `in_review`, `delivered`, `files_added`). El secreto llega en `x-hetna-secret`. |

## Nginx

La pieza se sube a `/store/cam/jobs`. Si Nginx tiene el `client_max_body_size` por defecto
(1 MB), las piezas grandes fallan con 413. En el bloque de `hetnacnc.com`:

```nginx
location ^~ /store/cam/ {
    client_max_body_size 100m;
    proxy_pass http://127.0.0.1:9000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_request_buffering off;
}
```

Cloudflare (plan gratis) acepta hasta 100 MB por petición.

## Límites conocidos

- La conversión de STEP / IGES se hace en el navegador. La del servidor
  (`/store/cam/convert`) sólo funciona si se instala `occt-import-js` en `packages/api`; sin él
  responde 501 y el laboratorio pide un STL.
- Con el almacenamiento local, los archivos "privados" quedan en `static/` con un nombre
  difícil de adivinar, no detrás de un permiso. Para privacidad real, usar S3 / Spaces.
- La simulación es de referencia: todo programa se prueba en vacío y con avance reducido.
- El cliente puede cambiar la cantidad de la línea del servicio en el carrito.
