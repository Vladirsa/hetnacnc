# Servicio de escaneo 3D (fotos -> STL/OBJ) para HETNA CNC

Convierte fotos de un taller en un modelo 3D. Dos modos, pensados como dos
productos distintos del catálogo:

- **`preview`** (gratis, gancho de venta): 1 foto -> malla aproximada con
  [TripoSR](https://github.com/VAST-AI-Research/TripoSR) (MIT). Es una
  "adivinanza" de IA, rápida y barata, pero **no mide el objeto real** —
  solo sirve para que el cliente vea un modelo 3D en el storefront antes de
  pagar. No se entrega STL en este modo.
- **`scan`** (de paga, el producto real): 15-60 fotos del mismo objeto desde
  distintos ángulos -> malla a escala real con
  [AliceVision/Meshroom](https://github.com/alicevision/meshroom) (MPL-2.0,
  libre para uso comercial). Esta sí mide — es fotogrametría clásica, no
  IA generativa — y es la única que se entrega como STL para mandar a
  fabricar/CNC.

No corre en el VPS actual (no tiene GPU). Corre como contenedor en **GPU
serverless** (RunPod Serverless recomendado): se paga por segundo de
cómputo real, y si nadie lo usa el costo es ~$0.

## Por qué está diseñado así

Ningún modelo de "una foto -> 3D" (TripoSR, pero también Hunyuan3D-2 o
TRELLIS, evaluados y descartados para el modo `scan`) mide el objeto real —
inventa la forma más probable. Para algo que un taller va a **fabricar**,
eso no sirve. Por eso el único camino a STL es fotogrametría real
(Meshroom), y el modelo de una foto se usa solo como preview gratuito para
atraer clientes, nunca como entrega final.

`graphdeco-inria/gaussian-splatting` se evaluó y se descartó por completo:
su licencia prohíbe uso comercial sin permiso explícito de Inria.

## Qué incluye

- `handler.py` — entrypoint de RunPod Serverless. Recibe URLs de fotos (ya
  subidas a B2 por n8n), corre el motor que toque, convierte a STL y sube
  el resultado de vuelta a B2.
- `preview_triposr.py` / `scan_meshroom.py` — cada motor, llamado como
  subproceso contra su CLI oficial (no se reimplementa su API interna).
- `convert_to_stl.py` — OBJ/GLB -> STL con `trimesh`. Reporta si la malla
  quedó "watertight" (cerrada) y sus dimensiones reales en mm.
- `storage.py` — sube el resultado al mismo bucket de B2 que ya usa la
  plataforma, vía la API S3-compatible de B2.
- `Dockerfile` — imagen con CUDA 11.8, AliceVision/Meshroom y TripoSR
  instalados.

<Warning>
No pude correr esto de extremo a extremo en este entorno: no tiene GPU ni
los pesos/binarios descargados. El código sigue la documentación oficial de
cada proyecto (CLI de TripoSR, `meshroom_batch` de AliceVision) y pasé la
parte de conversión a STL por una prueba real con `trimesh`, pero la
primera corrida real de cada motor hay que probarla ya en la GPU — es
normal que aparezca algún ajuste de rutas/flags la primera vez.
</Warning>

## 1. Crear cuenta en RunPod

1. Entra a [runpod.io](https://www.runpod.io) y crea cuenta.
2. **Serverless > New Endpoint > Import from GitHub** (o sube la imagen a
   Docker Hub tú mismo y usa esa opción) — apunta a esta carpeta
   (`infra/scan3d`).
3. Elige un tipo de GPU económico (ej. RTX 4090 o RTX A5000) — ninguno de
   los dos motores necesita las GPU más caras del catálogo.

## 2. El bundle de AliceVision ya viene fijo -- no hay que tocar nada

El `Dockerfile` trae un default (`MESHROOM_BUNDLE_URL`, release 2025.1.0,
confirmado y en uso) para que el build funcione solo. Algunas pantallas de
RunPod (ej. "Deploy from a GitHub repository") no tienen campo para
build args, así que ya no depende de que nadie lo configure ahí.

Si en el futuro sale un release más nuevo de
<https://github.com/alicevision/meshroom/releases> y quieres usarlo, pisa el
default solo si estás construyendo la imagen tú mismo con Docker local:

```bash
docker build --build-arg MESHROOM_BUNDLE_URL="<nuevo link .tar.gz>" -t hetna-scan3d .
```

## 3. Variables de entorno en RunPod

Copia `.env.example`, llena los valores de B2 (los mismos `B2_KEY_ID` /
`B2_APPLICATION_KEY` que ya usa `packages/api/.env` en el VPS) y
cárgalos como "Environment Variables" del endpoint en RunPod.

## 4. Probar el endpoint

RunPod te da una URL tipo `https://api.runpod.ai/v2/<endpoint_id>/run`. Un
trabajo de preview se ve así:

```bash
curl -X POST https://api.runpod.ai/v2/<endpoint_id>/run \
  -H "Authorization: Bearer <tu API key de RunPod>" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "mode": "preview",
      "job_id": "prueba-001",
      "image_urls": ["<url firmada de B2 a una foto>"],
      "output_prefix": "escaneos3d/prueba-001/"
    }
  }'
```

La respuesta trae un `id` de trabajo; consulta su estado en
`https://api.runpod.ai/v2/<endpoint_id>/status/<id>` hasta que diga
`COMPLETED`, con el resultado (`obj_storage_key`, y `stl_storage_key` si fue
modo `scan`) adentro.

## Pendiente: conectar con n8n y el catálogo

Este servicio solo procesa — todavía falta el workflow en n8n que:

1. Reciba las fotos del taller (Form Trigger), las suba a B2 y llame a este
   endpoint de RunPod.
2. Para el modo `scan`: solo dispare después de que el pago del producto
   "Escaneo 3D profesional" esté capturado (mismo patrón que
   `deliverDigitalProductsForOrder` en `packages/api/src/lib/digital-delivery.ts`).
3. Avise al taller por Telegram/WhatsApp cuando el resultado esté listo, con
   el link de descarga firmado (reutilizando `getSignedDownloadUrl` de
   `packages/api/src/lib/backblaze.ts`).

Dilo cuando quieras seguir con esa parte — ya con esto puedo armar el
workflow completo en n8n.
