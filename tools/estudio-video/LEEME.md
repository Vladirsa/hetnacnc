# 🎬 Estudio de Video HETNA

App local (Windows, Mac o Linux) para crear **videos originales** en español e
inglés. Se abre en tu navegador, pero todo corre en tu computadora.

| Paso | Qué hace |
|---|---|
| 1. Referencia | Transcribe un video (Whisper) para **tomar notas** de los temas. |
| 2. Mi guion | Escribes tu guion. Lo traduces ES ↔ EN. Asistente opcional con IA local (Ollama). |
| 3. Voz | Voz sintética natural (edge-tts) **o** tu propia grabación. Genera subtítulos `.srt`. |
| 4. Armar video | Une **tus** imágenes y clips con la voz, música y subtítulos. Exporta MP4 horizontal, vertical o cuadrado. |

> ⚠️ El video de referencia es solo para inspirarte. Si reutilizas sus imágenes,
> su audio o su guion (aunque lo traduzcas o lo modifiques), YouTube lo puede
> reclamar y el contenido sigue siendo del autor original. Usa tu guion, tus
> clips y tu voz.

---

## Instalación en Windows (una sola vez)

### 1. Python 3.12

Descárgalo de https://www.python.org/downloads/release/python-3128/ y al instalar
marca **"Add python.exe to PATH"**.

### 2. FFmpeg (para armar el video)

En PowerShell:

```bash
winget install Gyan.FFmpeg
```

Cierra y vuelve a abrir PowerShell para que lo reconozca.

### 3. La app

Desde la carpeta `tools\estudio-video`:

```bash
py -3.12 -m venv venv
```

```bash
.\venv\Scripts\Activate.ps1
```

```bash
pip install -r requirements.txt
```

### 4. (Opcional) IA local con Ollama

1. Descarga e instala Ollama desde https://ollama.com/download
2. Descarga un modelo según tu computadora:

| Tu PC | Modelo recomendado | Comando |
|---|---|---|
| 8 GB de RAM, sin tarjeta gráfica | Qwen 2.5 3B | `ollama pull qwen2.5:3b` |
| 16 GB de RAM o tarjeta gráfica con 6 a 8 GB | Qwen 2.5 7B (recomendado) | `ollama pull qwen2.5:7b` |
| 32 GB de RAM o tarjeta gráfica con 12 GB o más | Qwen 2.5 14B | `ollama pull qwen2.5:14b` |

Qwen 2.5 escribe muy bien en español e inglés. Alternativas: `llama3.1:8b`, `gemma2:9b`.

En la app, en **2. Mi guion → Asistente con IA local**, pulsa **Buscar modelos
instalados**.

---

## Uso diario

```bash
.\venv\Scripts\Activate.ps1
```

```bash
python app.py
```

Se abre solo en http://127.0.0.1:7860. Los videos quedan en la carpeta `salida`.

## Consejos para que YouTube te recomiende

- Sube el `.srt` en español y en inglés en YouTube Studio → **Subtítulos**:
  así llegas a los dos públicos con un solo video.
- Para doble audio (ES + EN en el mismo video) usa YouTube Studio →
  **Idiomas → Agregar doblaje** y sube la pista en inglés generada en el paso 3.
- Los primeros 3 segundos deciden si la gente se queda: empieza con el resultado
  o el problema.
- Pon el enlace a hetnacnc.com en la primera línea de la descripción.

## Problemas comunes

| Error | Solución |
|---|---|
| `No encontré ffmpeg` | `winget install Gyan.FFmpeg` y reabre PowerShell. |
| `No pude conectar con Ollama` | Abre la app de Ollama (icono junto al reloj). |
| `El modelo ... no está instalado` | `ollama pull qwen2.5:7b` |
| La transcripción es lenta | Usa precisión `base` o `tiny`. |
| Falla la voz sintética | Requiere internet (edge-tts usa el servicio de voces de Microsoft). |
