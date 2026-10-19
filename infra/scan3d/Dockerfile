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

# torchmcubes (dependencia de TripoSR) se compila CONTRA el torch ya
# instalado arriba, y su backend de build (scikit-build-core) necesita ver
# torch mientras compila. pip aisla el entorno de build por defecto y ahi
# torch no existe -- de ahi "the 'torch' package was not found in the build
# environment". Por eso va aparte del resto de requirements.txt, con
# --no-build-isolation y sus dependencias de build puestas a mano.
RUN grep -v torchmcubes /opt/TripoSR/requirements.txt > /tmp/triposr-req.txt \
    && python3 -m pip install --no-cache-dir -r /tmp/triposr-req.txt

# La maquina que construye la imagen no tiene GPU (es un VPS), asi que hay que
# decirle para que arquitecturas compilar en vez de dejar que las detecte:
# 7.5 = T4, 8.0 = A100, 8.6 = A5000/3090, 8.9 = 4090/L4.
ENV TORCH_CUDA_ARCH_LIST="7.5;8.0;8.6;8.9"
ENV FORCE_CUDA=1
# pybind11 instalado con pip no basta: su CMakeLists hace find_package(pybind11)
# y CMake no mira dentro de site-packages por su cuenta. CMAKE_PREFIX_PATH con
# la ruta que reporta el propio paquete es la forma documentada de decírselo.
#
# El commit va FIJO, y es lo importante de este paso: requirements.txt de
# TripoSR pide torchmcubes del HEAD sin fijar nada, y el 10-sep-2026 upstream
# subió su CMakeLists a C++20 ("as required by recent PyTorch headers"). CUDA
# C++20 no existe en nvcc 11.8 -- llegó en CUDA 12 --, así que desde esa fecha
# el build truena en la prueba de FindOpenMP, y no se arregla pasando
# -DCMAKE_CUDA_STANDARD=17 porque su CMakeLists hace un set() que pisa el
# cache. be4084b es el último commit con CUDA/C++17, que es el que corresponde
# a torch 2.1.2.
#
# cmake<4 y pybind11<3 son las versiones mayores contra las que se escribió
# ese commit; sin fijarlas, pip trae las nuevas y vuelve a tronar.
RUN python3 -m pip install --no-cache-dir scikit-build-core "cmake<4" ninja setuptools wheel "pybind11<3" \
    && CMAKE_PREFIX_PATH="$(python3 -m pybind11 --cmakedir)" \
       python3 -m pip install --no-cache-dir --no-build-isolation \
       "git+https://github.com/tatsy/torchmcubes.git@be4084bdc1aac29ffeeb0ed53efaacf5c4b545e0"

COPY infra/scan3d/requirements.txt /app/requirements.txt
RUN python3 -m pip install --no-cache-dir -r /app/requirements.txt

# rembg baja su modelo (u2net, ~176MB) la primera vez que se usa. Si no se
# deja cacheado aquí, cada worker frío de RunPod lo descarga antes de poder
# atender -- y si GitHub no responde, el trabajo falla por algo que no tiene
# que ver con el escaneo.
RUN python3 -c "from rembg import new_session; new_session('u2net')"

COPY infra/scan3d/handler.py infra/scan3d/preview_triposr.py infra/scan3d/scan_meshroom.py infra/scan3d/convert_to_stl.py infra/scan3d/storage.py /app/

CMD ["python3", "-u", "handler.py"]
