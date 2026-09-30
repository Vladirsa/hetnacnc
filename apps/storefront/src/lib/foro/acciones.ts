"use server"

// Acciones del Foro CNC México. Todo se valida aquí en el servidor con la sesión de la tienda:
// el navegador nunca decide quién publica, qué se oculta ni cuántos votos hay.

import { ligaValida } from "./contenido"
import { sesionForo } from "./consultas"
import { claveError, db } from "./db"
import { revisarTexto } from "./filtro"
import { ES_NEGOCIO, type Red, REDES, esTipoCuenta, esTipoTema, urlFoto, urlTema } from "./tipos"

type Res<T = {}> = ({ ok: true } & T) | { ok: false; error: string }

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "")
const lista = (v: unknown, n: number, max: number) =>
  Array.isArray(v)
    ? Array.from(new Set(v.map((x) => texto(x, max)).filter(Boolean))).slice(0, n)
    : []
const esId = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v)
const entero = (v: unknown) => {
  const n = Number(v)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
const fallo = (e: unknown): { ok: false; error: string } => {
  const clave = claveError(e)
  if (clave === "error") console.error("[foro]", e)
  return { ok: false, error: clave }
}

async function conPerfil() {
  const s = await sesionForo()
  if (!s) return { error: "sin_sesion" as const }
  if (!s.perfil) return { error: "sin_perfil" as const }
  if (s.perfil.suspendido) return { error: "perfil_suspendido" as const }
  return { sesion: s, perfil: s.perfil }
}

// Solo fotos que subió esta misma persona
async function fotosPropias(perfilId: string, ids: unknown): Promise<string[]> {
  const pedidas = Array.isArray(ids) ? ids.filter(esId).slice(0, 8) : []
  if (!pedidas.length) return []
  const { rows } = await db().query(`select id from foro.fotos where perfil_id = $1 and id = any($2::uuid[])`, [
    perfilId,
    pedidas,
  ])
  const ok = new Set(rows.map((r) => r.id))
  return pedidas.filter((id) => ok.has(id))
}

const esCuentaNueva = (creado: string) => Date.now() - new Date(creado).getTime() < 24 * 3600 * 1000

async function anotarRevision(tipo: "tema" | "respuesta", id: number, revisar: boolean, motivos: string[]) {
  if (!motivos.length) return
  await db()
    .query(`insert into foro.revisiones (tipo, objeto_id, resultado, motivo) values ($1, $2, $3, $4)`, [
      tipo,
      id,
      revisar ? "revisar" : "publicar",
      motivos.join("; ").slice(0, 500),
    ])
    .catch(() => {})
}

// ---------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------

const RESERVADOS = new Set([
  "admin", "administrador", "hetna", "hetnacnc", "hetna-cnc", "moderador", "soporte", "ayuda", "foro",
  "foro-cnc", "nuevo", "perfil", "mi-perfil", "buscar", "api", "tienda", "vendedor", "oficial",
])

// Acepta la liga completa o solo el @usuario de la red
function redValida(red: Red, v: string): string | null {
  const s = v.trim()
  if (!s) return null
  const arroba = s.match(/^@?([\w.\-]{2,60})$/)
  if (arroba && red !== "web") {
    const u = arroba[1]
    const base: Record<Exclude<Red, "web">, string> = {
      facebook: `https://www.facebook.com/${u}`,
      instagram: `https://www.instagram.com/${u}`,
      tiktok: `https://www.tiktok.com/@${u}`,
      youtube: `https://www.youtube.com/@${u}`,
      x: `https://x.com/${u}`,
      linkedin: `https://www.linkedin.com/in/${u}`,
    }
    return base[red]
  }
  const url = ligaValida(s)
  if (!url) return null
  const host = new URL(url).hostname.replace(/^www\.|^m\./, "")
  if (/whatsapp|wa\.me|wa\.link|t\.me|telegram/i.test(url)) return null
  const dominios = REDES[red].dominios as readonly string[]
  if (dominios.length && !dominios.some((d) => host === d || host.endsWith("." + d))) return null
  return url.startsWith("http://") ? url.replace("http://", "https://") : url
}

export async function usuarioDisponible(usuario: string): Promise<{ disponible: boolean }> {
  const u = texto(usuario, 30).toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(u) || RESERVADOS.has(u)) return { disponible: false }
  const s = await sesionForo()
  try {
    const { rows } = await db().query(`select cliente_id from foro.perfiles where usuario = $1`, [u])
    return { disponible: !rows[0] || rows[0].cliente_id === s?.clienteId }
  } catch {
    return { disponible: false }
  }
}

