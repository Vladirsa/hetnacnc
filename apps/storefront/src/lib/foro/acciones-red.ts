"use server"

// Acciones de la red profesional del foro: seguir, currículum, avales,
// recomendaciones y postulaciones. Igual que acciones.ts: la sesión de la
// tienda decide quién hace qué; el navegador sólo manda lo que pidió.

import { listarTalleres } from "@/lib/hetna/talleres"

import { sesionForo } from "./consultas"
import { claveError, db } from "./db"
import { revisarTexto } from "./filtro"
import { type EstadoRed, estadoRed } from "./red"
import {
  MAX_APTITUDES,
  MAX_PASOS,
  type Paso,
  RELACIONES,
  TIPOS_TRAYECTORIA,
  type TipoTrayectoria,
  esObjetivo,
  objetivoPerfil,
} from "./tipos"

type Res<T = {}> = ({ ok: true } & T) | { ok: false; error: string }

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "")
const linea = (v: unknown, max: number) => texto(v, max).replace(/\s+/g, " ")

// Sin la migración de la red, las tablas o columnas nuevas no existen.
const fallo = (e: unknown): { ok: false; error: string } => {
  const pg = e as { code?: string }
  if (pg.code === "42P01" || pg.code === "42703") return { ok: false, error: "red_no_activa" }
  const clave = claveError(e)
  if (clave === "error") console.error("[foro red]", e)
  return { ok: false, error: clave }
}

async function conPerfil() {
  const s = await sesionForo()
  if (!s) return { error: "sin_sesion" as const }
  if (!s.perfil) return { error: "sin_perfil" as const }
  if (s.perfil.suspendido) return { error: "perfil_suspendido" as const }
  return { perfil: s.perfil }
}

// Cuántas veces hizo algo en las últimas 24 horas
async function hoy(tabla: string, columna: string, perfilId: string) {
  const { rows } = await db().query(
    `select count(*) as n from foro.${tabla} where ${columna} = $1 and creado > now() - interval '1 day'`,
    [perfilId]
  )
  return Number(rows[0]?.n) || 0
}

// ---------------------------------------------------------------------
// Seguir a una persona, un taller o una sección
// ---------------------------------------------------------------------

async function objetivoExiste(objetivo: string): Promise<boolean> {
  const valor = objetivo.slice(2)
  if (objetivo.startsWith("p:")) {
    const { rows } = await db().query(`select 1 from foro.perfiles where id = $1 and suspendido = false`, [valor])
    return rows.length > 0
  }
  if (objetivo.startsWith("s:")) {
    const { rows } = await db().query(`select 1 from foro.secciones where slug = $1`, [valor])
    return rows.length > 0
  }
  return (await listarTalleres()).some((t) => t.id === valor)
}

