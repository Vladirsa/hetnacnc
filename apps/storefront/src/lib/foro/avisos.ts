// Crear avisos de la campana del foro (solo servidor). Los llaman las acciones
// después de que algo ya pasó: si fallan (por ejemplo, la base todavía no
// tiene la migración del 31 de octubre), lo demás sigue igual.
//
// El correo no sale de aquí: el backend junta cada 10 minutos los avisos que
// siguen sin leer y los manda en un solo correo (ver jobs/foro-avisos.ts).

import { db } from "./db"
import type { TipoAviso } from "./tipos"

export type NuevoAviso = {
  para: string | string[] // ids de perfil
  actor?: string | null // quién lo provocó (no se le avisa a sí mismo)
  tipo: TipoAviso
  texto: string
  url: string // dentro del foro: /foro-cnc/...
}

export async function avisar(a: NuevoAviso) {
  const ids = Array.from(new Set(Array.isArray(a.para) ? a.para : [a.para])).filter(
    (id) => id && /^[0-9a-f-]{36}$/.test(id) && id !== a.actor
  )
  if (!ids.length) return
  const url = /^\/foro-cnc[A-Za-z0-9/#?=&_.-]*$/.test(a.url) ? a.url : ""
  try {
    await db().query(
      `insert into foro.avisos (perfil_id, actor_id, tipo, texto, url)
       select x, $2, $3, $4, $5 from unnest($1::uuid[]) as x`,
      [ids, a.actor || null, a.tipo, a.texto.slice(0, 300), url]
    )
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code !== "42P01" && code !== "42703") console.error("[foro avisos]", (e as Error).message)
  }
}

// Perfiles del foro ligados a un taller (para avisarle al taller)
export async function perfilesDeTaller(vendedorId: string): Promise<string[]> {
  try {
    const { rows } = await db().query(`select id from foro.perfiles where vendedor_id = $1 and suspendido = false`, [vendedorId])
    return rows.map((f: { id: string }) => f.id)
  } catch {
    return []
  }
}
