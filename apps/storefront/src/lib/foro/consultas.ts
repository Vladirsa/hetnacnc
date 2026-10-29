// Lecturas del foro para las páginas (solo servidor).
// Si la base no está lista, las funciones devuelven null y la página muestra "abre muy pronto".

import { cache } from "react"

import { retrieveCustomer } from "@/lib/data/customer"
import { listarTalleres } from "@/lib/hetna/talleres"

import { extracto, tieneVideo } from "./contenido"
import { db, foroConfigurado } from "./db"
import {
  type Autor,
  type MisVotos,
  type Perfil,
  type Respuesta,
  type Seccion,
  type Tema,
  type TallerLigado,
  type Contadores,
  type Evento,
  type TemaResumen,
  urlFoto,
} from "./tipos"

export type Fila = Record<string, any>

export const fecha = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? ""))

export const AUTOR = `a.id as a_id, a.usuario as a_usuario, a.nombre as a_nombre, a.tipo as a_tipo,
  a.verificado as a_verificado, a.reputacion as a_reputacion, a.foto_url as a_foto, a.vendedor_id as a_vendedor,
  to_jsonb(a) ->> 'titular' as a_titular`
// (titular se lee con to_jsonb: así la consulta no truena en una base que
// todavía no corre la migración del 31 de octubre)

// Talleres del directorio por id de vendedor. El foro vive en otra base, así
// que se cruzan aquí: se cargan una vez cada 5 minutos y cada autor ligado a
// un taller sale con su insignia y la liga a su perfil.
let talleres: { mapa: Map<string, TallerLigado>; hasta: number } = { mapa: new Map(), hasta: 0 }
export async function asegurarTalleres() {
  if (Date.now() < talleres.hasta) return
  try {
    const lista = await listarTalleres()
    talleres = {
      mapa: new Map(lista.map((t) => [t.id, { id: t.id, handle: t.handle, nombre: t.nombre, verificado: t.verificado }])),
      hasta: Date.now() + 5 * 60_000,
    }
  } catch {
    // Sin directorio, el foro funciona igual; sólo no salen las insignias.
    talleres.hasta = Date.now() + 60_000
  }
}
export const tallerDe = (vendedorId: unknown) => (typeof vendedorId === "string" ? talleres.mapa.get(vendedorId) || null : null)

export const aAutor = (f: Fila): Autor => ({
  id: f.a_id,
  usuario: f.a_usuario,
  nombre: f.a_nombre,
  tipo: f.a_tipo,
  verificado: f.a_verificado,
  reputacion: Number(f.a_reputacion) || 0,
  foto: f.a_foto || null,
  taller: tallerDe(f.a_vendedor),
  titular: f.a_titular || "",
})

const aEvento = (v: unknown): Evento | null => {
  if (!v || typeof v !== "object") return null
  const e = v as Record<string, unknown>
  if (typeof e.inicio !== "string") return null
  return {
    inicio: e.inicio,
    fin: typeof e.fin === "string" ? e.fin : "",
    modalidad: e.modalidad === "en_linea" ? "en_linea" : "presencial",
    lugar: typeof e.lugar === "string" ? e.lugar : "",
    liga: typeof e.liga === "string" ? e.liga : "",
  }
}

const ligasDe = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : [])

export const aResumen = (f: Fila): TemaResumen => ({
  id: Number(f.id),
  seccion: { slug: f.s_slug, nombre: f.s_nombre },
  tipo: f.tipo,
  titulo: f.titulo,
  slug: f.slug,
  extracto: extracto(f.cuerpo || ""),
  votos: Number(f.votos) || 0,
  respuestas: Number(f.respuestas) || 0,
  vistas: Number(f.vistas) || 0,
  fijado: f.fijado,
  patrocinado: f.patrocinado,
  resuelto: Boolean(f.resuelto),
  video: tieneVideo(f.cuerpo || "", ligasDe(f.ligas)),
  foto: f.foto ? urlFoto(f.foto) : null,
  estado: f.estado,
  creado: fecha(f.creado),
  ultimaActividad: fecha(f.ultima_actividad),
  evento: aEvento(f.evento),
  autor: aAutor(f),
})

