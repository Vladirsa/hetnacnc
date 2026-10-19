// Lee qué temas/respuestas marcó la persona como "No útil" (solo servidor).
// Si la tabla aún no existe, devuelve vacío y el foro sigue funcionando.

import { db, foroConfigurado } from "./db"

export async function misNoUtiles(perfilId: string, temaId: number): Promise<{ tema: boolean; respuestas: number[] }> {
  if (!foroConfigurado()) return { tema: false, respuestas: [] }
  try {
    const { rows } = await db().query(
      `select exists (select 1 from foro.no_utiles where perfil_id = $1 and tema_id = $2) as tema,
        (select coalesce(array_agg(n.respuesta_id), '{}') from foro.no_utiles n
           join foro.respuestas r on r.id = n.respuesta_id
           where n.perfil_id = $1 and r.tema_id = $2) as respuestas`,
      [perfilId, temaId]
    )
    return { tema: Boolean(rows[0]?.tema), respuestas: (rows[0]?.respuestas || []).map(Number) }
  } catch (e) {
    console.error("[foro] no_utiles", (e as Error).message)
    return { tema: false, respuestas: [] }
  }
}
