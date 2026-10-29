# Sembrar el Foro CNC

Un foro vacío no arranca: nadie pregunta donde no hay nadie. Esto le deja de
qué agarrarse el día que abra, y le da al *Agente de respuestas del foro*
(el workflow de n8n, hoy apagado) algo que contestar.

Por qué estos temas y no otros: [ESTUDIO.md](ESTUDIO.md).

## Las piezas

| Archivo | Qué es |
|---|---|
| `ESTUDIO.md` | Dónde está el hueco de búsqueda y con qué fuentes se concluyó |
| `temas-semilla.json` | El banco de 20 temas. **Esto es lo que se edita** |
| `generar-siembra.mjs` | Convierte el banco en SQL |
| `siembra.sql` | El SQL ya generado, listo para correr |

## Quién firma cada tema

Cada tema trae un `origen`:

- **`oficial`** (7) — los pregunta la cuenta de HETNA. Son preguntas abiertas,
  no artículos: la gracia es que alguien del gremio tenga algo que contestar.
- **`cliente`** (8) — dudas que ya llegan por WhatsApp, el cotizador o las
  solicitudes. Se publican sin el nombre de quien preguntó, y el cuerpo dice
  que la pregunta llegó de fuera, porque es verdad.
- **`fundador`** (5) — **no se publican desde aquí**. Se le proponen a un
  taller fundador para que lo publique con su propia cuenta.

Los dos primeros entran al SQL. Los de fundador salen listados como comentario
al final, para que sepas a quién escribirle.

Ningún tema se publica con un perfil inventado. En el CNC mexicano todos se
conocen, y un nombre falso descubierto cuesta el gremio entero.

## Cómo se corre

**1. Abre el foro.** En el editor SQL de Supabase, sobre la base que apunta
`HETNA_FORO_DB`, corre el esquema:

```
apps/storefront/src/lib/foro/esquema.sql
```

Eso crea el esquema `foro` con sus 11 secciones. Mientras no exista, el sitio
muestra "El foro abre muy pronto".

**2. El perfil que firma.** Es `equipo-hetna`, la cuenta oficial que ya
existe en producción con rol admin. Tiene que ser admin o moderador porque
`foro.crear_tema` corta a los 8 temas al día cuando el rol es `usuario` y aquí
van 15. Para que salga como marca verificada:

```sql
update foro.perfiles set tipo = 'marca', verificado = true
 where usuario = 'equipo-hetna';
```

**3. Siembra.** Corre `siembra.sql` en el mismo editor. Avisa cuántos temas
puso. Es idempotente: correrlo otra vez pone 0 y no duplica nada.

**4. Prende el agente de respuestas.** Ya con temas publicados, el workflow
*HETNA Mantenimiento - Agente de respuestas del foro* tiene de qué agarrarse.
Hoy está apagado. Ya trae el chat de Telegram de @hetnacncadmin (28 de
octubre), así que cada respuesta propuesta te llega ahí para aprobarla antes de
publicarse.

No contesta los temas que firma `equipo-hetna`: esos son la siembra, y están para que
conteste el gremio. Que la misma cuenta pregunte y se responda se ve armado.
Sí contesta lo que publique cualquier otro perfil.

Ese workflow nunca había corrido, y al revisarlo contra este esquema
aparecieron dos fallas que ya quedaron arregladas en n8n el 27 de octubre:

