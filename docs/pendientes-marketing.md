# Pendientes y agencia de marketing interna de HETNA

Lista viva de ideas pendientes del dueño. La agencia es **de uso interno** (sólo las cuentas de HETNA); no se ofrece a terceros.

## Agencia de marketing interna (hoja de ruta)

| Etapa | Qué incluye | Estado |
|---|---|---|
| 5A | Social Hub: publicaciones automáticas y manuales, calendario, textos por red con IA, ligas medidas y resultados (Facebook y Telegram vía n8n) | ✅ Hecho (9 nov 2026) |
| Talleres promotores | Kit de difusión en el panel del taller ("Promociona tu taller": insignias con QR en cuadrado y vertical, textos listos, resultados de su liga medida) y videos de trabajos con autorización (texto versionado, fecha e IP; cláusula en términos de vendedores); revisión en Admin → Social Hub → Videos de talleres y publicación con crédito vía n8n (Telegram y Facebook con video) | ✅ Hecho (9 nov 2026) |
| Estrategia | Admin → Social Hub → Estrategia: guía por red (qué premia cada algoritmo, formatos, liga, hashtags, frecuencia y horas editables), públicos con temas editables, mercados (México, EE.UU., Colombia, Chile, Perú, Argentina, Brasil) con reparto, zona horaria e idioma; plan semanal automático cada domingo con borradores del agente (IA con datos reales o plantilla; guion de video en notas); puntaje de algoritmo en cada texto con consejos; TikTok y YouTube agregados como redes (a mano por ahora) | ✅ Hecho (9 nov 2026) |
| Fábrica (Fase A) | Admin → Social Hub → Fábrica: guion o tema → 5 cortos 9:16 con música (FFmpeg), carrusel, publicación por red con tarjeta, título/descripción/capítulos/guion y miniatura de YouTube, y artículo borrador en Aprendizaje CNC; todo como borradores repartidos en la semana. Biblioteca de fondos por tema y música con licencia. Tarjetas automáticas para licitaciones, talleres, productos y foro; piezas semanales (taller destacado, opinión de cliente, índice de precios del mes). Fuente Archivo (OFL) incluida; FFmpeg se instala en el despliegue | ✅ Hecho (9 nov 2026) |
| Fábrica (Fase B) | RunPod: imágenes FLUX.1 schnell para fondos y miniaturas, Whisper para videos grabados, video largo, voz (Kokoro/Piper) y clips Wan | Siguiente |
| 5B | Videos (subir al Social Hub lo del Estudio de Video), imágenes con IA, Instagram, LinkedIn, Discord, Pinterest; YouTube y TikTok (manual o servicio aprobado) | Siguiente; faltan 3 respuestas del dueño |
| 5C | Respuestas automáticas a comentarios y mensajes (Facebook, Instagram, WhatsApp, Telegram) con IA: aprobación o automáticas en preguntas comunes | Pendiente |
| 5D | Publicidad pagada (Meta Ads) desde el panel | Pendiente |

Relacionado: el **Estudio de Video** se está haciendo en otra rama (`claude/cool-wozniak-d73qms`, `tools/estudio-video`): app local que crea videos originales ES/EN. El Social Hub los publica y mide.

## Ideas nuevas (9 nov 2026)

### 8. Página de producto con más datos
La página de producto no le gusta al dueño: hay que poner más información. Propuesta para revisar con él antes de hacerla:
- Ficha técnica en tabla: material, medidas, espesor, tolerancia, acabado, peso, formato de archivo (diseños), máquinas compatibles.
- Qué incluye, tiempos de entrega y envío calculado, devoluciones y garantía.
- Datos del taller o vendedor (verificado, calificación, ubicación) y botón de cotizar a la medida.
- Preguntas frecuentes del producto, reseñas con foto (ya existen) y productos relacionados.
- Datos estructurados para Google (precio, disponibilidad, reseñas).

### 9. Publicidad automática en todas las páginas, slides y bloques
Un agente que llene y rote solo los espacios de publicidad del sitio (banners, slides del inicio y bloques) usando el módulo "Publicidad" que ya existe: elige qué promover (productos que más venden, talleres, licitaciones, cursos), genera la pieza con IA, la programa, mide vistas y clics y cambia lo que no funciona.

### 13. Agente que controle y mejore las campañas de Ads
Parte de la etapa 5D. Revisa a diario las campañas de Meta Ads (y Google Ads después): gasto, costo por resultado, frecuencia y anuncios agotados; propone o aplica cambios (pausar lo que quema dinero, subir presupuesto a lo que funciona, probar textos e imágenes nuevos) dentro de límites de gasto que fije el dueño, y le manda un resumen.

### 14. Generador de contenido para redes con RunPod
Un programa que corre en GPU de RunPod con modelos abiertos para generar imágenes y videos de promoción de las páginas de HETNA (más barato por pieza que los servicios de pago por imagen) y entregarlos al Social Hub. Revisar junto con la etapa 5B (imágenes y videos) y con el Estudio de Video.

### Radar HETNA (agente que busca en la web oportunidades CNC) — ✅ hecho el 9 nov 2026 (Admin → Social Hub → Radar; búsqueda web de Claude, tope diario RADAR_BUSQUEDAS_DIA=6, firma de mensajes RADAR_FIRMA)
Hoy existen en n8n, **apagados**: "Prospección - Talleres y proveedores" (Google Maps por ciudad y giro), "Buscador de Proyectos - Alertas Upwork" (lee alertas por correo), "Detective de Capacidad Instalada - LinkedIn" (lee alertas por correo) y "SEO Agent - Aprendizaje CNC" (artículos diarios). Ninguno es un radar general. Propuesta: una pestaña **Radar** en Marketing HETNA que cada día busque (1) gente pidiendo piezas o servicios CNC, licitaciones públicas de maquinado (México y EE.UU.) y plantas nuevas por nearshoring que necesitarán proveedores; (2) talleres y proveedores por ciudad y país para invitarlos (también para la expansión a LATAM); (3) temas y tendencias CNC para contenido; (4) movimientos de la competencia; (5) ferias y eventos; (6) menciones de HETNA y si las IA la recomiendan. Clasifica cada hallazgo con IA, propone la acción y con un clic lo convierte en publicación, invitación o prospecto. Sólo información pública, sin raspar sitios que lo prohíben y sin spam (una invitación personalizada con opción de baja).

Ideas de la investigación para hacer viral a HETNA (A a O): ver `docs/investigacion-marketing-viral.md`.

## Pendientes anteriores (en manos del dueño)

- Vitrina de imagen a 3D.
- Google Merchant Center (cuando haya productos físicos).
- Pruebas del sitio (las está haciendo el dueño).
- Reunión con abogado y contador (revisar el contrato SafeDeal, términos y aviso de privacidad).
- Estudio de Publicidad (#7): ahora forma parte de la agencia interna (5B a 5D).
- Cursos con Bunny (después de las primeras ventas).
- Campaña para atraer talleres.
