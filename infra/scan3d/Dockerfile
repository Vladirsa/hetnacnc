# Imagen para RunPod Serverless (o cualquier runtime compatible con
# "docker run" + GPU NVIDIA). Usa la imagen "devel" de CUDA, no "runtime",
# porque torchmcubes (dependencia de TripoSR) se compila contra nvcc al
# instalar -- con la imagen "runtime" esa instalacion falla.
#
# El contexto de build que usa "Deploy from a GitHub repository" de RunPod
# es la raiz del repositorio completo, no esta carpeta -- por eso los COPY
# de abajo usan la ruta completa "infra/scan3d/..." en vez de solo el
# nombre del archivo. Si construyes esto a mano con el contexto puesto en
# infra/scan3d/ (ej. `docker build .` parado en esta carpeta), ajusta esas
# rutas o usa `docker build -f infra/scan3d/Dockerfile .` desde la raiz del
# repo para que coincida con como lo corre RunPod.
FROM nvidia/cuda:11.8.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

# build-essential/python3-dev: TripoSR instala torchmcubes directo desde
# git+https en su requirements.txt -- es una extension C++/CUDA que se
# compila al vuelo con pip install, necesita gcc/g++/make y los headers de
# Python, no solo el interprete.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev build-essential git wget unzip libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# --- AliceVision / Meshroom (motor del escaneo profesional) ---
# No hay un paquete pip -- se usa el bundle binario precompilado que
# publican como "Release" en Zenodo/GitHub. El default de abajo es el
# release 2025.1.0 (confirmado y en uso); se puede pisar con
# --build-arg MESHROOM_BUNDLE_URL=... si sale una version mas nueva, pero
# no es obligatorio -- algunas UIs (ej. "Deploy from a GitHub repository"
# en RunPod) no exponen un campo para build args, así que el build tiene
# que funcionar sin que nadie tenga que pasar nada.
ARG MESHROOM_BUNDLE_URL=https://zenodo.org/records/16887472/files/Meshroom-2025.1.0-Linux.tar.gz
# El archivo pesa 13.3GB -- en una descarga asi de larga es normal que la
# conexion se corte a medias una vez en un rato. --tries/--timeout hacen que
# wget reintente solo antes de tronar todo el build.
RUN wget --tries=5 --timeout=60 --waitretry=10 -O /tmp/meshroom.tar.gz "$MESHROOM_BUNDLE_URL" \
    && mkdir -p /opt/Meshroom \
    && tar -xzf /tmp/meshroom.tar.gz -C /opt/Meshroom --strip-components=1 \
    && rm /tmp/meshroom.tar.gz
ENV MESHROOM_BIN_DIR=/opt/Meshroom
ENV LD_LIBRARY_PATH=/opt/Meshroom/aliceVision/lib:${LD_LIBRARY_PATH}
ENV PATH=/opt/Meshroom:/opt/Meshroom/aliceVision/bin:${PATH}

# --- TripoSR (motor del preview gratis) ---
RUN git clone --depth 1 https://github.com/VAST-AI-Research/TripoSR.git /opt/TripoSR
ENV TRIPOSR_DIR=/opt/TripoSR

RUN python3 -m pip install --no-cache-dir --upgrade pip
RUN python3 -m pip install --no-cache-dir torch==2.1.2 torchvision==0.16.2 \
    --index-url https://download.pytorch.org/whl/cu118
RUN python3 -m pip install --no-cache-dir -r /opt/TripoSR/requirements.txt

COPY infra/scan3d/requirements.txt /app/requirements.txt
RUN python3 -m pip install --no-cache-dir -r /app/requirements.txt

COPY infra/scan3d/handler.py infra/scan3d/preview_triposr.py infra/scan3d/scan_meshroom.py infra/scan3d/convert_to_stl.py infra/scan3d/storage.py /app/

CMD ["python3", "-u", "handler.py"]
