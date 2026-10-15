# Imagen para RunPod Serverless (o cualquier runtime compatible con
# "docker run" + GPU NVIDIA). Usa la imagen "devel" de CUDA, no "runtime",
# porque torchmcubes (dependencia de TripoSR) se compila contra nvcc al
# instalar -- con la imagen "runtime" esa instalacion falla.
FROM nvidia/cuda:11.8.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip git wget unzip libgl1 libglib2.0-0 \
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
RUN wget -O /tmp/meshroom.tar.gz "$MESHROOM_BUNDLE_URL" \
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

COPY requirements.txt /app/requirements.txt
RUN python3 -m pip install --no-cache-dir -r /app/requirements.txt

COPY handler.py preview_triposr.py scan_meshroom.py convert_to_stl.py storage.py /app/

CMD ["python3", "-u", "handler.py"]