export const TEMA_CAMPOS = `t.id, t.tipo, t.titulo, t.slug, t.cuerpo, t.ligas, t.fotos[1] as foto, t.votos, t.respuestas,
  t.vistas, t.fijado, t.patrocinado, t.mejor_respuesta_id is not null as resuelto, t.estado, t.creado,
  t.ultima_actividad, to_jsonb(t) -> 'evento' as evento, s.slug as s_slug, s.nombre as s_nombre, ${AUTOR}`

export const TEMA_DESDE = `from foro.temas t
  join foro.secciones s on s.id = t.seccion_id
  join foro.perfiles a on a.id = t.autor_id`

export async function intentar<T>(f: () => Promise<T>): Promise<T | null> {
  if (!foroConfigurado()) return null
  try {
    await asegurarTalleres()
    return await f()
  } catch (e) {
    // Tablas o columnas de una migración que aún no se corre: se dice una vez, no en cada página
    const code = (e as { code?: string }).code
    const msg = (e as Error).message
    if ((code === "42P01" || code === "42703") && faltantes.has(msg)) return null
    if (code === "42P01" || code === "42703") faltantes.add(msg)
    console.error("[foro] consulta", msg)
    return null
  }
}
const faltantes = new Set<string>()

// ---------------------------------------------------------------------
// Sesión: cliente de la tienda + su perfil del foro
// ---------------------------------------------------------------------

export type SesionForo = {
  clienteId: string
  nombre: string
  correo: string
  perfil: Perfil | null
  pendientes: Contadores
} | null

export const sesionForo = cache(async (): Promise<SesionForo> => {
  const c = await retrieveCustomer().catch(() => null)
  if (!c || !c.id) return null
  const perfil = await perfilPorCliente(c.id)
  return {
    clienteId: c.id,
    nombre: [c.first_name, c.last_name].filter(Boolean).join(" "),
    correo: c.email || "",
    perfil,
    pendientes: perfil ? await contadores(perfil.id) : { avisos: 0, mensajes: 0 },
  }
})

// Avisos sin leer y conversaciones con mensajes nuevos (para la campana).
// Sin la migración del 31 de octubre las tablas no existen: sale en ceros sin
// llenar el registro de errores en cada página.
async function contadores(perfilId: string): Promise<Contadores> {
  try {
    const { rows } = await db().query(
      `select (select count(*) from foro.avisos where perfil_id = $1 and not leido) as avisos,
        (select count(*) from foro.conversaciones c
          where (c.a_id = $1 and c.ultimo > c.a_leido) or (c.b_id = $1 and c.ultimo > c.b_leido)) as mensajes`,
      [perfilId]
    )
    return { avisos: Number(rows[0]?.avisos) || 0, mensajes: Number(rows[0]?.mensajes) || 0 }
  } catch {
    return { avisos: 0, mensajes: 0 }
  }
}

// ---------------------------------------------------------------------
// Secciones y listas de temas
// ---------------------------------------------------------------------

export const secciones = cache(async (): Promise<Seccion[] | null> =>
  intentar(async () => {
    const { rows } = await db().query(`
      select s.id, s.slug, s.nombre, s.descripcion, s.solo_negocios,
        count(t.id) filter (where t.estado = 'publicado') as temas,
        max(t.ultima_actividad) filter (where t.estado = 'publicado') as ultima
      from foro.secciones s left join foro.temas t on t.seccion_id = s.id
      group by s.id order by s.orden`)
    return rows.map((f) => ({
      id: Number(f.id),
      slug: f.slug,
      nombre: f.nombre,
      descripcion: f.descripcion,
      soloNegocios: f.solo_negocios,
      temas: Number(f.temas) || 0,
      ultima: f.ultima ? fecha(f.ultima) : null,
    }))
  })
)

export type Orden = "recientes" | "populares" | "sin-respuesta" | "nuevos"
export const POR_PAGINA = 20

