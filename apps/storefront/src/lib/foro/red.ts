// Lecturas de la red profesional del foro (solo servidor): a quién sigue cada
// quien, el feed de "Mi red", avales, recomendaciones, postulaciones y
// sugerencias. Igual que el resto del foro: si la base no está lista (o falta
// la migración del 30 de octubre), devuelven null o vacío y la página sigue.

import { listOffers } from "@/lib/data/offers"
import { type Taller, listarTalleres } from "@/lib/hetna/talleres"

import { AUTOR, type Fila, TEMA_CAMPOS, TEMA_DESDE, aAutor, aResumen, fecha, intentar } from "./consultas"
import { db } from "./db"
import {
  type Autor,
  type Aval,
  type Perfil,
  type Postulacion,
  type Recomendacion,
  type TemaResumen,
} from "./tipos"

const NINGUNO = "00000000-0000-0000-0000-000000000000"

// Las dos formas de seguir a alguien ligado a un taller cuentan igual: p:<id> y t:<vendedor>.
export const objetivosDe = (p: Pick<Perfil, "id" | "vendedor">) =>
  p.vendedor ? [`p:${p.id}`, `t:${p.vendedor}`] : [`p:${p.id}`]

// ---------------------------------------------------------------------
// Seguir
// ---------------------------------------------------------------------

// Un taller se cuenta junto con los perfiles del foro ligados a él
export async function objetivosDeTaller(vendedorId: string): Promise<string[]> {
  const r = await intentar(async () => {
    const { rows } = await db().query(`select id from foro.perfiles where vendedor_id = $1`, [vendedorId])
    return rows.map((f) => `p:${f.id}`)
  })
  return [`t:${vendedorId}`, ...(r || [])]
}

export type EstadoRed = { seguidores: number; siguiendo: boolean }

export async function estadoRed(objetivos: string[], verPerfilId?: string | null): Promise<EstadoRed> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select count(distinct seguidor_id) as n, coalesce(bool_or(seguidor_id = $2), false) as yo
       from foro.seguimientos where objetivo = any($1)`,
      [objetivos, verPerfilId || NINGUNO]
    )
    return { seguidores: Number(rows[0]?.n) || 0, siguiendo: Boolean(rows[0]?.yo) }
  })
  return r || { seguidores: 0, siguiendo: false }
}

// Seguidores y siguiendo de un perfil, para su encabezado
export async function cuentasRed(p: Pick<Perfil, "id" | "vendedor">): Promise<{ seguidores: number; siguiendo: number }> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select (select count(distinct seguidor_id) from foro.seguimientos where objetivo = any($1)) as seguidores,
              (select count(*) from foro.seguimientos where seguidor_id = $2) as siguiendo`,
      [objetivosDe(p), p.id]
    )
    return { seguidores: Number(rows[0]?.seguidores) || 0, siguiendo: Number(rows[0]?.siguiendo) || 0 }
  })
  return r || { seguidores: 0, siguiendo: 0 }
}

