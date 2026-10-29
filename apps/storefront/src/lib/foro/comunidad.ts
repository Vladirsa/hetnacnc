// Lecturas de la comunidad (solo servidor): campana de avisos, mensajes
// directos, eventos, "Preguntas para ti" y a quién pedirle una respuesta.
// Sin la migración del 31 de octubre devuelven vacío y las páginas siguen.

import { AUTOR, type Fila, TEMA_CAMPOS, TEMA_DESDE, aAutor, aResumen, fecha } from "./consultas"
import { db, foroConfigurado } from "./db"
import type { Autor, Aviso, TemaResumen } from "./tipos"

// Como intentar() de consultas, pero callado si faltan las tablas nuevas
async function leer<T>(f: () => Promise<T>, vacio: T): Promise<T> {
  if (!foroConfigurado()) return vacio
  try {
    return await f()
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code !== "42P01" && code !== "42703") console.error("[foro comunidad]", (e as Error).message)
    return vacio
  }
}

// Hora de México como texto "2026-11-20T10:00" (las fechas de los eventos se guardan así)
export const ahoraMx = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T")

// ---------------------------------------------------------------------
// Campana
// ---------------------------------------------------------------------

export async function avisosDe(perfilId: string, limite = 60): Promise<Aviso[]> {
  return leer(async () => {
    const { rows } = await db().query(
      `select v.id, v.tipo, v.texto, v.url, v.leido, v.creado, ${AUTOR}
       from foro.avisos v left join foro.perfiles a on a.id = v.actor_id
       where v.perfil_id = $1 order by v.creado desc limit $2`,
      [perfilId, limite]
    )
    return rows.map(
      (f: Fila): Aviso => ({
        id: Number(f.id),
        tipo: f.tipo,
        texto: f.texto,
        url: f.url,
        leido: f.leido,
        creado: fecha(f.creado),
        actor: f.a_id ? aAutor(f) : null,
      })
    )
  }, [])
}

// ---------------------------------------------------------------------
// Mensajes directos
// ---------------------------------------------------------------------

export type ConversacionResumen = { otro: Autor; ultimo: string; texto: string; mio: boolean; sinLeer: boolean }

export async function conversacionesDe(perfilId: string): Promise<ConversacionResumen[]> {
  return leer(async () => {
    const { rows } = await db().query(
      `select c.ultimo, (case when c.a_id = $1 then c.ultimo > c.a_leido else c.ultimo > c.b_leido end) as sin_leer,
         m.texto, m.autor_id = $1 as mio, ${AUTOR}
       from foro.conversaciones c
       join foro.perfiles a on a.id = (case when c.a_id = $1 then c.b_id else c.a_id end)
       left join lateral (select texto, autor_id from foro.mensajes where conversacion_id = c.id order by creado desc limit 1) m on true
       where (c.a_id = $1 or c.b_id = $1) and a.suspendido = false
       order by c.ultimo desc limit 100`,
      [perfilId]
    )
    return rows.map((f: Fila) => ({
      otro: aAutor(f),
      ultimo: fecha(f.ultimo),
      texto: f.texto || "",
      mio: Boolean(f.mio),
      sinLeer: Boolean(f.sin_leer),
    }))
  }, [])
}

export type Mensaje = { id: number; mio: boolean; texto: string; creado: string }
export type Conversacion = {
  otro: Autor
  mensajes: Mensaje[]
  bloqueadoPorMi: boolean
  meBloqueo: boolean
}