export async function listaTemas(o: {
  seccion?: string
  orden?: Orden
  pagina?: number
  buscar?: string
  autorId?: string
  vendedorId?: string
  tipo?: string
  limite?: number
}): Promise<{ temas: TemaResumen[]; total: number } | null> {
  return intentar(async () => {
    const donde: string[] = [`t.estado = 'publicado'`, `a.suspendido = false`]
    const args: unknown[] = []
    const arg = (v: unknown) => {
      args.push(v)
      return `$${args.length}`
    }
    if (o.seccion) donde.push(`s.slug = ${arg(o.seccion)}`)
    if (o.autorId) donde.push(`t.autor_id = ${arg(o.autorId)}`)
    if (o.vendedorId) donde.push(`a.vendedor_id = ${arg(o.vendedorId)}`)
    if (o.tipo) donde.push(`t.tipo = ${arg(o.tipo)}`)
    if (o.orden === "sin-respuesta") donde.push(`t.respuestas = 0`)
    const q = (o.buscar || "").trim().slice(0, 120)
    const qArg = q ? arg(q) : ""
    if (q) donde.push(`t.busqueda @@ websearch_to_tsquery('spanish', ${qArg})`)
    const where = donde.join(" and ")

    let orden = "t.ultima_actividad desc"
    if (o.orden === "nuevos") orden = "t.creado desc"
    if (o.orden === "populares")
      orden = `((t.votos * 3 + t.respuestas * 2 + ln(1 + t.vistas)) /
        power(extract(epoch from now() - t.creado) / 3600 + 2, 1.2)) desc`
    if (q && o.orden !== "populares")
      orden = `ts_rank(t.busqueda, websearch_to_tsquery('spanish', ${qArg})) desc, t.ultima_actividad desc`
    const fijados = o.seccion && !q ? "t.fijado desc, " : ""

    const limite = Math.min(50, o.limite || POR_PAGINA)
    const pagina = Math.max(1, Math.floor(o.pagina || 1))
    const [lista, cuenta] = await Promise.all([
      db().query(
        `select ${TEMA_CAMPOS} ${TEMA_DESDE} where ${where} order by ${fijados}${orden}
         limit ${limite} offset ${(pagina - 1) * limite}`,
        args
      ),
      db().query(`select count(*) as n ${TEMA_DESDE} where ${where}`, args),
    ])
    return { temas: lista.rows.map(aResumen), total: Number(cuenta.rows[0]?.n) || 0 }
  })
}

// ---------------------------------------------------------------------
// Un tema con sus respuestas
// ---------------------------------------------------------------------

export async function tema(seccion: string, slug: string, verPerfilId?: string | null): Promise<Tema | null> {
  return intentar(async () => {
    const { rows } = await db().query(
      `select ${TEMA_CAMPOS}, t.fotos, t.encuesta, t.mejor_respuesta_id, t.actualizado, a.suspendido as a_suspendido
       ${TEMA_DESDE} where s.slug = $1 and t.slug = $2`,
      [seccion, slug]
    )
    const f = rows[0]
    if (!f) return null
    const esAutor = verPerfilId && f.a_id === verPerfilId
    if ((f.estado !== "publicado" || f.a_suspendido) && !esAutor) return null
    let resultados: number[] = []
    const encuesta = f.encuesta && Array.isArray(f.encuesta.opciones) ? f.encuesta : null
    if (encuesta) {
      const r = await db().query(
        `select opcion, count(*) as n from foro.encuesta_votos where tema_id = $1 group by opcion`,
        [f.id]
      )
      resultados = encuesta.opciones.map((_: string, i: number) => Number(r.rows.find((x) => x.opcion === i)?.n) || 0)
    }
    return {
      ...aResumen(f),
      cuerpo: f.cuerpo,
      ligas: ligasDe(f.ligas),
      fotos: (f.fotos || []).map(urlFoto),
      encuesta,
      resultados,
      mejorRespuestaId: f.mejor_respuesta_id ? Number(f.mejor_respuesta_id) : null,
      actualizado: fecha(f.actualizado),
    }
  })
}

