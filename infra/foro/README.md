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
