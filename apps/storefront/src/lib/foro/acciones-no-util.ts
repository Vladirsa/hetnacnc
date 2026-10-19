"use server"

// Botón "No útil" del foro: solo informativo.
// Se guarda quién lo marcó, pero NO cambia contadores, reputación ni orden.

import { sesionForo } from "./consultas"
import { claveError, db } from "./db"

type Res = { ok: true; marcado: boolean } | { ok: false; error: string }

const entero = (v: unknown) => {
  const n = Number(v)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export async function noUtil(d: { temaId?: number; respuestaId?: number }): Promise<Res> {
  const s = await sesionForo()
  if (!s) return { ok: false, error: "sin_sesion" }
  if (!s.perfil) return { ok: false, error: "sin_perfil" }
  if (s.perfil.suspendido) return { ok: false, error: "perfil_suspendido" }
  const temaId = entero(d.temaId)
  const respuestaId = temaId ? null : entero(d.respuestaId)
  if (!temaId && !respuestaId) return { ok: false, error: "error" }
  try {
    const { rows } = await db().query(`select foro.no_util($1, $2, $3) as marcado`, [s.perfil.id, temaId, respuestaId])
    return { ok: true, marcado: Boolean(rows[0]?.marcado) }
  } catch (e) {
    const clave = claveError(e)
    if (clave === "error") console.error("[foro]", e)
    return { ok: false, error: clave }
  }
}