export async function guardarPerfil(d: Record<string, unknown>): Promise<Res<{ usuario: string }>> {
  const s = await sesionForo()
  if (!s) return { ok: false, error: "sin_sesion" }
  if (s.perfil?.suspendido) return { ok: false, error: "perfil_suspendido" }

  const usuario = texto(d.usuario, 30).toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(usuario))
    return { ok: false, error: "El usuario lleva de 3 a 30 letras minúsculas, números o guiones, sin espacios." }
  if (RESERVADOS.has(usuario)) return { ok: false, error: "usuario_ocupado" }
  const nombre = revisarTexto(texto(d.nombre, 80)).texto
  if (nombre.length < 2) return { ok: false, error: "Escribe tu nombre o el de tu taller." }
  if (!esTipoCuenta(d.tipo)) return { ok: false, error: "Elige qué tipo de cuenta eres." }

  const bio = revisarTexto(texto(d.bio, 1000)).texto
  const redesEntrada = (d.redes && typeof d.redes === "object" ? d.redes : {}) as Record<string, unknown>
  const redes: Partial<Record<Red, string>> = {}
  for (const red of Object.keys(REDES) as Red[]) {
    const v = texto(redesEntrada[red], 200)
    if (!v) continue
    const url = redValida(red, v)
    if (!url) return { ok: false, error: `Revisa la liga de ${REDES[red].nombre}.` }
    redes[red] = url
  }

  let fotoUrl: string | null = s.perfil?.foto ?? null
  if (d.foto === null) fotoUrl = null
  else if (esId(d.foto) && s.perfil) {
    const [f] = await fotosPropias(s.perfil.id, [d.foto])
    if (f) fotoUrl = urlFoto(f)
  }

  const valores = [
    usuario, nombre, d.tipo, bio, texto(d.ciudad, 80), texto(d.estadoMx, 40), JSON.stringify(redes),
    lista(d.maquinas, 12, 60), lista(d.software, 12, 40), fotoUrl,
  ]
  try {
    if (s.perfil) {
      await db().query(
        `update foro.perfiles set usuario = $2, nombre = $3, tipo = $4, bio = $5, ciudad = $6, estado_mx = $7,
           redes = $8::jsonb, maquinas = $9, software = $10, foto_url = $11 where id = $1`,
        [s.perfil.id, ...valores]
      )
    } else {
      await db().query(
        `insert into foro.perfiles (cliente_id, usuario, nombre, tipo, bio, ciudad, estado_mx, redes, maquinas, software, foto_url)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
        [s.clienteId, ...valores]
      )
    }
    return { ok: true, usuario }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// Temas y respuestas
// ---------------------------------------------------------------------

export async function publicarTema(
  d: Record<string, unknown>
): Promise<Res<{ url: string; estado: string; ocultos: number }>> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  const { perfil } = p

  const seccion = texto(d.seccion, 60)
  if (!esTipoTema(d.tipo)) return { ok: false, error: "Elige el tipo de publicación." }
  if (d.tipo === "novedad" && !ES_NEGOCIO.includes(perfil.tipo)) return { ok: false, error: "solo_negocios" }
  const t = revisarTexto(texto(d.titulo, 150).replace(/\s+/g, " "))
  if (t.texto.length < 10) return { ok: false, error: "El título debe tener al menos 10 letras. Dilo como lo buscarías en Google." }
  const c = revisarTexto(texto(d.cuerpo, 20000), { cuentaNueva: esCuentaNueva(perfil.creado) })
  if (c.texto.length < 15) return { ok: false, error: "Cuenta un poco más: máquina, material, herramienta y qué pasó." }

  const ligas: string[] = []
  for (const l of lista(d.ligas, 5, 400)) {
    const url = ligaValida(l)
    if (url && !/whatsapp|wa\.me|wa\.link|t\.me\/|telegram/i.test(url)) ligas.push(url)
  }
  let encuesta: { pregunta: string; opciones: string[] } | null = null
  if (d.tipo === "debate" && d.encuesta && typeof d.encuesta === "object") {
    const e = d.encuesta as Record<string, unknown>
    const opciones = lista(e.opciones, 6, 80)
    const pregunta = texto(e.pregunta, 150)
    if (pregunta || opciones.length) {
      if (pregunta.length < 3 || opciones.length < 2)
        return { ok: false, error: "La encuesta necesita una pregunta y al menos 2 opciones." }
      encuesta = { pregunta, opciones }
    }
  }

  const revisar = t.revisar || c.revisar
  const motivos = [...t.motivos, ...c.motivos]
  try {
    const fotos = await fotosPropias(perfil.id, d.fotos)
    const { rows } = await db().query(
      `select * from foro.crear_tema($1, $2, $3, $4, $5, $6::jsonb, $7::text[], $8::jsonb, $9)`,
      [perfil.id, seccion, d.tipo, t.texto, c.texto, JSON.stringify(ligas), fotos, encuesta ? JSON.stringify(encuesta) : null,
        revisar ? "revision" : "publicado"]
    )
    const nuevo = rows[0]
    await anotarRevision("tema", Number(nuevo.id), revisar, motivos)
    return {
      ok: true,
      url: urlTema({ seccion: nuevo.seccion, slug: nuevo.slug }),
      estado: revisar ? "revision" : "publicado",
      ocultos: t.ocultos + c.ocultos,
    }
  } catch (e) {
    return fallo(e)
  }
}

export async function responder(d: Record<string, unknown>): Promise<Res<{ id: number; estado: string; ocultos: number }>> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  const temaId = entero(d.temaId)
  if (!temaId) return { ok: false, error: "tema_no_existe" }
  const c = revisarTexto(texto(d.cuerpo, 10000), { cuentaNueva: esCuentaNueva(p.perfil.creado) })
  if (c.texto.length < 2) return { ok: false, error: "Escribe tu respuesta." }
  try {
    const fotos = await fotosPropias(p.perfil.id, d.fotos)
    const { rows } = await db().query(`select foro.responder($1, $2, $3, $4, $5::text[], $6) as id`, [
      p.perfil.id, temaId, c.texto, entero(d.padreId), fotos, c.revisar ? "revision" : "publicado",
    ])
    const id = Number(rows[0].id)
    await anotarRevision("respuesta", id, c.revisar, c.motivos)
    return { ok: true, id, estado: c.revisar ? "revision" : "publicado", ocultos: c.ocultos }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// Votos, encuestas y mejor respuesta
// ---------------------------------------------------------------------

export async function votar(d: { temaId?: number; respuestaId?: number }): Promise<Res<{ votado: boolean; votos: number }>> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  const temaId = entero(d.temaId)
  const respuestaId = temaId ? null : entero(d.respuestaId)
  if (!temaId && !respuestaId) return { ok: false, error: "error" }
  try {
    const { rows } = await db().query(`select foro.votar($1, $2, $3) as votado`, [p.perfil.id, temaId, respuestaId])
    const cuenta = await db().query(
      temaId ? `select votos from foro.temas where id = $1` : `select votos from foro.respuestas where id = $1`,
      [temaId || respuestaId]
    )
    return { ok: true, votado: Boolean(rows[0].votado), votos: Number(cuenta.rows[0]?.votos) || 0 }
  } catch (e) {
    return fallo(e)
  }
}

export async function votarEncuesta(temaId: number, opcion: number): Promise<Res<{ resultados: number[] }>> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  const id = entero(temaId)
  if (!id || !Number.isInteger(opcion)) return { ok: false, error: "opcion_invalida" }
  try {
    await db().query(`select foro.votar_encuesta($1, $2, $3::smallint)`, [p.perfil.id, id, opcion])
    const { rows } = await db().query(
      `select jsonb_array_length(t.encuesta -> 'opciones') as n,
        (select coalesce(jsonb_object_agg(opcion, c), '{}') from (select opcion, count(*) as c from foro.encuesta_votos
          where tema_id = t.id group by opcion) x) as votos
       from foro.temas t where t.id = $1`,
      [id]
    )
    const n = Number(rows[0]?.n) || 0
    const votos = rows[0]?.votos || {}
    return { ok: true, resultados: Array.from({ length: n }, (_, i) => Number(votos[i]) || 0) }
  } catch (e) {
    return fallo(e)
  }
}

export async function marcarMejor(temaId: number, respuestaId: number | null): Promise<Res> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  try {
    await db().query(`select foro.marcar_mejor($1, $2, $3)`, [p.perfil.id, entero(temaId), respuestaId ? entero(respuestaId) : null])
    return { ok: true }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// Reportes y moderación
// ---------------------------------------------------------------------

export async function reportar(tipo: string, objetoId: string | number, motivo: string): Promise<Res> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  if (!["tema", "respuesta", "perfil"].includes(tipo)) return { ok: false, error: "error" }
  const m = texto(motivo, 500)
  if (m.length < 3) return { ok: false, error: "Cuéntanos qué pasa." }
  try {
    const { rows } = await db().query(
      `select count(*) as n from foro.reportes where autor_id = $1 and creado > now() - interval '1 day'`,
      [p.perfil.id]
    )
    if (Number(rows[0].n) >= 20) return { ok: false, error: "limite_diario" }
    await db().query(`insert into foro.reportes (tipo, objeto_id, autor_id, motivo) values ($1, $2, $3, $4)`, [
      tipo, String(objetoId).slice(0, 60), p.perfil.id, m,
    ])
    return { ok: true }
  } catch (e) {
    return fallo(e)
  }
}

// El autor puede ocultar lo suyo; moderadores y admin pueden ocultar, publicar o mandar a revisión cualquier cosa
export async function cambiarEstado(tipo: "tema" | "respuesta", id: number, estado: "publicado" | "oculto" | "revision"): Promise<Res> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  const n = entero(id)
  if (!n || !["publicado", "oculto", "revision"].includes(estado) || !["tema", "respuesta"].includes(tipo))
    return { ok: false, error: "error" }
  const tabla = tipo === "tema" ? "foro.temas" : "foro.respuestas"
  const mod = p.perfil.rol === "moderador" || p.perfil.rol === "admin"
  try {
    const r = mod
      ? await db().query(`update ${tabla} set estado = $2 where id = $1`, [n, estado])
      : estado === "oculto"
        ? await db().query(`update ${tabla} set estado = 'oculto' where id = $1 and autor_id = $2`, [n, p.perfil.id])
        : null
    if (!r || !r.rowCount) return { ok: false, error: "No tienes permiso para hacer esto." }
    return { ok: true }
  } catch (e) {
    return fallo(e)
  }
}