export async function seguir(objetivo: string, quiere: boolean): Promise<Res<EstadoRed>> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  if (!esObjetivo(objetivo)) return { ok: false, error: "error" }
  const { perfil } = p
  if (objetivo === `p:${perfil.id}` || objetivo === objetivoPerfil(perfil)) return { ok: false, error: "a_ti_mismo" }
  try {
    if (quiere) {
      if (!(await objetivoExiste(objetivo))) return { ok: false, error: "no_existe" }
      if ((await hoy("seguimientos", "seguidor_id", perfil.id)) >= 300) return { ok: false, error: "limite_diario" }
      await db().query(
        `insert into foro.seguimientos (seguidor_id, objetivo) values ($1, $2) on conflict do nothing`,
        [perfil.id, objetivo]
      )
    } else {
      await db().query(`delete from foro.seguimientos where seguidor_id = $1 and objetivo = $2`, [perfil.id, objetivo])
    }
    // Una persona ligada a un taller se cuenta junto con su taller
    let objetivos = [objetivo]
    if (objetivo.startsWith("t:")) {
      const { rows } = await db().query(`select id from foro.perfiles where vendedor_id = $1`, [objetivo.slice(2)])
      objetivos = [objetivo, ...rows.map((f) => `p:${f.id}`)]
    }
    if (!quiere) {
      // Dejar de seguir a un taller también deja de seguir a su perfil (y al revés)
      await db().query(`delete from foro.seguimientos where seguidor_id = $1 and objetivo = any($2)`, [perfil.id, objetivos])
    }
    return { ok: true, ...(await estadoRed(objetivos, perfil.id)) }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// Currículum: aptitudes, trayectoria y "abierto a trabajo"
// ---------------------------------------------------------------------

const esTipoPaso = (v: unknown): v is TipoTrayectoria => typeof v === "string" && v in TIPOS_TRAYECTORIA

export async function guardarRed(d: { aptitudes?: unknown; trayectoria?: unknown; abierto?: unknown }): Promise<Res> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }

  const aptitudes: string[] = []
  for (const a of Array.isArray(d.aptitudes) ? d.aptitudes : []) {
    const limpio = revisarTexto(linea(a, 40)).texto
    if (limpio.length < 2 || limpio.includes("[dato")) continue
    if (!aptitudes.some((x) => x.toLowerCase() === limpio.toLowerCase())) aptitudes.push(limpio)
  }
  if (aptitudes.length > MAX_APTITUDES) return { ok: false, error: `Máximo ${MAX_APTITUDES} aptitudes.` }

  const trayectoria: Paso[] = []
  for (const x of Array.isArray(d.trayectoria) ? d.trayectoria : []) {
    if (!x || typeof x !== "object") continue
    const f = x as Record<string, unknown>
    const titulo = revisarTexto(linea(f.titulo, 100)).texto
    if (!titulo) continue
    if (!esTipoPaso(f.tipo)) return { ok: false, error: "Elige si es experiencia, estudios, certificación o proyecto." }
    if (titulo.length < 2) return { ok: false, error: "Cada paso necesita un título." }
    trayectoria.push({
      tipo: f.tipo,
      titulo,
      lugar: revisarTexto(linea(f.lugar, 100)).texto,
      desde: linea(f.desde, 20),
      hasta: linea(f.hasta, 20),
      detalle: revisarTexto(texto(f.detalle, 500)).texto,
    })
  }
  if (trayectoria.length > MAX_PASOS) return { ok: false, error: `Máximo ${MAX_PASOS} renglones en tu trayectoria.` }

  try {
    await db().query(`update foro.perfiles set aptitudes = $2, trayectoria = $3::jsonb, abierto = $4 where id = $1`, [
      p.perfil.id,
      aptitudes,
      JSON.stringify(trayectoria),
      d.abierto === true,
    ])
    // Los avales de una aptitud que ya quitó se van con ella
    await db().query(`delete from foro.avales where perfil_id = $1 and not (aptitud = any($2))`, [p.perfil.id, aptitudes])
    return { ok: true }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// Avales
// ---------------------------------------------------------------------

export async function avalar(perfilId: string, aptitud: string, quiere: boolean): Promise<Res<{ n: number; yo: boolean }>> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  if (!/^[0-9a-f-]{36}$/.test(perfilId)) return { ok: false, error: "error" }
  if (perfilId === p.perfil.id) return { ok: false, error: "a_ti_mismo" }
  try {
    const { rows } = await db().query(`select aptitudes from foro.perfiles where id = $1 and suspendido = false`, [perfilId])
    if (!rows[0] || !(rows[0].aptitudes || []).includes(aptitud)) return { ok: false, error: "no_existe" }
    if (quiere) {
      if ((await hoy("avales", "autor_id", p.perfil.id)) >= 100) return { ok: false, error: "limite_diario" }
      await db().query(`insert into foro.avales (perfil_id, aptitud, autor_id) values ($1, $2, $3) on conflict do nothing`, [
        perfilId,
        aptitud,
        p.perfil.id,
      ])
    } else {
      await db().query(`delete from foro.avales where perfil_id = $1 and aptitud = $2 and autor_id = $3`, [perfilId, aptitud, p.perfil.id])
    }
    const c = await db().query(`select count(*) as n from foro.avales where perfil_id = $1 and aptitud = $2`, [perfilId, aptitud])
    return { ok: true, n: Number(c.rows[0]?.n) || 0, yo: quiere }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// Recomendaciones: las escribe otro; salen hasta que el dueño las acepta
// ---------------------------------------------------------------------

export async function recomendar(perfilId: string, relacion: string, cuerpo: string): Promise<Res> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  if (!/^[0-9a-f-]{36}$/.test(perfilId)) return { ok: false, error: "error" }
  if (perfilId === p.perfil.id) return { ok: false, error: "a_ti_mismo" }
  if (!(relacion in RELACIONES)) return { ok: false, error: "Elige de dónde se conocen." }
  const t = revisarTexto(texto(cuerpo, 1500))
  if (t.texto.length < 30) return { ok: false, error: "Cuenta un poco más: qué trabajo hizo, cómo quedó y por qué lo recomiendas." }
  try {
    const { rows } = await db().query(`select 1 from foro.perfiles where id = $1 and suspendido = false`, [perfilId])
    if (!rows[0]) return { ok: false, error: "no_existe" }
    if ((await hoy("recomendaciones", "autor_id", p.perfil.id)) >= 5) return { ok: false, error: "limite_diario" }
    await db().query(
      `insert into foro.recomendaciones (perfil_id, autor_id, relacion, texto) values ($1, $2, $3, $4)
       on conflict (perfil_id, autor_id) do update set relacion = excluded.relacion, texto = excluded.texto,
         estado = 'pendiente', creado = now()`,
      [perfilId, p.perfil.id, relacion, t.texto]
    )
    return { ok: true }
  } catch (e) {
    return fallo(e)
  }
}

export async function decidirRecomendacion(id: number, estado: "publicada" | "oculta"): Promise<Res> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  if (!Number.isSafeInteger(id) || !["publicada", "oculta"].includes(estado)) return { ok: false, error: "error" }
  try {
    const r = await db().query(`update foro.recomendaciones set estado = $3 where id = $1 and perfil_id = $2`, [id, p.perfil.id, estado])
    return r.rowCount ? { ok: true } : { ok: false, error: "no_existe" }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// Postularse a una vacante. El mensaje sólo lo ve quien la publicó, así que
// aquí sí puede llevar su teléfono o correo para que lo contacten.
// ---------------------------------------------------------------------

export async function postularme(temaId: number, mensaje: string): Promise<Res> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  if (!Number.isSafeInteger(temaId) || temaId <= 0) return { ok: false, error: "error" }
  const m = texto(mensaje, 1500)
  if (m.length < 10) return { ok: false, error: "Cuéntale en dos o tres renglones qué sabes hacer y cómo contactarte." }
  try {
    const { rows } = await db().query(`select tipo, autor_id, estado from foro.temas where id = $1`, [temaId])
    const t = rows[0]
    if (!t || t.estado !== "publicado") return { ok: false, error: "tema_no_existe" }
    if (t.tipo !== "vacante") return { ok: false, error: "no_es_vacante" }
    if (t.autor_id === p.perfil.id) return { ok: false, error: "a_ti_mismo" }
    if ((await hoy("postulaciones", "perfil_id", p.perfil.id)) >= 15) return { ok: false, error: "limite_diario" }
    const r = await db().query(
      `insert into foro.postulaciones (tema_id, perfil_id, mensaje) values ($1, $2, $3) on conflict do nothing`,
      [temaId, p.perfil.id, m]
    )
    return r.rowCount ? { ok: true } : { ok: false, error: "ya_postulado" }
  } catch (e) {
    return fallo(e)
  }
}
