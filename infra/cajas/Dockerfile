# Servicio de cajas de HETNA sobre Boxes.py (GPL-3.0).
# Boxes.py se instala tal cual desde su repositorio, en una versión fija;
# HETNA sólo agrega api.py (envoltorio HTTP en español). pstoedit y
# ghostscript dan los formatos DXF y PDF.
FROM python:3.12-slim

ARG BOXES_COMMIT=84e392b39191d81db6d381bf1c20a7fc6ae0c8ce
RUN apt-get update && apt-get install -y --no-install-recommends git pstoedit ghostscript \
    && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/florianfesti/boxes.git /opt/boxes \
    && cd /opt/boxes && git checkout -q ${BOXES_COMMIT} \
    && pip install --no-cache-dir . \
    && rm -rf /opt/boxes/.git
COPY api.py /app/api.py
ENV BOXES_SRC=/opt/boxes PUERTO=8012 PYTHONUNBUFFERED=1
EXPOSE 8012
HEALTHCHECK --interval=30s --timeout=5s CMD python3 -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8012/salud')" || exit 1
CMD ["python3", "/app/api.py"]
