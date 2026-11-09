"""
Estudio de Video HETNA
======================
App local para crear videos ORIGINALES (español / inglés) sobre un tema,
usando un video de referencia solo para tomar notas.

Flujo:
  1. Referencia  -> transcribe un video para tomar notas de los temas.
  2. Guion       -> escribes TU guion y lo traduces ES <-> EN.
  3. Voz         -> voz sintética (edge-tts) o tu propia grabación.
  4. Video       -> armas el video con TUS clips/imágenes + subtítulos.

Ejecutar:  python app.py   (abre http://127.0.0.1:7860)
"""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

import gradio as gr

BASE = Path(__file__).resolve().parent
SALIDA = BASE / "salida"
SALIDA.mkdir(exist_ok=True)

VOCES = {
    "Español (México) - Dalia, mujer": "es-MX-DaliaNeural",
    "Español (México) - Jorge, hombre": "es-MX-JorgeNeural",
    "Español (España) - Elvira, mujer": "es-ES-ElviraNeural",
    "Español (España) - Álvaro, hombre": "es-ES-AlvaroNeural",
    "Inglés (EE.UU.) - Jenny, mujer": "en-US-JennyNeural",
    "Inglés (EE.UU.) - Guy, hombre": "en-US-GuyNeural",
    "Inglés (EE.UU.) - Aria, mujer": "en-US-AriaNeural",
    "Inglés (Reino Unido) - Ryan, hombre": "en-GB-RyanNeural",
}

FORMATOS = {
    "Horizontal 16:9 (YouTube)": (1920, 1080),
    "Vertical 9:16 (Shorts / TikTok / Reels)": (1080, 1920),
    "Cuadrado 1:1 (Instagram / Facebook)": (1080, 1080),
}

EXT_IMAGEN = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

_modelo_whisper = None


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------
def _ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise gr.Error(
            "No encontré ffmpeg. Instálalo con:  winget install Gyan.FFmpeg  "
            "y vuelve a abrir la terminal."
        )
    return exe


def _duracion(ruta: str | Path) -> float:
    exe = shutil.which("ffprobe")
    if not exe:
        raise gr.Error("No encontré ffprobe (viene incluido con ffmpeg).")
    out = subprocess.run(
        [exe, "-v", "error", "-show_entries", "format=duration",
         "-of", "json", str(ruta)],
        capture_output=True, text=True, check=True,
    )
    return float(json.loads(out.stdout)["format"]["duration"])


def _correr(cmd: list[str], cwd: Path | None = None) -> None:
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    if res.returncode != 0:
        raise gr.Error("ffmpeg falló:\n" + res.stderr[-1500:])