export async function seguidoresDe(objetivos: string[], limite = 60): Promise<Autor[]> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select distinct on (a.id) ${AUTOR}, g.creado as g_creado
       from foro.seguimientos g join foro.perfiles a on a.id = g.seguidor_id
       where g.objetivo = any($1) and a.suspendido = false
       order by a.id, g.creado desc limit $2`,
      [objetivos, limite]
    )
    return rows.sort((x, y) => +new Date(y.g_creado) - +new Date(x.g_creado)).map(aAutor)
  })
  return r || []
}

export type Siguiendo = {
  personas: Autor[]
  talleres: Taller[]
  secciones: { slug: string; nombre: string }[]
}

export async function siguiendoDe(perfilId: string): Promise<Siguiendo> {
  const r = await intentar(async () => {
    const [personas, otros] = await Promise.all([
      db().query(
        `select ${AUTOR} from foro.seguimientos g
         join foro.perfiles a on 'p:' || a.id::text = g.objetivo
         where g.seguidor_id = $1 and a.suspendido = false order by g.creado desc limit 200`,
        [perfilId]
      ),
      db().query(
        `select g.objetivo, s.nombre from foro.seguimientos g
         left join foro.secciones s on 's:' || s.slug = g.objetivo
         where g.seguidor_id = $1 and g.objetivo !~ '^p:' order by g.creado desc limit 200`,
        [perfilId]
      ),
    ])
    const idsTalleres = otros.rows.filter((f) => f.objetivo.startsWith("t:")).map((f) => f.objetivo.slice(2))
    const directorio = idsTalleres.length ? await listarTalleres() : []
    return {
      personas: personas.rows.map(aAutor),
      talleres: idsTalleres.map((id) => directorio.find((t) => t.id === id)).filter((t): t is Taller => Boolean(t)),
      secciones: otros.rows
        .filter((f) => f.objetivo.startsWith("s:") && f.nombre)
        .map((f) => ({ slug: f.objetivo.slice(2), nombre: f.nombre })),
    }
  })
  return r || { personas: [], talleres: [], secciones: [] }
}

// Lo que sigue cada quien, en crudo (para marcar los botones de las sugerencias)
export async function objetivosSeguidos(perfilId: string): Promise<Set<string>> {
  const r = await intentar(async () => {
    const { rows } = await db().query(`select objetivo from foro.seguimientos where seguidor_id = $1`, [perfilId])
    return new Set<string>(rows.map((f: Fila) => f.objetivo as string))
  })
  return r || new Set()
}

// ---------------------------------------------------------------------
// Feed de "Mi red": lo nuevo de las personas, talleres y secciones que sigue,
// y lo que publica la misma persona (como en LinkedIn, lo tuyo sale en tu red)
// ---------------------------------------------------------------------

export const POR_PAGINA_RED = 15

export async function feedRed(perfilId: string, pagina = 1): Promise<{ temas: TemaResumen[]; total: number } | null> {
  return intentar(async () => {
    const donde = `t.estado = 'publicado' and a.suspendido = false and (
        t.autor_id = $1
        or t.autor_id in (select substr(objetivo, 3)::uuid from foro.seguimientos where seguidor_id = $1 and objetivo like 'p:%')
        or a.vendedor_id in (select substr(objetivo, 3) from foro.seguimientos where seguidor_id = $1 and objetivo like 't:%')
        or s.slug in (select substr(objetivo, 3) from foro.seguimientos where seguidor_id = $1 and objetivo like 's:%'))`
    const p = Math.max(1, Math.floor(pagina))
    const [lista, cuenta] = await Promise.all([
      db().query(
        `select ${TEMA_CAMPOS} ${TEMA_DESDE} where ${donde} order by t.creado desc
         limit ${POR_PAGINA_RED} offset ${(p - 1) * POR_PAGINA_RED}`,
        [perfilId]
      ),
      db().query(`select count(*) as n ${TEMA_DESDE} where ${donde}`, [perfilId]),
    ])
    return { temas: lista.rows.map(aResumen), total: Number(cuenta.rows[0]?.n) || 0 }
  })
}

// Productos recién publicados por los talleres que sigue (de la tienda).
export type ProductoRed = {
  id: string
  titulo: string
  handle: string
  foto: string | null
  precio: number | null
  creado: string
  taller: { nombre: string; handle: string }
}

export async function productosDeTalleres(talleres: Taller[], limite = 8): Promise<ProductoRed[]> {
  if (!talleres.length) return []
  const listas = await Promise.all(
    talleres.slice(0, 12).map(async (t) => {
      const { offers } = await listOffers({ sellerId: t.id, countryCode: "mx", limit: 6 })
      return offers.map((o): ProductoRed | null => {
        const prod = (o as unknown as { product?: { id: string; title: string; handle: string; thumbnail?: string | null } }).product
        if (!prod?.handle) return null
        const precio = (o as unknown as { calculated_price?: { calculated_amount?: number | null } }).calculated_price?.calculated_amount
        return {
          id: o.id,
          titulo: prod.title,
          handle: prod.handle,
          foto: prod.thumbnail ? decodeURIComponent(prod.thumbnail) : null,
          precio: typeof precio === "number" ? precio : null,
          creado: fecha(o.created_at),
          taller: { nombre: t.nombre, handle: t.handle },
        }
      })
    })
  )
  // Un producto se vende con varias ofertas: se queda la más nueva de cada uno.
  const vistos = new Set<string>()
  return listas
    .flat()
    .filter((x): x is ProductoRed => Boolean(x))
    .sort((a, b) => +new Date(b.creado) - +new Date(a.creado))
    .filter((x) => (vistos.has(x.handle) ? false : (vistos.add(x.handle), true)))
    .slice(0, limite)
}

// ---------------------------------------------------------------------
// Sugerencias: gente de su estado, con sus máquinas o que más ayuda
// ---------------------------------------------------------------------

export async function sugerencias(p: Perfil, limite = 5): Promise<Autor[]> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select ${AUTOR} from foro.perfiles a
       where a.id <> $1 and a.suspendido = false
         and not exists (select 1 from foro.seguimientos g where g.seguidor_id = $1
           and (g.objetivo = 'p:' || a.id::text or (a.vendedor_id is not null and g.objetivo = 't:' || a.vendedor_id)))
       order by (a.estado_mx <> '' and a.estado_mx = $2) desc,
         (a.maquinas && $3::text[]) desc,
         (a.vendedor_id is not null) desc,
         a.reputacion desc, a.creado desc
       limit $4`,
      [p.id, p.estadoMx, p.maquinas, limite]
    )
    return rows.map(aAutor)
  })
  return r || []
}

// ---------------------------------------------------------------------
// Avales y recomendaciones
// ---------------------------------------------------------------------

