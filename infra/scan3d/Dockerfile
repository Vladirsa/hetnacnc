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
# publican como "Release" en GitHub. Pasa la URL exacta del asset que
# quieras (revisa https://github.com/alicevision/meshroom/releases y copia
# el link del .zip para Linux con soporte CUDA) -- no viene fija aqui a
# proposito porque cambia de version en version y una URL vieja rompe el
# build en silencio.
ARG MESHROOM_BUNDLE_URL
RUN test -n "$MESHROOM_BUNDLE_URL" || (echo "Falta --build-arg MESHROOM_BUNDLE_URL" && exit 1)
RUN wget -O /tmp/meshroom.zip "$MESHROOM_BUNDLE_URL" \
    && unzip -q /tmp/meshroom.zip -d /opt/Meshroom \
    && rm /tmp/meshroom.zip
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