def _ts(seg: float) -> str:
    ms = int(round(seg * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def _ruta(archivo) -> str | None:
    if archivo is None:
        return None
    return archivo if isinstance(archivo, str) else archivo.name


# --------------------------------------------------------------------------
# 1. Referencia: transcribir para tomar notas
# --------------------------------------------------------------------------
def transcribir(video, modelo: str, idioma: str, progreso=gr.Progress()):
    global _modelo_whisper
    ruta = _ruta(video)
    if not ruta:
        raise gr.Error("Sube un video o audio primero.")
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise gr.Error("Falta instalar faster-whisper: pip install faster-whisper")

    progreso(0.05, desc="Cargando modelo (la primera vez se descarga)...")
    if _modelo_whisper is None or _modelo_whisper[0] != modelo:
        _modelo_whisper = (modelo, WhisperModel(modelo, device="auto",
                                                compute_type="int8"))
    lang = None if idioma == "Detectar" else idioma
    progreso(0.2, desc="Transcribiendo...")
    segmentos, info = _modelo_whisper[1].transcribe(ruta, language=lang,
                                                    vad_filter=True)
    lineas = []
    for s in segmentos:
        lineas.append(f"[{_ts(s.start)[:8]}] {s.text.strip()}")
    texto = "\n".join(lineas)
    return texto, f"Idioma detectado: {info.language}"


def traducir(texto: str, destino: str) -> str:
    if not texto.strip():
        raise gr.Error("No hay texto para traducir.")
    try:
        from deep_translator import GoogleTranslator
    except ImportError:
        raise gr.Error("Falta instalar deep-translator: pip install deep-translator")
    tr = GoogleTranslator(source="auto", target=destino)
    # Google acepta ~5000 caracteres por petición: traducimos por bloques.
    bloques, actual = [], ""
    for linea in texto.splitlines(keepends=True):
        if len(actual) + len(linea) > 4500:
            bloques.append(actual)
            actual = ""
        actual += linea
    if actual:
        bloques.append(actual)
    return "\n".join((tr.translate(b) or "").strip()
                     for b in bloques if b.strip())


# --------------------------------------------------------------------------
# IA local con Ollama (opcional, corre en tu PC)
# --------------------------------------------------------------------------
OLLAMA_URL = "http://127.0.0.1:11434"


def _ollama(prompt: str, modelo: str) -> str:
    import urllib.error
    import urllib.request

    datos = json.dumps({"model": modelo, "prompt": prompt, "stream": False,
                        "options": {"temperature": 0.7}}).encode()
    req = urllib.request.Request(f"{OLLAMA_URL}/api/generate", data=datos,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return json.loads(r.read())["response"].strip()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise gr.Error(f"El modelo '{modelo}' no está instalado. "
                           f"Ejecuta:  ollama pull {modelo}")
        raise gr.Error(f"Ollama respondió con error {e.code}.")
    except urllib.error.URLError:
        raise gr.Error("No pude conectar con Ollama. Instálalo desde "
                       "ollama.com y verifica que esté abierto.")


def modelos_ollama():
    import urllib.request

    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=3) as r:
            nombres = [m["name"] for m in json.loads(r.read())["models"]]
    except Exception:
        nombres = []
    if not nombres:
        gr.Warning("Ollama no está abierto o no tiene modelos. "
                   "Ejecuta:  ollama pull qwen2.5:7b")
        nombres = ["qwen2.5:7b"]
    return gr.update(choices=nombres, value=nombres[0])


def ia_temas(notas: str, modelo: str) -> str:
    if not notas.strip():
        raise gr.Error("Primero transcribe o escribe notas en el paso 1.")
    return _ollama(
        "Lee estas notas y extrae SOLO la lista de temas y datos técnicos que "
        "se tratan, como viñetas cortas en español. No copies frases, no "
        "redactes un guion, solo los temas:\n\n" + notas[:12000], modelo)


def ia_borrador(puntos: str, experiencia: str, duracion: str, modelo: str) -> str:
    if not puntos.strip():
        raise gr.Error("Escribe tus puntos clave primero.")
    return _ollama(
        "Eres guionista de videos para HETNA CNC (tienda en hetnacnc.com de "
        "máquinas y servicios CNC). Escribe un guion ORIGINAL en español, en "
        f"primera persona, para un video de {duracion}. Estructura: gancho de "
        "una frase, problema, explicación paso a paso, consejo práctico y "
        "cierre invitando a visitar hetnacnc.com. Tono cercano y claro. "
        "Devuelve solo el texto que se va a narrar, sin indicaciones de cámara."
        f"\n\nPuntos a cubrir:\n{puntos}\n\n"
        f"Mi experiencia y ejemplos propios para incluir:\n{experiencia or '(ninguno)'}",
        modelo)


def ia_traducir(texto: str, destino: str, modelo: str) -> str:
    if not texto.strip():
        raise gr.Error("No hay texto para traducir.")
    lengua = "inglés" if destino == "en" else "español"
    return _ollama(
        f"Traduce el siguiente guion al {lengua} de forma natural para narrarlo "
        "en voz alta. Conserva términos técnicos de CNC. Devuelve solo la "
        f"traducción:\n\n{texto}", modelo)


# --------------------------------------------------------------------------
# 3. Voz
# --------------------------------------------------------------------------
async def _tts(texto: str, voz: str, velocidad: int, mp3: Path, srt: Path):
    import edge_tts

    rate = f"{velocidad:+d}%"
    com = edge_tts.Communicate(texto, voz, rate=rate)
    sub = edge_tts.SubMaker()
    with open(mp3, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                sub.feed(chunk)
    srt.write_text(sub.get_srt(), encoding="utf-8")


def generar_voz(texto: str, voz_nombre: str, velocidad: int):
    if not texto.strip():
        raise gr.Error("Escribe el guion primero.")
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        raise gr.Error("Falta instalar edge-tts: pip install edge-tts")
    nombre = uuid.uuid4().hex[:8]
    mp3 = SALIDA / f"voz_{nombre}.mp3"
    srt = SALIDA / f"voz_{nombre}.srt"
    asyncio.run(_tts(texto, VOCES[voz_nombre], int(velocidad), mp3, srt))
    return str(mp3), str(srt), str(mp3), str(srt)


def subtitulos_de_grabacion(audio, idioma: str, progreso=gr.Progress()):
    """Para cuando grabas tu propia voz: genera el .srt con Whisper."""
    global _modelo_whisper
    ruta = _ruta(audio)
    if not ruta:
        raise gr.Error("Sube o graba tu audio primero.")
    from faster_whisper import WhisperModel

    progreso(0.1, desc="Cargando modelo...")
    if _modelo_whisper is None:
        _modelo_whisper = ("small", WhisperModel("small", device="auto",
                                                 compute_type="int8"))
    progreso(0.3, desc="Generando subtítulos...")
    segs, _ = _modelo_whisper[1].transcribe(ruta, language=idioma,
                                            vad_filter=True)
    partes = [f"{i}\n{_ts(s.start)} --> {_ts(s.end)}\n{s.text.strip()}\n"
              for i, s in enumerate(segs, 1)]
    srt = SALIDA / f"grabacion_{uuid.uuid4().hex[:8]}.srt"
    srt.write_text("\n".join(partes), encoding="utf-8")
    return ruta, str(srt), str(srt)


# --------------------------------------------------------------------------
# 4. Armar el video
# --------------------------------------------------------------------------
def armar_video(medios, audio, srt, musica, vol_musica: int, formato: str,
                quemar_subs: bool, tam_letra: int, progreso=gr.Progress()):
    ff = _ffmpeg()
    archivos = [_ruta(m) for m in (medios or []) if _ruta(m)]
    ruta_audio = _ruta(audio)
    if not archivos:
        raise gr.Error("Sube al menos una imagen o clip TUYO.")
    if not ruta_audio:
        raise gr.Error("Falta la voz (paso 3).")

    ancho, alto = FORMATOS[formato]
    total = _duracion(ruta_audio)
    por_clip = total / len(archivos)

    trabajo = Path(tempfile.mkdtemp(prefix="estudio_"))
    progreso(0.05, desc="Preparando clips...")

    # 1) Cada imagen/clip -> segmento del mismo tamaño, fps y duración.
    escala = (f"scale={ancho}:{alto}:force_original_aspect_ratio=decrease,"
              f"pad={ancho}:{alto}:(ow-iw)/2:(oh-ih)/2:color=black,"
              f"setsar=1,fps=30,format=yuv420p")
    lista = []
    for i, src in enumerate(archivos):
        seg = trabajo / f"seg_{i:03}.mp4"
        if Path(src).suffix.lower() in EXT_IMAGEN:
            # Imagen con un zoom lento (efecto Ken Burns) para que no se vea estática.
            frames = max(1, int(por_clip * 30))
            vf = (f"scale={ancho*2}:{alto*2}:force_original_aspect_ratio=decrease,"
                  f"pad={ancho*2}:{alto*2}:(ow-iw)/2:(oh-ih)/2:color=black,"
                  f"zoompan=z='min(zoom+0.0008,1.15)':d={frames}"
                  f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={ancho}x{alto}:fps=30,"
                  f"setsar=1,format=yuv420p")
            cmd = [ff, "-y", "-loop", "1", "-i", src, "-t", f"{por_clip:.3f}",
                   "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast",
                   "-crf", "20", str(seg)]
        else:
            cmd = [ff, "-y", "-stream_loop", "-1", "-i", src,
                   "-t", f"{por_clip:.3f}", "-vf", escala, "-an",
                   "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                   str(seg)]
        _correr(cmd)
        lista.append(f"file '{seg.name}'")
        progreso(0.05 + 0.6 * (i + 1) / len(archivos),
                 desc=f"Clip {i + 1} de {len(archivos)}")

    (trabajo / "lista.txt").write_text("\n".join(lista), encoding="utf-8")
    _correr([ff, "-y", "-f", "concat", "-safe", "0", "-i", "lista.txt",
             "-c", "copy", "visual.mp4"], cwd=trabajo)

    # 2) Audio: voz + música opcional (bajita).
    progreso(0.75, desc="Mezclando audio y subtítulos...")
    cmd = [ff, "-y", "-i", "visual.mp4", "-i", ruta_audio]
    filtros = []
    ruta_musica = _ruta(musica)
    if ruta_musica:
        cmd += ["-stream_loop", "-1", "-i", ruta_musica]
        v = max(0, int(vol_musica)) / 100
        filtros.append(f"[2:a]volume={v}[m];[1:a][m]amix=inputs=2:"
                       f"duration=first:dropout_transition=0[a]")
        mapa_audio = "[a]"
    else:
        mapa_audio = "1:a"

    ruta_srt = _ruta(srt)
    if quemar_subs and ruta_srt:
        shutil.copy(ruta_srt, trabajo / "subs.srt")
        estilo = (f"FontName=Arial,FontSize={int(tam_letra)},Bold=1,"
                  "PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,"
                  "BorderStyle=1,Outline=3,Shadow=0,MarginV=60,Alignment=2")
        filtros.append(f"[0:v]subtitles=subs.srt:force_style='{estilo}'[v]")
        mapa_video = "[v]"
    else:
        mapa_video = "0:v"

    if filtros:
        cmd += ["-filter_complex", ";".join(filtros)]
    nombre = f"video_{uuid.uuid4().hex[:8]}.mp4"
    cmd += ["-map", mapa_video, "-map", mapa_audio,
            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k", "-shortest",
            "-movflags", "+faststart", nombre]
    _correr(cmd, cwd=trabajo)

    final = SALIDA / nombre
    shutil.move(str(trabajo / nombre), final)
    shutil.rmtree(trabajo, ignore_errors=True)
    progreso(1, desc="Listo")
    return str(final), str(final)


# --------------------------------------------------------------------------
# Interfaz
# --------------------------------------------------------------------------
AVISO = """
**Usa el video de referencia solo para tomar notas.** Escribe tu propio guion
con tus palabras y usa tus propias imágenes, clips y voz. Si copias o solo
traduces el guion original, el video sigue siendo del autor original.
"""

with gr.Blocks(title="Estudio de Video HETNA") as app:
    gr.Markdown("# 🎬 Estudio de Video HETNA\nCrea videos originales en español e inglés.")

    estado_audio = gr.State()
    estado_srt = gr.State()

    # ---- 1. Referencia ----
    with gr.Tab("1. Referencia (notas)"):
        gr.Markdown(AVISO)
        with gr.Row():
            with gr.Column():
                ref = gr.File(label="Video de referencia",
                              file_types=["video", "audio"])
                with gr.Row():
                    modelo = gr.Dropdown(["tiny", "base", "small", "medium"],
                                         value="small",
                                         label="Precisión (más grande = más lento)")
                    idioma_ref = gr.Dropdown(["Detectar", "es", "en", "pt",
                                              "fr", "ru", "zh", "hi"],
                                             value="Detectar", label="Idioma")
                btn_tr = gr.Button("Transcribir", variant="primary")
                info = gr.Markdown()
            with gr.Column():
                notas = gr.Textbox(label="Transcripción (solo como notas)",
                                   lines=18)
                with gr.Row():
                    gr.Button("Traducir notas a español").click(
                        lambda t: traducir(t, "es"), notas, notas)
                    gr.Button("Traducir notas a inglés").click(
                        lambda t: traducir(t, "en"), notas, notas)
        btn_tr.click(transcribir, [ref, modelo, idioma_ref], [notas, info])

    # ---- 2. Guion ----
    with gr.Tab("2. Mi guion"):
        gr.Markdown(
            "Escribe tu guion con tus palabras. Estructura recomendada:\n"
            "**Gancho** (5 a 10 s) → **Problema** → **Solución / pasos** → "
            "**Llamado a la acción** (ej. *consíguelo en hetnacnc.com*)."
        )
        with gr.Row():
            guion_es = gr.Textbox(label="Guion en español", lines=16,
                                  placeholder="¿Tu router CNC deja marcas en la madera? "
                                              "Hoy te explico 3 causas y cómo arreglarlas...")
            guion_en = gr.Textbox(label="Guion en inglés", lines=16)
        with gr.Row():
            gr.Button("Español → Inglés ➡").click(
                lambda t: traducir(t, "en"), guion_es, guion_en)
            gr.Button("⬅ Inglés → Español").click(
                lambda t: traducir(t, "es"), guion_en, guion_es)
        gr.Markdown("Revisa siempre la traducción automática antes de usarla.")

        with gr.Accordion("🤖 Asistente con IA local (Ollama)", open=False):
            gr.Markdown(
                "Corre en tu PC, gratis y sin internet. Requiere Ollama abierto "
                "y un modelo descargado (ej. `ollama pull qwen2.5:7b`)."
            )
            with gr.Row():
                modelo_ia = gr.Dropdown(["qwen2.5:7b"], value="qwen2.5:7b",
                                        label="Modelo", allow_custom_value=True)
                gr.Button("🔄 Buscar modelos instalados").click(
                    modelos_ollama, None, modelo_ia)
            with gr.Row():
                puntos = gr.Textbox(label="Puntos clave (temas a cubrir)",
                                    lines=8)
                experiencia = gr.Textbox(
                    label="Tu experiencia: ejemplos, tus máquinas, precios, "
                          "errores que has visto, tus productos", lines=8)
            duracion = gr.Radio(["menos de 1 minuto (Short)",
                                 "3 a 5 minutos", "8 a 10 minutos"],
                                value="menos de 1 minuto (Short)",
                                label="Duración")
            with gr.Row():
                gr.Button("1) Sacar temas de mis notas").click(
                    ia_temas, [notas, modelo_ia], puntos)
                gr.Button("2) Redactar borrador del guion", variant="primary").click(
                    ia_borrador, [puntos, experiencia, duracion, modelo_ia],
                    guion_es)
                gr.Button("3) Traducir guion al inglés con IA").click(
                    lambda t, m: ia_traducir(t, "en", m), [guion_es, modelo_ia],
                    guion_en)
            gr.Markdown("El borrador es un punto de partida: edítalo y agrega "
                        "tu estilo antes de grabar.")

    # ---- 3. Voz ----
    with gr.Tab("3. Voz"):
        with gr.Tab("Voz sintética"):
            with gr.Row():
                idioma_guion = gr.Radio(["Español", "Inglés"], value="Español",
                                        label="¿Qué guion leer?")
                voz = gr.Dropdown(list(VOCES), value=list(VOCES)[0], label="Voz")
                vel = gr.Slider(-30, 30, value=0, step=5,
                                label="Velocidad (%)")
            btn_voz = gr.Button("Generar voz y subtítulos", variant="primary")
            audio_out = gr.Audio(label="Voz generada", type="filepath")
            srt_out = gr.File(label="Subtítulos (.srt): súbelos también a YouTube")

            def _voz(idioma, es, en, v, s):
                return generar_voz(es if idioma == "Español" else en, v, s)

            btn_voz.click(_voz, [idioma_guion, guion_es, guion_en, voz, vel],
                          [audio_out, srt_out, estado_audio, estado_srt])

        with gr.Tab("Mi propia voz"):
            gr.Markdown("Graba con el micrófono o sube un audio leyendo tu guion.")
            mi_audio = gr.Audio(label="Tu grabación",
                                sources=["microphone", "upload"],
                                type="filepath")
            idioma_mi = gr.Radio([("Español", "es"), ("Inglés", "en")],
                                 value="es", label="Idioma de la grabación")
            btn_mi = gr.Button("Usar esta grabación y generar subtítulos",
                               variant="primary")
            srt_mi = gr.File(label="Subtítulos generados (.srt)")
            btn_mi.click(subtitulos_de_grabacion, [mi_audio, idioma_mi],
                         [estado_audio, estado_srt, srt_mi])

    # ---- 4. Video ----
    with gr.Tab("4. Armar video"):
        gr.Markdown(
            "Sube **tus** imágenes o clips en orden: grabaciones de tu taller, "
            "capturas de pantalla, fotos de producto o stock con licencia "
            "(Pexels / Pixabay). El tiempo se reparte en partes iguales según "
            "la duración de la voz."
        )
        with gr.Row():
            with gr.Column():
                medios = gr.File(label="Imágenes y clips (en orden)",
                                 file_count="multiple",
                                 file_types=["image", "video"])
                musica = gr.File(label="Música de fondo (opcional, libre de derechos)",
                                 file_types=["audio"])
                vol = gr.Slider(0, 60, value=12, step=1,
                                label="Volumen de la música (%)")
                formato = gr.Dropdown(list(FORMATOS), value=list(FORMATOS)[0],
                                      label="Formato")
                with gr.Row():
                    quemar = gr.Checkbox(value=True,
                                         label="Subtítulos dentro del video")
                    letra = gr.Slider(10, 30, value=16, step=1,
                                      label="Tamaño de letra")
                btn_video = gr.Button("🎬 Crear video", variant="primary")
            with gr.Column():
                video_out = gr.Video(label="Resultado")
                descarga = gr.File(label="Descargar MP4")
        btn_video.click(armar_video,
                        [medios, estado_audio, estado_srt, musica, vol,
                         formato, quemar, letra],
                        [video_out, descarga])

    gr.Markdown(f"Los archivos se guardan en: `{SALIDA}`")


if __name__ == "__main__":
    app.queue().launch(inbrowser=True, theme=gr.themes.Soft())
