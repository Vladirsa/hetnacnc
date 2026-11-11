# Videos con HyperFrames (muestras y plantillas)

Videos hechos con HyperFrames (HTML + animaciones que se graban a MP4). Cada carpeta es un proyecto:
`index.html` (raíz), `compositions/` (una escena por archivo), `assets/` (voz, fuentes), `SPEC.md` (la
dirección del video).

- `taller-maquina-parada/` — muestra del 11 nov 2026 para talleres (emoción: deseo/esperanza): "¿Máquina
  parada?" → buscan taller → sin comisión → tú eliges → ¡a cortar! → HETNA CNC. 1080×1920, 20.5 s, voz Kokoro
  (em_alex) y subtítulos; sin música (no había fuente local). Plano técnico claro, azul #142033, naranja #C2560A.

Para volver a grabar: `cd taller-maquina-parada && npx hyperframes render --output video.mp4`.
Siguiente paso: que la Fábrica genere estas composiciones desde el guion del agente (plantillas por escena).
