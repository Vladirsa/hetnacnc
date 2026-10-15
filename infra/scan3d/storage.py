"""Sube el resultado (STL/OBJ/preview) al mismo bucket privado de Backblaze B2
que ya usa el resto de la plataforma (ver packages/api/src/lib/backblaze.ts).
Aqui se usa la API S3-compatible de B2 en vez de la nativa porque boto3 ya
sabe subir binarios grandes por partes -- la lectura/descarga firmada sigue
viviendo en el backend de Medusa (backblaze.ts), este servicio solo escribe.
"""
from __future__ import annotations

import os

import boto3
from botocore.config import Config


def _cliente_b2():
    endpoint = os.environ["B2_S3_ENDPOINT"]  # ej. https://s3.us-west-002.backblazeb2.com
    key_id = os.environ["B2_KEY_ID"]
    app_key = os.environ["B2_APPLICATION_KEY"]
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key_id,
        aws_secret_access_key=app_key,
        config=Config(signature_version="s3v4"),
    )


def subir_archivo(ruta_local: str, storage_key: str) -> str:
    bucket = os.environ["B2_PRIVATE_BUCKET_NAME"]
    cliente = _cliente_b2()
    cliente.upload_file(ruta_local, bucket, storage_key)
    return storage_key