export async function avalesDe(p: Pick<Perfil, "id" | "aptitudes">, verPerfilId?: string | null): Promise<Aval[]> {
  if (!p.aptitudes.length) return []
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select aptitud, count(*) as n, bool_or(autor_id = $2) as yo from foro.avales
       where perfil_id = $1 group by aptitud`,
      [p.id, verPerfilId || NINGUNO]
    )
    return rows as Fila[]
  })
  const mapa = new Map((r || []).map((f) => [f.aptitud as string, f]))
  return p.aptitudes
    .map((aptitud) => ({ aptitud, n: Number(mapa.get(aptitud)?.n) || 0, yo: Boolean(mapa.get(aptitud)?.yo) }))
    .sort((a, b) => b.n - a.n)
}

export async function recomendacionesDe(perfilId: string, conPendientes = false): Promise<Recomendacion[]> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select r.id, r.relacion, r.texto, r.estado, r.creado, ${AUTOR}
       from foro.recomendaciones r join foro.perfiles a on a.id = r.autor_id
       where r.perfil_id = $1 and a.suspendido = false
         and (r.estado = 'publicada' or ($2 and r.estado = 'pendiente'))
       order by (r.estado = 'pendiente') desc, r.creado desc limit 50`,
      [perfilId, conPendientes]
    )
    return rows.map(
      (f): Recomendacion => ({
        id: Number(f.id),
        relacion: f.relacion,
        texto: f.texto,
        estado: f.estado,
        creado: fecha(f.creado),
        autor: aAutor(f),
      })
    )
  })
  return r || []
}

// La que esta persona ya le escribió (para no duplicar y poder corregirla)
export async function miRecomendacion(perfilId: string, autorId: string): Promise<{ relacion: string; texto: string; estado: string } | null> {
  return intentar(async () => {
    const { rows } = await db().query(
      `select relacion, texto, estado from foro.recomendaciones where perfil_id = $1 and autor_id = $2`,
      [perfilId, autorId]
    )
    return rows[0] || null
  })
}

// ---------------------------------------------------------------------
// Vacantes y postulaciones
// ---------------------------------------------------------------------

export async function postulacionesDe(temaId: number): Promise<Postulacion[]> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select g.mensaje, g.creado, a.ciudad as a_ciudad, a.estado_mx as a_estado, ${AUTOR}
       from foro.postulaciones g join foro.perfiles a on a.id = g.perfil_id
       where g.tema_id = $1 and a.suspendido = false order by g.creado desc limit 200`,
      [temaId]
    )
    return rows.map((f) => ({
      mensaje: f.mensaje,
      creado: fecha(f.creado),
      autor: { ...aAutor(f), ciudad: f.a_ciudad || "", estadoMx: f.a_estado || "" },
    }))
  })
  return r || []
}

export async function yaPostulado(temaId: number, perfilId: string): Promise<boolean> {
  const r = await intentar(async () => {
    const { rows } = await db().query(`select 1 from foro.postulaciones where tema_id = $1 and perfil_id = $2`, [temaId, perfilId])
    return rows.length > 0
  })
  return Boolean(r)
}

// Lo pendiente de atender en "Mi red": postulaciones a sus vacantes de los
// últimos 30 días y recomendaciones que esperan su visto bueno.
export type Pendientes = { vacantes: { titulo: string; seccion: string; slug: string; n: number }[]; recomendaciones: number }

export async function pendientesDe(perfilId: string): Promise<Pendientes> {
  const r = await intentar(async () => {
    const [v, rec] = await Promise.all([
      db().query(
        `select t.titulo, t.slug, s.slug as seccion, count(g.perfil_id) as n
         from foro.temas t join foro.secciones s on s.id = t.seccion_id
         join foro.postulaciones g on g.tema_id = t.id
         where t.autor_id = $1 and t.tipo = 'vacante' and g.creado > now() - interval '30 days'
         group by t.id, s.slug order by max(g.creado) desc limit 10`,
        [perfilId]
      ),
      db().query(`select count(*) as n from foro.recomendaciones where perfil_id = $1 and estado = 'pendiente'`, [perfilId]),
    ])
    return {
      vacantes: v.rows.map((f) => ({ titulo: f.titulo, seccion: f.seccion, slug: f.slug, n: Number(f.n) || 0 })),
      recomendaciones: Number(rec.rows[0]?.n) || 0,
    }
  })
  return r || { vacantes: [], recomendaciones: 0 }
}

// Profesionales que marcaron "Abierto a trabajo y proyectos"
export type Abierto = Autor & { ciudad: string; estadoMx: string; aptitudes: string[] }

export async function abiertosATrabajo(limite = 12): Promise<Abierto[]> {
  const r = await intentar(async () => {
    const { rows } = await db().query(
      `select ${AUTOR}, a.ciudad as a_ciudad, a.estado_mx as a_estado, a.aptitudes as a_aptitudes
       from foro.perfiles a where a.abierto = true and a.suspendido = false
       order by a.reputacion desc, a.actualizado desc limit $1`,
      [limite]
    )
    return rows.map((f) => ({
      ...aAutor(f),
      ciudad: f.a_ciudad || "",
      estadoMx: f.a_estado || "",
      aptitudes: Array.isArray(f.a_aptitudes) ? f.a_aptitudes.slice(0, 4) : [],
    }))
  })
  return r || []
}
