// Conexión a la base del foro (solo servidor). Usa HETNA_FORO_DB y, si no existe,
// la misma base de HetNa Taller (HETNA_TALLER_DB). Las tablas viven en el esquema "foro".

import { Pool } from "pg"

const g = globalThis as unknown as { __hetnaForoPool?: Pool }

export const urlBaseForo = () => process.env.HETNA_FORO_DB || process.env.HETNA_TALLER_DB || ""
export const foroConfigurado = () => Boolean(urlBaseForo())

export const db = (): Pool => {
  if (!g.__hetnaForoPool) {
    const url = urlBaseForo()
    if (!url) throw new Error("sin_foro")
    g.__hetnaForoPool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 })
    g.__hetnaForoPool.on("error", (e) => console.error("[foro] base", e.message))
  }
  return g.__hetnaForoPool
}

// Errores de la base: los que lanzan las funciones del foro vienen con su clave (p. ej. "solo_negocios")
export const claveError = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e)
  if (/^[a-z_]+$/.test(m)) return m
  const pg = e as { code?: string; constraint?: string }
  if (pg.code === "23505" && /usuario/.test(pg.constraint || "")) return "usuario_ocupado"
  if (pg.code === "42P01" || pg.code === "3F000") return "sin_foro" // aún no se crean las tablas
  return "error"
}
