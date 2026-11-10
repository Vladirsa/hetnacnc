# Trabajador de RunPod Serverless para la Fábrica de contenido de HETNA.
# Igual que infra/scan3d: RunPod lo construye con "Import from GitHub" y el
# contexto de build es la RAÍZ del repositorio (por eso los COPY usan la ruta
# completa). Los modelos NO van dentro de la imagen: se descargan la primera
# vez y, con un volumen de red montado en /runpod-volume, se guardan ahí.
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 FUENTES_DIR=/app/fonts
WORKDIR /app

# ffmpeg: armar videos · espeak-ng: pronunciación en español para Kokoro
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg espeak-ng fontconfig \
    && rm -rf /var/lib/apt/lists/*

COPY infra/fabrica-ia/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Fuente Archivo (OFL) para los subtítulos, la misma del resto de la marca
COPY packages/api/assets/fonts /app/fonts
RUN mkdir -p /usr/share/fonts/truetype/archivo && cp /app/fonts/*.ttf /usr/share/fonts/truetype/archivo/ && fc-cache -f

COPY infra/fabrica-ia/handler.py infra/fabrica-ia/storage.py /app/

CMD ["python", "-u", "/app/handler.py"]