// Abre la conversación con alguien (por su usuario) y la marca como leída
export async function conversacionCon(perfilId: string, usuario: string): Promise<Conversacion | null> {
  return leer(async () => {
    const o = await db().query(`select ${AUTOR} from foro.perfiles a where a.usuario = $1 and a.suspendido = false`, [
      usuario.toLowerCase(),
    ])
    if (!o.rows[0]) return null
    const otro = aAutor(o.rows[0])
    const [c, b] = await Promise.all([
      db().query(
        `select id from foro.conversaciones where a_id = least($1::uuid, $2::uuid) and b_id = greatest($1::uuid, $2::uuid)`,
        [perfilId, otro.id]
      ),
      db().query(
        `select exists (select 1 from foro.bloqueos where perfil_id = $1 and bloqueado_id = $2) as yo_bloqueo,
                exists (select 1 from foro.bloqueos where perfil_id = $2 and bloqueado_id = $1) as me_bloqueo`,
        [perfilId, otro.id]
      ),
    ])
    let mensajes: Mensaje[] = []
    const cid = c.rows[0]?.id
    if (cid) {
      const m = await db().query(
        `select * from (select id, autor_id, texto, creado from foro.mensajes where conversacion_id = $1 order by creado desc limit 200) x
         order by creado`,
        [cid]
      )
      mensajes = m.rows.map((f: Fila) => ({ id: Number(f.id), mio: f.autor_id === perfilId, texto: f.texto, creado: fecha(f.creado) }))
      await db().query(
        `update foro.conversaciones set a_leido = case when a_id = $2 then now() else a_leido end,
           b_leido = case when b_id = $2 then now() else b_leido end where id = $1`,
        [cid, perfilId]
      )
      await db().query(`update foro.avisos set leido = true where perfil_id = $1 and actor_id = $2 and tipo = 'mensaje' and not leido`, [
        perfilId,
        otro.id,
      ])
    }
    return { otro, mensajes, bloqueadoPorMi: Boolean(b.rows[0]?.yo_bloqueo), meBloqueo: Boolean(b.rows[0]?.me_bloqueo) }
  }, null)
}

// ---------------------------------------------------------------------
// Seguir un tema y pedir respuesta
// ---------------------------------------------------------------------

export async function sigueTema(temaId: number, perfilId: string): Promise<boolean> {
  return leer(async () => {
    const { rows } = await db().query(`select 1 from foro.temas_seguidos where tema_id = $1 and perfil_id = $2`, [temaId, perfilId])
    return rows.length > 0
  }, false)
}

// A quién conviene pedirle que responda: quienes más contestan en esa sección
// (primero las mejores respuestas), luego los de más puntos. Sin el autor, sin
// uno mismo y marcando a quién ya se le pidió.
export type Candidato = Autor & { respuestas: number; pedido: boolean }

export async function candidatosRespuesta(t: { id: number; seccion: { slug: string }; autor: { id: string } }, perfilId: string, limite = 6): Promise<Candidato[]> {
  return leer(async () => {
    const { rows } = await db().query(
      `with expertos as (
         select r.autor_id, count(*) as n, count(t2.id) as mejores
         from foro.respuestas r join foro.temas t on t.id = r.tema_id join foro.secciones s on s.id = t.seccion_id
         left join foro.temas t2 on t2.mejor_respuesta_id = r.id
         where s.slug = $1 and r.estado = 'publicado' group by r.autor_id)
       select ${AUTOR}, coalesce(e.n, 0) as n_resp,
         exists (select 1 from foro.solicitudes q where q.tema_id = $2 and q.perfil_id = a.id) as pedido
       from foro.perfiles a left join expertos e on e.autor_id = a.id
       where a.suspendido = false and a.id <> $3 and a.id <> $4
         and not exists (select 1 from foro.respuestas r where r.tema_id = $2 and r.autor_id = a.id)
       order by coalesce(e.mejores, 0) desc, coalesce(e.n, 0) desc, (a.vendedor_id is not null) desc, a.reputacion desc
       limit $5`,
      [t.seccion.slug, t.id, t.autor.id, perfilId, limite]
    )
    return rows.map((f: Fila) => ({ ...aAutor(f), respuestas: Number(f.n_resp) || 0, pedido: Boolean(f.pedido) }))
  }, [])
}

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------