export async function respuestas(temaId: number, verPerfilId?: string | null): Promise<Respuesta[]> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select r.id, r.padre_id, r.cuerpo, r.fotos, r.votos, r.estado, r.creado, ${AUTOR}
       from foro.respuestas r join foro.perfiles a on a.id = r.autor_id
       where r.tema_id = $1 and ((r.estado = 'publicado' and a.suspendido = false) or r.autor_id = $2)
       order by r.creado limit 500`,
      [temaId, verPerfilId || "00000000-0000-0000-0000-000000000000"]
    )
    return rows.map(
      (f): Respuesta => ({
        id: Number(f.id),
        padreId: f.padre_id ? Number(f.padre_id) : null,
        cuerpo: f.cuerpo,
        fotos: (f.fotos || []).map(urlFoto),
        votos: Number(f.votos) || 0,
        estado: f.estado,
        creado: fecha(f.creado),
        autor: aAutor(f),
      })
    )
  })
  return r || []
}

export async function misVotos(perfilId: string, temaId: number): Promise<MisVotos> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select exists (select 1 from foro.votos where perfil_id = $1 and tema_id = $2) as tema,
        (select coalesce(array_agg(v.respuesta_id), '{}') from foro.votos v
           join foro.respuestas r on r.id = v.respuesta_id
           where v.perfil_id = $1 and r.tema_id = $2) as respuestas,
        (select opcion from foro.encuesta_votos where perfil_id = $1 and tema_id = $2) as encuesta`,
      [perfilId, temaId]
    )
    const f = rows[0]
    return {
      tema: Boolean(f.tema),
      respuestas: (f.respuestas || []).map(Number),
      encuesta: f.encuesta === null || f.encuesta === undefined ? null : Number(f.encuesta),
    }
  })
  return r || { tema: false, respuestas: [], encuesta: null }
}

// Cuenta una visita (no cuenta robots de buscadores)
export async function contarVisita(temaId: number, agente: string) {
  if (/bot|crawl|spider|slurp|facebookexternalhit|preview/i.test(agente)) return
  await intentar(() => db().query(`update foro.temas set vistas = vistas + 1 where id = $1`, [temaId]))
}

// ---------------------------------------------------------------------
// Perfiles
// ---------------------------------------------------------------------

const aPerfil = (f: Fila): Perfil => ({
  id: f.id,
  usuario: f.usuario,
  nombre: f.nombre,
  tipo: f.tipo,
  verificado: f.verificado,
  reputacion: Number(f.reputacion) || 0,
  foto: f.foto_url || null,
  taller: tallerDe(f.vendedor_id),
  titular: f.titular || "",
  bio: f.bio,
  ciudad: f.ciudad,
  estadoMx: f.estado_mx,
  redes: f.redes || {},
  maquinas: f.maquinas || [],
  software: f.software || [],
  rol: f.rol,
  suspendido: f.suspendido,
  vendedor: f.vendedor_id || null,
  // Columnas de la red (migración del 30 de octubre); antes de correrla no existen.
  aptitudes: Array.isArray(f.aptitudes) ? f.aptitudes : [],
  trayectoria: Array.isArray(f.trayectoria) ? f.trayectoria : [],
  abierto: f.abierto === true,
  correoAvisos: f.correo_avisos === "diario" || f.correo_avisos === "nunca" ? f.correo_avisos : "al_momento",
  resumenSemanal: f.resumen_semanal !== false,
  creado: fecha(f.creado),
  temas: Number(f.n_temas) || 0,
  respuestas: Number(f.n_respuestas) || 0,
  mejores: Number(f.n_mejores) || 0,
})

const PERFIL_SQL = `select p.*,
  (select count(*) from foro.temas t where t.autor_id = p.id and t.estado = 'publicado') as n_temas,
  (select count(*) from foro.respuestas r where r.autor_id = p.id and r.estado = 'publicado') as n_respuestas,
  (select count(*) from foro.temas t join foro.respuestas r on r.id = t.mejor_respuesta_id
     where r.autor_id = p.id and t.autor_id <> p.id) as n_mejores
  from foro.perfiles p`