- *Publicar respuesta en el foro* mandaba los tres parámetros de
  `foro.responder` como una cadena separada por comas. n8n la parte en cada
  coma ([issue 16354](https://github.com/n8n-io/n8n/issues/16354)), y una
  respuesta de 150 palabras en español siempre trae comas: la query habría
  recibido ocho o diez parámetros en vez de tres. Ahora se pasa un arreglo.
- Buscaba un perfil distinto al que firma la siembra. Los dos quedaron en
  `equipo-hetna`, la cuenta oficial que ya existe en producción.

## Cambiar o agregar temas

Se edita `temas-semilla.json` y se vuelve a generar. `siembra.sql` no se toca
a mano:

```bash
bun infra/foro/generar-siembra.mjs equipo-hetna > infra/foro/siembra.sql
```

El argumento es el `usuario` del perfil que firma.

## Probarlo antes de tocar producción

Con un postgres cualquiera:

```bash
psql -d unabase -f apps/storefront/src/lib/foro/esquema.sql
psql -d unabase -c "insert into foro.perfiles (cliente_id, usuario, nombre, tipo, rol)
                    values ('cus_x','equipo-hetna','Equipo HETNA','marca','admin')"
psql -d unabase -f infra/foro/siembra.sql
```

Debe decir `Temas sembrados en esta corrida: 15`, y a la segunda, `0`.

## Actualización del 29 de octubre de 2026

**1. Base del foro (Supabase).** Corre una vez `migracion-2026-10-29.sql` en el
editor SQL, sobre la base de `HETNA_FORO_DB`. Agrega los tipos de publicación
"Busco maquinado" y "Ofrezco capacidad" (este último sólo para talleres,
proveedores y marcas). Mientras no se corra, el foro funciona igual; sólo esos
dos tipos responden "todavía no está activo".

**2. Blog del foro.** Los artículos viven en el backend (módulo `learning`).
El deploy corre la migración que les agrega sección, guía fija y autor. Las
tres primeras guías (PDF a DXF, MDF quemado o chueco, cuánto cobrar) se
publican con:

```
cd /root/hetnacnc/packages/api && ./node_modules/.bin/medusa exec ./src/scripts/sembrar-guias-blog.ts
```

No duplica nada si se corre otra vez. Lo demás se escribe en el dashboard,
pantalla **Blog**.

**3. Talleres en el foro.** Un taller liga su perfil del foro en
*Mi perfil → Ligar mi taller*: funciona si el correo de su cuenta de cliente es
el mismo de su taller (o de un miembro de su panel). Con eso sale la insignia
"Taller HETNA" (o "✓ Taller verificado") con liga a su página, y recibe por
correo las preguntas de su especialidad.

## Actualización del 30 de octubre de 2026: red profesional

**Base del foro (Supabase).** Corre una vez `migracion-2026-10-30-red.sql` en
el editor SQL, sobre la base de `HETNA_FORO_DB` (después de la del 29). Se
puede correr más de una vez. Agrega:

- **Seguir** (`foro.seguimientos`): a una persona, a un taller del directorio o
  a una sección. Un perfil ligado a un taller se sigue como el taller, así
  seguir a la persona o al mini-sitio cuenta una sola vez.
- **Currículum** en el perfil: aptitudes, trayectoria (experiencia, estudios,
  certificaciones y proyectos) y "Abierto a trabajo y proyectos".
- **Avales** de aptitudes (`foro.avales`) y **recomendaciones**
  (`foro.recomendaciones`): éstas salen en el perfil hasta que el dueño las
  acepta.
- Tipo de publicación **Vacante** (sólo talleres, proveedores y marcas),
  **postulaciones** (`foro.postulaciones`, sólo las ve quien publicó la
  vacante) y la sección **Empleos y proyectos**.

Mientras no se corra, el foro funciona igual: los botones de la red responden
"La red todavía no está activa".

Páginas: `/foro-cnc/red` (Mi red: novedades de lo que sigues, productos nuevos
de los talleres que sigues, seguidores, siguiendo, sugerencias y pendientes) y
`/foro-cnc/empleos` (vacantes, proyectos esperando precio y profesionales
abiertos a trabajo). En el mini-sitio de cada taller sale el botón
**Seguir taller** y sus publicaciones del foro.

Límites contra abuso, por persona y por día: 300 seguimientos, 100 avales,
5 recomendaciones y 15 postulaciones.

## Actualización del 31 de octubre de 2026: avisos, mensajes, eventos y lo de Quora

**Base del foro (Supabase).** Corre una vez `migracion-2026-10-31-avisos.sql`
(después de la del 30). Se puede correr más de una vez. Agrega:

- **Avisos** (`foro.avisos`): la campana del foro. Se crean al responder un
  tema, elegir la mejor respuesta, seguir a alguien, avalar, recomendar,
  postularse, pedir una respuesta, mandar un mensaje y un día antes de un
  evento al que confirmaste.
- **Mensajes directos** (`foro.conversaciones`, `foro.mensajes`) y
  **bloqueos** (`foro.bloqueos`). Los teléfonos y correos se ocultan igual que
  en el foro. Límites: 200 mensajes al día; 30 conversaciones nuevas al día
  (5 si la cuenta tiene menos de 24 horas).
- **Seguir un tema** (`foro.temas_seguidos`) y **pedir respuesta**
  (`foro.solicitudes`, 20 al día), como en Quora.
- **Eventos**: tipo de publicación con fecha, lugar y "Asistiré"
  (`foro.asistencias`), sección **Eventos y cursos** y datos de evento para
  Google.
- En el perfil: **titular** (sale junto al nombre en cada respuesta) y cómo
  quiere sus correos (al momento, diario o nunca; resumen semanal sí o no).

Páginas nuevas: `/foro-cnc/avisos`, `/foro-cnc/mensajes`,
`/foro-cnc/eventos` y `/foro-cnc/responder` (Preguntas para ti). La barra del
foro trae los números de avisos y mensajes.

**Correos (backend).** Tres trabajos en `packages/api/src/jobs`:

| Trabajo | Cuándo | Qué hace |
|---|---|---|
| `foro-avisos` | cada 10 min | Un correo por persona con sus avisos sin leer (de quien eligió "al momento") |
| `foro-avisos-diario` | 8:07 a.m. (México) | Recordatorio de eventos de mañana + resumen del día (de quien eligió "diario") |
| `foro-resumen-semanal` | lunes 9:13 a.m. | Lo mejor de su red, preguntas que puede responder, vacantes y eventos |

Usan `HETNA_FORO_DB` en el backend (la misma variable que ya usa el tablero
del taller para la actividad del foro) y `RESEND_API_KEY` /
`RESEND_FROM_EMAIL`. Sin alguna de ellas no hacen nada. Respetan la baja de
correos (`hetna_correo_baja`) y cada correo lleva su liga para darse de baja.