export async function eventos(cuando: "proximos" | "pasados", limite = 30): Promise<TemaResumen[]> {
  return leer(async () => {
    const proximos = cuando === "proximos"
    const { rows } = await db().query(
      `select ${TEMA_CAMPOS} ${TEMA_DESDE}
       where t.tipo = 'evento' and t.estado = 'publicado' and a.suspendido = false and t.evento is not null
         and coalesce(nullif(t.evento ->> 'fin', ''), t.evento ->> 'inicio') ${proximos ? ">=" : "<"} $1
       order by t.evento ->> 'inicio' ${proximos ? "asc" : "desc"} limit $2`,
      [ahoraMx(), limite]
    )
    return rows.map(aResumen)
  }, [])
}

export type Asistencia = { n: number; yo: boolean; quienes: Autor[] }

export async function asistencia(temaId: number, verPerfilId?: string | null): Promise<Asistencia> {
  return leer(async () => {
    const { rows } = await db().query(
      `select ${AUTOR}, count(*) over () as total, bool_or(a.id = $2) over () as yo
       from foro.asistencias x join foro.perfiles a on a.id = x.perfil_id
       where x.tema_id = $1 and a.suspendido = false order by x.creado limit 12`,
      [temaId, verPerfilId || "00000000-0000-0000-0000-000000000000"]
    )
    // "yo" sólo es confiable si estoy entre los primeros 12: se pregunta aparte
    let yo = Boolean(rows[0]?.yo)
    if (!yo && verPerfilId) {
      const r = await db().query(`select 1 from foro.asistencias where tema_id = $1 and perfil_id = $2`, [temaId, verPerfilId])
      yo = r.rows.length > 0
    }
    return { n: Number(rows[0]?.total) || 0, yo, quienes: rows.map(aAutor) }
  }, { n: 0, yo: false, quienes: [] })
}

// ---------------------------------------------------------------------
// Preguntas para ti (como "Responder" de Quora)
// ---------------------------------------------------------------------

export type ParaTi = { pedidas: (TemaResumen & { pidio: string })[]; abiertas: TemaResumen[] }

export async function preguntasParaTi(perfilId: string, limite = 20): Promise<ParaTi> {
  return leer(async () => {
    const [pedidas, abiertas] = await Promise.all([
      db()
        .query(
          `select ${TEMA_CAMPOS}, q.creado as q_creado, (select nombre from foro.perfiles where id = q.autor_id) as pidio
           ${TEMA_DESDE} join foro.solicitudes q on q.tema_id = t.id
           where q.perfil_id = $1 and t.estado = 'publicado' and a.suspendido = false
             and not exists (select 1 from foro.respuestas r where r.tema_id = t.id and r.autor_id = $1)
           order by q.creado desc limit 20`,
          [perfilId]
        )
        .catch(() => ({ rows: [] as Fila[] })),
      // Preguntas sin resolver: primero las de las comunidades que sigue,
      // luego las que tienen menos respuestas.
      db().query(
        `select ${TEMA_CAMPOS} ${TEMA_DESDE}
         where t.estado = 'publicado' and a.suspendido = false and t.tipo in ('pregunta', 'busco')
           and t.mejor_respuesta_id is null and t.respuestas < 3 and t.autor_id <> $1
           and t.creado > now() - interval '90 days'
           and not exists (select 1 from foro.respuestas r where r.tema_id = t.id and r.autor_id = $1)
         order by exists (select 1 from foro.seguimientos g where g.seguidor_id = $1 and g.objetivo = 's:' || s.slug) desc,
           t.respuestas asc, t.creado desc
         limit $2`,
        [perfilId, limite]
      ),
    ])
    const vistas = new Set(pedidas.rows.map((f: Fila) => Number(f.id)))
    return {
      pedidas: pedidas.rows.map((f: Fila) => ({ ...aResumen(f), pidio: f.pidio || "" })),
      abiertas: abiertas.rows.filter((f: Fila) => !vistas.has(Number(f.id))).map(aResumen),
    }
  }, { pedidas: [], abiertas: [] })
}
