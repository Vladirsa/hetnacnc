"use server"
// Acciones del perfil de taller del foro (tipo LinkedIn): máquinas, materiales
// con espesores y portafolio de trabajos. Cada sección se guarda por separado
// (botón "Guardar" de cada una, pensado para el celular). Igual que las demás
// acciones del foro: la sesión de la tienda decide de quién es el perfil.
import { sesionForo } from "./consultas"
import { claveError, db } from "./db"
import { contactoProhibido, fotosDeLista, leerEquipos, leerMateriales, leerPortafolio } from "./perfil-taller"
import { MAX_EQUIPOS, MAX_TRABAJOS } from "./tipos"

type Res = { ok: true } | { ok: false; error: string }

// Sin la migración del 25 de noviembre las columnas no existen todavía
const fallo = (e: unknown): { ok: false; error: string } => {
  const code = (e as { code?: string }).code
  if (code === "42703" || code === "42P01") return { ok: false, error: "perfil_taller_no_activo" }
  const clave = claveError(e)
  if (clave === "error") console.error("[foro perfil taller]", e)
  return { ok: false, error: clave }
}

/** Fotos de la lista que de verdad subió esta persona (nadie usa fotos ajenas). */
async function fotosPropias(perfilId: string, lista: unknown): Promise<Set<string>> {
  const ids = fotosDeLista(lista).slice(0, 200)
  if (!ids.length) return new Set()
  const { rows } = await db().query(`select id from foro.fotos where perfil_id = $1 and id = any($2::uuid[])`, [perfilId, ids])
  return new Set(rows.map((r: { id: string }) => String(r.id)))
}

export async function guardarTaller(d: { equipos?: unknown; materiales?: unknown; portafolio?: unknown }): Promise<Res> {
  const s = await sesionForo()
  if (!s) return { ok: false, error: "sin_sesion" }
  if (!s.perfil) return { ok: false, error: "sin_perfil" }
  if (s.perfil.suspendido) return { ok: false, error: "perfil_suspendido" }
  const perfilId = s.perfil.id

  if (Array.isArray(d.equipos) && d.equipos.length > MAX_EQUIPOS) return { ok: false, error: `Máximo ${MAX_EQUIPOS} máquinas.` }
  if (Array.isArray(d.portafolio) && d.portafolio.length > MAX_TRABAJOS) return { ok: false, error: `Máximo ${MAX_TRABAJOS} trabajos en el portafolio.` }

  // Mismo filtro del chat: nada de teléfonos, correos, WhatsApp, redes ni ligas
  const textos = (lista: unknown, campos: string[]) =>
    (Array.isArray(lista) ? lista : []).flatMap((x) => (x && typeof x === "object" ? campos.map((c) => (x as Record<string, unknown>)[c]) : []))
  const prohibido =
    contactoProhibido(textos(d.equipos, ["modelo"]), "tus máquinas") ||
    contactoProhibido(textos(d.portafolio, ["titulo", "detalle"]), "tu portafolio")
  if (prohibido) return { ok: false, error: prohibido }

  try {
    const sets: string[] = []
    const vals: unknown[] = [perfilId]
    if (Array.isArray(d.equipos)) {
      const equipos = leerEquipos(d.equipos, await fotosPropias(perfilId, d.equipos))
      vals.push(JSON.stringify(equipos))
      sets.push(`equipos = $${vals.length}::jsonb`)
    }
    if (Array.isArray(d.materiales)) {
      vals.push(JSON.stringify(leerMateriales(d.materiales)))
      sets.push(`materiales = $${vals.length}::jsonb`)
    }
    if (Array.isArray(d.portafolio)) {
      const crudo = d.portafolio as unknown[]
      // Un trabajo sin fotos o sin título no se puede guardar: se avisa en vez de perderlo callado
      if (crudo.some((x) => x && typeof x === "object" && !String((x as { titulo?: unknown }).titulo || "").trim()))
        return { ok: false, error: "Cada trabajo necesita un título." }
      if (crudo.some((x) => x && typeof x === "object" && !((x as { fotos?: unknown[] }).fotos || []).length))
        return { ok: false, error: "Cada trabajo necesita al menos una foto." }
      const portafolio = leerPortafolio(crudo, await fotosPropias(perfilId, crudo))
      vals.push(JSON.stringify(portafolio))
      sets.push(`portafolio = $${vals.length}::jsonb`)
    }
    if (!sets.length) return { ok: true }
    await db().query(`update foro.perfiles set ${sets.join(", ")} where id = $1`, vals)
    return { ok: true }
  } catch (e) {
    return fallo(e)
  }
}
