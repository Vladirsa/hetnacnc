"""Trabajador de RunPod Serverless para la Fábrica de contenido de HETNA
(Marketing HETNA, Fase B). Un solo endpoint con varias tareas; RunPod prende
la GPU cuando llega un trabajo y la apaga al terminar.

Todo es de código abierto con licencia que permite uso comercial:
  - imagen:      FLUX.1 [schnell] (Apache 2.0) con diffusers
  - voz:         Kokoro-82M (Apache 2.0); español con espeak-ng
  - transcribir: faster-whisper (MIT) con Whisper large-v3-turbo (MIT)
  - video_largo / cortes: FFmpeg + fuente Archivo (OFL)

Los archivos pesados se suben al bucket privado de B2 (storage.py); el backend
de HETNA los descarga con ligas firmadas.

Contrato (event["input"]):
  {"tarea": "imagen", "prompts": [...], "ancho": 1024, "alto": 1536, "pasos": 4, "prefijo": "fabrica/x/"}
      -> {"claves": [...]}
  {"tarea": "voz", "lotes": [{"frases": [...], "clave": "fabrica/x/voz1.wav"}], "voz": "em_alex", "idioma": "es", "velocidad": 1.0}
      -> {"lotes": [{"clave": "...", "duraciones": [s, ...], "total": s}]}
  {"tarea": "transcribir", "media_url": "https://...", "idioma": "es"}
      -> {"idioma": "es", "segmentos": [{"inicio": s, "fin": s, "texto": "..."}]}
  {"tarea": "video_largo", "escenas": [{"imagen_url": "...", "narracion": "..."}], "voz": "em_alex",
   "idioma": "es", "musica_url": null, "clave": "fabrica/x/largo.mp4", "subtitulos": true}
      -> {"clave": "...", "segundos": s}
  {"tarea": "cortes", "video_url": "...", "segmentos": [{"inicio": s, "fin": s, "gancho": "...", "clave": "..."}],
   "subtitulos": [{"inicio": s, "fin": s, "texto": "..."}], "completo": "fabrica/x/subtitulado.mp4"}
      -> {"cortes": [{"clave": "...", "segundos": s}], "completo": "..."}
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import urllib.request
import wave
from pathlib import Path

try:  # en pruebas locales sin RunPod
    import runpod
except ImportError:  # pragma: no cover
    runpod = None

from storage import subir_archivo, subir_bytes

FUENTES = os.environ.get("FUENTES_DIR", "/app/fonts")
# Con un volumen de red, los modelos se descargan una sola vez
if os.path.isdir("/runpod-volume"):
    os.environ.setdefault("HF_HOME", "/runpod-volume/hf")

_flux = None
_kokoro: dict = {}
_whisper = None


# ---------------------------------------------------------------- utilidades
def _bajar(url: str, destino: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "hetna-fabrica/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(destino, "wb") as f:
        shutil.copyfileobj(r, f)
    return destino


def _ffmpeg(args: list[str]) -> None:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"ffmpeg: {p.stderr[-600:]}")


def _duracion(ruta: str) -> float:
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", ruta], capture_output=True, text=True)
    return float(p.stdout.strip() or 0)


def _ts(seg: float) -> str:
    h, r = divmod(max(0.0, seg), 3600)
    m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int((s % 1) * 1000):03d}"


def _srt(segmentos: list[dict], ruta: str, desfase: float = 0.0) -> str:
    lineas = []
    for i, s in enumerate(segmentos, 1):
        lineas.append(f"{i}\n{_ts(s['inicio'] - desfase)} --> {_ts(s['fin'] - desfase)}\n{s['texto'].strip()}\n")
    Path(ruta).write_text("\n".join(lineas), encoding="utf-8")
    return ruta


def _estilo(tam: int) -> str:
    # Letra Archivo Black blanca sobre caja oscura (legible sin sonido)
    return f"FontName=Archivo Black,FontSize={tam},PrimaryColour=&H00FFFFFF,BackColour=&H99000000,BorderStyle=3,Outline=6,Shadow=0,MarginV=60,Alignment=2"


def _subs_filtro(srt: str, tam: int) -> str:
    srt_esc = srt.replace("\\", "/").replace(":", "\\:")
    return f"subtitles='{srt_esc}':fontsdir='{FUENTES}':force_style='{_estilo(tam)}'"


# ---------------------------------------------------------------- imagen (FLUX.1 schnell)
def _pipeline_flux():
    global _flux
    if _flux is None:
        import torch
        from diffusers import FluxPipeline

        _flux = FluxPipeline.from_pretrained("black-forest-labs/FLUX.1-schnell", torch_dtype=torch.bfloat16, token=os.environ.get("HF_TOKEN"))
        # En GPU de 24 GB hace falta descargar partes a la RAM; en 48 GB+ va completo
        try:
            import torch as _t

            if _t.cuda.get_device_properties(0).total_memory > 40 * 1024**3:
                _flux.to("cuda")
            else:
                _flux.enable_model_cpu_offload()
        except Exception:
            _flux.enable_model_cpu_offload()
    return _flux


def tarea_imagen(e: dict) -> dict:
    import io

    import torch

    pipe = _pipeline_flux()
    ancho = int(e.get("ancho", 1024)) // 16 * 16
    alto = int(e.get("alto", 1536)) // 16 * 16
    pasos = int(e.get("pasos", 4))
    prefijo = e.get("prefijo", "fabrica/ia/")
    claves = []
    for i, prompt in enumerate(e.get("prompts", [])[:16]):
        g = torch.Generator("cpu").manual_seed(int(e.get("semilla", 1234)) + i)
        img = pipe(prompt, guidance_scale=0.0, num_inference_steps=pasos, max_sequence_length=256, height=alto, width=ancho, generator=g).images[0]
        b = io.BytesIO()
        img.save(b, format="JPEG", quality=90)
        claves.append(subir_bytes(b.getvalue(), f"{prefijo}img-{i:02d}.jpg", "image/jpeg"))
    return {"claves": claves}


# ---------------------------------------------------------------- voz (Kokoro)
VOCES_POR_IDIOMA = {"es": "e", "en": "a", "pt": "p"}


def _sintetizar(texto: str, voz: str, idioma: str, velocidad: float, ruta: str) -> float:
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline

    codigo = VOCES_POR_IDIOMA.get(idioma, "e")
    if codigo not in _kokoro:
        _kokoro[codigo] = KPipeline(lang_code=codigo)
    partes = [audio for _, _, audio in _kokoro[codigo](texto, voice=voz, speed=velocidad)]
    audio = np.concatenate([np.asarray(p, dtype="float32") for p in partes]) if partes else np.zeros(2400, dtype="float32")
    sf.write(ruta, audio, 24000)
    return len(audio) / 24000.0


def _unir_wav(rutas: list[str], pausa: float, salida: str) -> None:
    with wave.open(rutas[0]) as w0:
        params = w0.getparams()
    silencio = b"\x00\x00" * int(params.framerate * pausa) * params.nchannels
    with wave.open(salida, "wb") as out:
        out.setparams(params)
        for i, r in enumerate(rutas):
            with wave.open(r) as w:
                out.writeframes(w.readframes(w.getnframes()))
            if i < len(rutas) - 1:
                out.writeframes(silencio)


def tarea_voz(e: dict) -> dict:
    voz = e.get("voz", "em_alex")
    idioma = e.get("idioma", "es")
    vel = float(e.get("velocidad", 1.0))
    pausa = float(e.get("pausa", 0.25))
    res = []
    with tempfile.TemporaryDirectory() as d:
        for n, lote in enumerate(e.get("lotes", [])):
            rutas, dur = [], []
            for i, frase in enumerate(lote.get("frases", [])):
                r = os.path.join(d, f"l{n}-{i}.wav")
                dur.append(round(_sintetizar(frase, voz, idioma, vel, r) + (pausa if i < len(lote["frases"]) - 1 else 0), 3))
                rutas.append(r)
            if not rutas:
                continue
            salida = os.path.join(d, f"l{n}.wav")
            _unir_wav(rutas, pausa, salida)
            res.append({"clave": subir_archivo(salida, lote["clave"]), "duraciones": dur, "total": round(sum(dur), 3)})
    return {"lotes": res}


# ---------------------------------------------------------------- transcribir (Whisper)
def tarea_transcribir(e: dict) -> dict:
    global _whisper
    from faster_whisper import WhisperModel

    if _whisper is None:
        _whisper = WhisperModel(os.environ.get("WHISPER_MODELO", "large-v3-turbo"), device="cuda", compute_type="float16")
    with tempfile.TemporaryDirectory() as d:
        media = _bajar(e["media_url"], os.path.join(d, "media"))
        segs, info = _whisper.transcribe(media, language=e.get("idioma") or None, vad_filter=True)
        salida = [{"inicio": round(s.start, 2), "fin": round(s.end, 2), "texto": s.text.strip()} for s in segs]
    return {"idioma": info.language, "segmentos": salida}


# ---------------------------------------------------------------- video largo
def armar_largo(imagenes: list[str], audios: list[str], duraciones: list[float], musica: str | None, srt: str | None, salida: str, d: str) -> float:
    """Une escenas 16:9 (imagen + su voz) con zoom lento, música bajo la voz y subtítulos."""
    clips = []
    for i, (img, aud, dur) in enumerate(zip(imagenes, audios, duraciones)):
        clip = os.path.join(d, f"c{i}.mp4")
        frames = int((dur + 0.6) * 30)
        _ffmpeg([
            "-loop", "1", "-i", img, "-i", aud,
            "-filter_complex", f"[0:v]scale=2112:1188,zoompan=z='min(zoom+0.0005,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps=30,format=yuv420p[v];[1:a]apad=pad_dur=0.6[a]",
            "-map", "[v]", "-map", "[a]", "-t", f"{dur + 0.6:.2f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "aac", "-ar", "44100", clip,
        ])
        clips.append(clip)
    lista = os.path.join(d, "lista.txt")
    Path(lista).write_text("".join(f"file '{c}'\n" for c in clips))
    unido = os.path.join(d, "unido.mp4")
    _ffmpeg(["-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", unido])
    total = _duracion(unido)
    filtros_v = _subs_filtro(srt, 18) if srt else "null"
    if musica:
        _ffmpeg([
            "-i", unido, "-stream_loop", "-1", "-i", musica,
            "-filter_complex", f"[0:v]{filtros_v}[v];[1:a]volume=0.16,afade=t=out:st={max(0, total - 3):.2f}:d=3[m];[m][0:a]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[mb];[mb][0:a]amix=inputs=2:duration=first[a]",
            "-map", "[v]", "-map", "[a]", "-t", f"{total:.2f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", salida,
        ])
    else:
        _ffmpeg(["-i", unido, "-vf", filtros_v, "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-c:a", "copy", "-movflags", "+faststart", salida])
    return total


def tarea_video_largo(e: dict) -> dict:
    voz, idioma = e.get("voz", "em_alex"), e.get("idioma", "es")
    with tempfile.TemporaryDirectory() as d:
        imagenes, audios, durs, subs = [], [], [], []
        t = 0.0
        for i, esc in enumerate(e["escenas"]):
            img = _bajar(esc["imagen_url"], os.path.join(d, f"i{i}.img"))
            aud = os.path.join(d, f"a{i}.wav")
            dur = _sintetizar(esc["narracion"], voz, idioma, float(e.get("velocidad", 1.0)), aud)
            imagenes.append(img)
            audios.append(aud)
            durs.append(dur)
            # Subtítulos por oraciones, repartidos en la duración de la escena
            oraciones = [o.strip() for o in esc["narracion"].replace("?", "?.").replace("!", "!.").split(".") if o.strip()]
            total_chars = sum(len(o) for o in oraciones) or 1
            cursor = t
            for o in oraciones:
                largo = dur * len(o) / total_chars
                subs.append({"inicio": cursor, "fin": cursor + largo, "texto": o})
                cursor += largo
            t += dur + 0.6
        musica = _bajar(e["musica_url"], os.path.join(d, "musica")) if e.get("musica_url") else None
        srt = _srt(subs, os.path.join(d, "subs.srt")) if e.get("subtitulos", True) else None
        salida = os.path.join(d, "largo.mp4")
        total = armar_largo(imagenes, audios, durs, musica, srt, salida, d)
        return {"clave": subir_archivo(salida, e["clave"]), "segundos": round(total, 1)}


# ---------------------------------------------------------------- cortes de un video grabado
def tarea_cortes(e: dict) -> dict:
    subs = e.get("subtitulos") or []
    res = {"cortes": []}
    with tempfile.TemporaryDirectory() as d:
        video = _bajar(e["video_url"], os.path.join(d, "original"))
        for i, s in enumerate(e.get("segmentos", [])[:8]):
            ini, fin = float(s["inicio"]), float(s["fin"])
            dentro = [x for x in subs if x["fin"] > ini and x["inicio"] < fin]
            srt = _srt([{**x, "inicio": max(x["inicio"], ini), "fin": min(x["fin"], fin)} for x in dentro], os.path.join(d, f"s{i}.srt"), desfase=ini)
            gancho = (s.get("gancho") or "").replace("'", "’").replace(":", "\\:")
            vf = "scale=-2:1920,crop=1080:1920," + _subs_filtro(srt, 14)
            if gancho:
                vf += f",drawtext=fontfile='{FUENTES}/Archivo-900.ttf':text='{gancho}':fontcolor=white:fontsize=78:box=1:boxcolor=black@0.55:boxborderw=24:x=(w-text_w)/2:y=h*0.14:enable='lt(t,2.5)'"
            salida = os.path.join(d, f"corte{i}.mp4")
            _ffmpeg(["-ss", f"{ini:.2f}", "-to", f"{fin:.2f}", "-i", video, "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", salida])
            res["cortes"].append({"clave": subir_archivo(salida, s["clave"]), "segundos": round(fin - ini, 1)})
        if e.get("completo"):
            srt = _srt(subs, os.path.join(d, "todo.srt"))
            salida = os.path.join(d, "completo.mp4")
            _ffmpeg(["-i", video, "-vf", _subs_filtro(srt, 16), "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "copy", "-movflags", "+faststart", salida])
            res["completo"] = subir_archivo(salida, e["completo"])
    return res


TAREAS = {"imagen": tarea_imagen, "voz": tarea_voz, "transcribir": tarea_transcribir, "video_largo": tarea_video_largo, "cortes": tarea_cortes}


def handler(event: dict) -> dict:
    e = event.get("input") or {}
    tarea = TAREAS.get(e.get("tarea"))
    if not tarea:
        return {"error": f"Tarea desconocida: {e.get('tarea')}"}
    try:
        return tarea(e)
    except Exception as err:  # RunPod marca el trabajo como fallido con este mensaje
        return {"error": f"{type(err).__name__}: {err}"[:1500]}


if __name__ == "__main__" and runpod:
    runpod.serverless.start({"handler": handler})
