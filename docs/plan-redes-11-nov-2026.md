# Plan del 11 de noviembre de 2026 — mejores publicaciones y más automatización

Objetivo del día: que lo que sale en redes **se vea mejor y rinda más**, y que el dueño
**sólo apruebe desde el celular** lo que no salga solo.

## 0. Arranque (dueño, 20 min)
- [ ] Revisar el despliegue de anoche: en Pendientes, filtro "Sin imagen ni video" debe quedar en 0.
- [ ] Descartar los borradores del plan que sobren (filtro por país: Colombia y EE.UU.).
- [ ] Biblioteca de fondos: "✨ Generar 4 con IA" en cada tema (láser, plasma, router, torno, taller, lámina) y subir 5 a 10 fotos reales de talleres (con permiso).
- [ ] Música: subir 5 pistas con licencia comercial (Pixabay Music) con su liga.
- [ ] Publicar a mano 1 carrusel y 1 reel de prueba en Instagram para confirmar.

## 1. Mejorar las publicaciones (desarrollo)
| # | Qué | Por qué |
|---|---|---|
| 1.1 | **Revisor con IA antes de publicar**: cada borrador pasa por un "editor" que mejora el gancho (primera línea / primer segundo), ajusta largo, hashtags y llamada a la acción por red y mercado; guarda la versión anterior | Hoy el texto sale tal cual lo escribió el agente |
| 1.2 | **Puntaje mínimo**: si el puntaje de algoritmo queda bajo, no se programa y se reescribe solo | Evita publicar piezas débiles |
| 1.3 | **Subtítulos palabra por palabra** en los cortos (con los tiempos de la voz) y más escenas con fotos distintas | Los videos con subtítulos dinámicos retienen más |
| 1.4 | **Dos ganchos por video (A/B)**: se publica uno; si en 24 h rinde poco, el otro sale otro día | Aprender qué gancho funciona |
| 1.5 | **Reels de Facebook** (no video normal) e **Historias de Instagram** con la tarjeta | Más alcance orgánico en Meta |
| 1.6 | **Primer comentario automático** con la liga (Instagram y Facebook) | La liga en comentario no castiga el alcance |

## 2. Más automatización (desarrollo)
| # | Qué | Resultado |
|---|---|---|
| 2.1 | **Aprobar desde Telegram**: cada mañana el bot manda los borradores del día con botones ✅ Publicar / ✏️ Cambiar / 🗑 Descartar | El dueño aprueba desde el celular en 2 minutos |
| 2.2 | **Piloto automático por red**: si el borrador tiene material y puntaje alto, se programa solo (configurable por red y por tipo) | Menos pendientes |
| 2.3 | **Reciclar lo que funcionó**: lo que más interacción tuvo vuelve a salir a los 45 días con otro gancho | Contenido probado sin esfuerzo |
| 2.4 | **Resumen semanal** (lunes, Telegram y correo): qué funcionó, qué se publica esta semana, qué falta | Control sin entrar al panel |
| 2.5 | **YouTube Shorts automático** (n8n con la cuenta de Google de HETNA) | Una red más sin copiar y pegar |
| 2.6 | **Respuestas a comentarios (inicio de 5C)**: la IA propone respuesta a cada comentario de Instagram y Facebook; las preguntas frecuentes se contestan solas | Atención inmediata, más alcance |

## 3. Lo que necesito del dueño mañana
- Permiso de Meta **pages_manage_engagement** (para responder comentarios de Facebook); `instagram_manage_comments` ya está.
- Conectar en n8n la **cuenta de Google/YouTube** de HETNA (credencial OAuth de YouTube).
- Decidir la hora del mensaje diario de aprobación en Telegram (sugerido 8:30, centro de México).
- Cambiar los tokens de Facebook que quedaron en el chat.

## 4. Orden sugerido
1. Arranque (sección 0) y prueba de Instagram.
2. 2.1 Aprobar desde Telegram + 2.2 Piloto automático (lo que más ahorra tiempo).
3. 1.1 Revisor con IA + 1.2 Puntaje mínimo.
4. 1.5 Reels de Facebook e Historias + 1.6 Primer comentario.
5. 1.3 Subtítulos palabra por palabra + 1.4 A/B.
6. 2.3 Reciclar, 2.4 Resumen semanal.
7. 2.5 YouTube y 2.6 Respuestas (si ya están los permisos).
