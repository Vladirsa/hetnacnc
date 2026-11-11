# Estudio creativo HETNA (agentes) y plan A–E — 11 nov 2026

Decisiones del dueño: **sólo modelos gratis/abiertos** (pago únicamente la GPU de RunPod por uso) y
**biblioteca de referencias** para enseñar el estilo.

## Idea central
Con modelos abiertos la IA escribe mal el texto dentro de la imagen. Por eso se divide el trabajo:
la IA **dibuja la escena y los personajes sin letras** y el **motor de diseño de HETNA** pone títulos,
globos de diálogo, íconos, datos y la marca con tipografía perfecta (como los ejemplos del dueño:
infografía OOE vs OEE, la bomba con "contrato indefinido", el cómic del plan maestro).

## Equipo de agentes (cada uno con su tarea)
| Agente | Qué hace | Herramienta |
|---|---|---|
| Investigador de nicho | Elige el tema y el ángulo con el Radar, las tendencias y lo que mejor ha funcionado (estadísticas) | Claude + búsqueda web |
| Guionista | Escribe el guion por escenas con estructura de marketing: gancho, problema que el cliente reconoce, explicación en 3 pasos, prueba, llamado | Claude + Guía de estilo |
| Director de arte | Escoge la plantilla por escena (infografía, caricatura con globos, cómic, comparación, dato grande, foto real) y escribe el prompt de la ilustración sin texto | Claude |
| Ilustrador | Genera la ilustración en el estilo pedido | RunPod: FLUX / Qwen-Image (abiertos) |
| Diseñador | Compone texto, globos, íconos, datos y marca sobre la ilustración | Motor de diseño (sharp) |
| Voz | Narra el guion | Kokoro en RunPod, Piper de respaldo |
| Editor | Arma el video: cortes, subtítulos palabra por palabra, música, efectos, ritmo | FFmpeg |
| Revisor | Mira los cuadros con visión y los compara contra la guía; si algo falla, lo regresa | Claude con visión |
| Analista | Aprende de las estadísticas y ajusta temas, formatos y horarios | Estadísticas + A/B |
| Agente de anuncios (D) | Crea y vigila campañas propias de Meta Ads dentro del presupuesto que fije el dueño | Meta Ads |

## Fases
1. **Ahora (hecho hoy):** videos nítidos (zoom a doble resolución, calidad alta, audio 192k, fondos IA verticales);
   biblioteca de referencias con análisis por visión y Guía de estilo que leen los agentes; temas nuevos:
   novedades de HETNA (mejoras, calculadora, productos digitales, envíos, facturación y verificación, lo básico
   de talleres/proveedores, tutorial 3-4-5 ejes) y público "Comunidad" con los temas humanos del dueño
   (con cuidado en salud mental: sin diagnósticos y con la Línea de la Vida 800 911 2000).
2. **Principios de video del dueño (ya integrados):** una acción visual por bloque; máximo 4 palabras en pantalla por escena además de subtítulos; ideas convertidas en acciones y analogías dibujadas literal; magnitudes con escala y elementos que se conservan entre escenas; cada acción sincronizada con su palabra y una imagen final clara por escena.
3. **Plantillas de diseño nuevas:** infografía comparativa, caricatura con globos y pregunta, cómic de situación
   con pie de marca, antes/después, dato grande; ilustraciones sin texto en RunPod.
3. **Pipeline de agentes para video:** guionista → director de arte → ilustrador → diseñador → voz → editor →
   revisor; videos que explican con lógica y venden. Clips de movimiento con Wan (abierto) en RunPod.
4. **A — Velocidad del sitio** (Core Web Vitals en celular).
5. **B — Página de producto** con más datos (ficha técnica, envío, garantía, taller, preguntas, datos para Google).
6. **C — Publicidad automática en el sitio** (banners, slides y bloques que rota un agente).
7. **D — Agente de anuncios** propios en Meta Ads (necesita permiso ads_management y un presupuesto tope).
8. **E — Clips con IA** (Wan) dentro del pipeline de video.

## Temas de plataforma para desarrollar (además de contenido)
Mejoras generales; mejorar la calculadora; productos digitales y subir productos fácil; cambiar Skydropx por
Envía; facturación (CFDI) y verificación; necesidades básicas de talleres, proveedores y clientes; tutorial de
3, 4 y 5 ejes (video largo con el Laboratorio CAM).