export async function perfilPorCliente(clienteId: string): Promise<Perfil | null> {
  return intentar(async () => {
    const { rows } = await db().query(`${PERFIL_SQL} where p.cliente_id = $1`, [clienteId])
    return rows[0] ? aPerfil(rows[0]) : null
  })
}

export async function perfilPorUsuario(usuario: string): Promise<Perfil | null> {
  return intentar(async () => {
    const { rows } = await db().query(`${PERFIL_SQL} where p.usuario = $1`, [usuario.toLowerCase()])
    return rows[0] ? aPerfil(rows[0]) : null
  })
}

// Los que más ayudan (para la barra lateral)
export async function destacados(limite = 5): Promise<Autor[]> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select ${AUTOR} from foro.perfiles a where a.suspendido = false and a.reputacion > 0
       order by a.reputacion desc limit $1`,
      [limite]
    )
    return rows.map(aAutor)
  })
  return r || []
}

// Los que más ayudaron en los últimos 7 días. Cuenta lo que sirve, no lo que
// se publica: 1 punto por respuesta publicada y 3 más si la eligieron como la
// mejor. Contestarse a uno mismo no cuenta.
export type Ayudador = Autor & { puntos: number; respuestas: number; mejores: number }
export async function rankingSemanal(limite = 5): Promise<Ayudador[]> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select ${AUTOR}, count(r.id) as n_resp,
         count(t2.id) as n_mejores
       from foro.respuestas r
       join foro.temas t on t.id = r.tema_id and t.autor_id <> r.autor_id
       join foro.perfiles a on a.id = r.autor_id
       left join foro.temas t2 on t2.mejor_respuesta_id = r.id
       where r.estado = 'publicado' and r.creado > now() - interval '7 days' and a.suspendido = false
       group by a.id
       order by count(r.id) + 3 * count(t2.id) desc, max(r.creado) desc
       limit $1`,
      [limite]
    )
    return rows.map((f) => ({
      ...aAutor(f),
      respuestas: Number(f.n_resp) || 0,
      mejores: Number(f.n_mejores) || 0,
      puntos: (Number(f.n_resp) || 0) + 3 * (Number(f.n_mejores) || 0),
    }))
  })
  return r || []
}

// Números de actividad para la portada del foro. Sólo lo publicado.
export type Actividad = { temas: number; respuestas: number; resueltos: number; perfiles: number; talleres: number }
export async function actividad(): Promise<Actividad | null> {
  return intentar(async () => {
    const { rows } = await db().query(`select
      (select count(*) from foro.temas where estado = 'publicado') as temas,
      (select count(*) from foro.respuestas where estado = 'publicado') as respuestas,
      (select count(*) from foro.temas where estado = 'publicado' and mejor_respuesta_id is not null) as resueltos,
      (select count(*) from foro.perfiles where suspendido = false) as perfiles,
      (select count(*) from foro.perfiles where suspendido = false and vendedor_id is not null) as talleres`)
    const f = rows[0] || {}
    return {
      temas: Number(f.temas) || 0,
      respuestas: Number(f.respuestas) || 0,
      resueltos: Number(f.resueltos) || 0,
      perfiles: Number(f.perfiles) || 0,
      talleres: Number(f.talleres) || 0,
    }
  })
}

// ---------------------------------------------------------------------
// Fotos y mapa del sitio
// ---------------------------------------------------------------------

export async function foto(id: string): Promise<{ tipo: string; datos: Buffer } | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  return intentar(async () => {
    const { rows } = await db().query(`select tipo, datos from foro.fotos where id = $1`, [id])
    return rows[0] ? { tipo: rows[0].tipo, datos: rows[0].datos } : null
  })
}

export async function temasParaMapa(): Promise<{ url: string; fecha: string }[]> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select s.slug as s, t.slug, t.ultima_actividad ${TEMA_DESDE}
       where t.estado = 'publicado' and a.suspendido = false order by t.ultima_actividad desc limit 20000`
    )
    return rows.map((f) => ({ url: `/foro-cnc/${f.s}/${f.slug}`, fecha: fecha(f.ultima_actividad) }))
  })
  return r || []
}
