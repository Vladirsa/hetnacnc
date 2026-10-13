"use server"

// Cuenta los mensajes sin leer del cliente (para el numerito rojo de la campanita).
// Solo cuenta las conversaciones del cliente que tiene la sesión iniciada.

import { claveError, db } from "@/lib/foro/db"

import { sesionChat } from "./consultas"

export async function contarSinLeer(): Promise<{ ok: true; total: number } | { ok: false }> {
  const s = await sesionChat()
  if (!s) return { ok: false }
  try {
    const { rows } = await db().query(
      `select coalesce(sum(sin_leer_cliente), 0)::int as n from chat.conversaciones where cliente_id = $1`,
      [s.clienteId]
    )
    return { ok: true, total: Number(rows[0].n) || 0 }
  } catch (e) {
    // Si el chat no está activo todavía, la campanita simplemente no muestra número
    if (claveError(e) === "error") console.error("[chat] campanita", (e as Error).message)
    return { ok: false }
  }
}
