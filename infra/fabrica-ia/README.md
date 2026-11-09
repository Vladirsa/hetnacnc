# Fábrica de contenido — trabajador de RunPod (Fase B)

Hace lo pesado de la Fábrica de contenido de Marketing HETNA en una GPU que se
prende sólo cuando hay trabajo y se apaga al terminar (RunPod Serverless):

| Tarea | Modelo / herramienta | Licencia |
|---|---|---|
| `imagen`: fondos por tema, imágenes de cada escena, miniaturas | FLUX.1 [schnell] | Apache 2.0 (uso comercial permitido) |
| `voz`: narración de cortos y del video largo | Kokoro-82M (+ espeak-ng para español) | Apache 2.0 |
| `transcribir`: subtítulos de tus videos grabados | faster-whisper + Whisper large-v3-turbo | MIT |
| `video_largo` y `cortes` | FFmpeg + fuente Archivo | LGPL/GPL (programa aparte) · OFL |

No se usa ninguna versión de modelo con licencia no comercial (por ejemplo,
FLUX.1 [dev] queda fuera).

## Montarlo en RunPod (una sola vez)

1. **Serverless → New Endpoint → Import from GitHub** y elige este repositorio.
   - Dockerfile: `infra/fabrica-ia/Dockerfile`
   - Contexto de build: la raíz del repositorio (igual que `infra/scan3d`).
2. **GPU:** una de **24 GB** (RTX 4090, A5000 o L4) alcanza. Con 48 GB las
   imágenes salen más rápido.
3. **Workers:** mínimo **0** (así no cobra cuando no se usa), máximo 1 o 2.
4. **Execution timeout:** **1800 s** (el video largo puede tardar varios minutos).
5. **Volumen de red (recomendado):** crea uno de ~60 GB y móntalo. Los modelos se
   descargan una vez ahí; sin volumen se descargan en cada arranque en frío.
6. **Variables de entorno del endpoint** (las mismas de B2 que ya usa el escaneo 3D):
   `B2_S3_ENDPOINT`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_PRIVATE_BUCKET_NAME`.
   Opcional: `HF_TOKEN` si Hugging Face pidiera iniciar sesión para bajar un modelo.
7. Copia el **ID del endpoint** y ponlo en el `.env` del backend (en el VPS),
   sin pegarlo en ningún chat:

   ```bash
   cd /root/hetnacnc/packages/api && read -rp "ID del endpoint de la Fábrica: " X && echo "RUNPOD_FABRICA_ENDPOINT_ID=$X" >> .env && pm2 restart hetna-api
   ```

   La llave `RUNPOD_API_KEY` ya existe (la usa el escaneo 3D).

## Voces

Por omisión: `em_alex` (español, hombre). Otras: `ef_dora` (español, mujer),
`am_adam` / `af_heart` (inglés). Se cambian con `FABRICA_VOZ_ES` y
`FABRICA_VOZ_EN` en el `.env` del backend.

## Advertencia

No pude correrlo de punta a punta aquí porque este entorno no tiene GPU. Las
partes de FFmpeg (video largo con subtítulos y música, cortes verticales con
gancho) sí se probaron. La primera corrida real en RunPod puede necesitar
algún ajuste menor de versiones.
