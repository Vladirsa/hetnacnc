import { Pool } from "pg"

// Actividad de un taller en el foro, para su tablero.
//
// El foro NO vive en la base de Medusa: corre en el storefront con su propio
// esquema "foro" en otra base (HETNA_FORO_DB, que es la misma que usa
// apps/storefront/src/lib/foro/db.ts). Por eso aquí se abre una conexión
// aparte en vez de pedirle la suya al contenedor.
//
// El puente entre los dos mundos es foro.perfiles.vendedor_id, donde se guarda
// el id del vendedor en el marketplace cuando el perfil del foro pertenece a
// un taller.
//
// Todo lo de aquí DEGRADA: si no hay base configurada, si las tablas no se han
// creado o si Supabase tarda, el tablero debe seguir saliendo sin el bloque de
// foro. Un taller no se queda sin ver sus ventas porque el foro ande caído.

export type ForoActividad = {
  disponible: boolean
  usuario: string | null
  reputacion: number
  temas: number
  respuestas: number
  votos_recibidos: number
  mejores_respuestas: number
  // Razón por la que no hay datos, para poder decirlo en pantalla en vez de
  // enseñar ceros que parecen reales. "sin_abrir" y "error" se separan a
  // propósito: el foro todavía sin estrenar no es una falla pasajera, y
  // decirle al taller "vuelve más tarde" sería mandarlo a esperar algo que
  // no va a cambiar solo.
  motivo?: "sin_configurar" | "sin_abrir" | "sin_perfil" | "error"
}

const VACIO: ForoActividad = {
  disponible: false,
  usuario: null,
  reputacion: 0,
  temas: 0,
  respuestas: 0,
  votos_recibidos: 0,
  mejores_respuestas: 0,
}

const g = globalThis as unknown as { __hetnaForoPoolApi?: Pool }

const urlForo = () => process.env.HETNA_FORO_DB || process.env.HETNA_TALLER_DB || ""

const pool = (): Pool => {
  if (!g.__hetnaForoPoolApi) {
    g.__hetnaForoPoolApi = new Pool({
      connectionString: urlForo(),
      max: 3,
      idleTimeoutMillis: 30_000,
      // El tablero se arma con varias consultas en paralelo; si el foro no
      // responde pronto preferimos enseñarlo sin ese bloque.
      connectionTimeoutMillis: 4_000,
      statement_timeout: 4_000,
    })
    g.__hetnaForoPoolApi.on("error", (e) => console.error("[foro] base", e.message))
  }
  return g.__hetnaForoPoolApi
}

export async function actividadEnForo(sellerId: string): Promise<ForoActividad> {
  if (!urlForo()) {
    return { ...VACIO, motivo: "sin_configurar" }
  }

  try {
    const { rows } = await pool().query<{
      usuario: string
      reputacion: number
      temas: string
      respuestas: string
      votos_temas: string
      votos_respuestas: string
      mejores: string
    }>(
      `select p.usuario,
              p.reputacion,
              (select count(*) from foro.temas t
                 where t.autor_id = p.id and t.estado = 'publicado')      as temas,
              (select count(*) from foro.respuestas r
                 where r.autor_id = p.id and r.estado = 'publicado')      as respuestas,
              (select coalesce(sum(t.votos), 0) from foro.temas t
                 where t.autor_id = p.id and t.estado = 'publicado')      as votos_temas,
              (select coalesce(sum(r.votos), 0) from foro.respuestas r
                 where r.autor_id = p.id and r.estado = 'publicado')      as votos_respuestas,
              (select count(*) from foro.temas t
                 join foro.respuestas r on r.id = t.mejor_respuesta_id
                where r.autor_id = p.id)                                  as mejores
         from foro.perfiles p
        where p.vendedor_id = $1
        limit 1`,
      [sellerId]
    )

    const fila = rows[0]
    if (!fila) {
      // El taller existe pero todavía no se hizo perfil en el foro. Eso no es
      // un error: es justo lo que hay que decirle para que entre.
      return { ...VACIO, disponible: true, motivo: "sin_perfil" }
    }

    return {
      disponible: true,
      usuario: fila.usuario,
      reputacion: Number(fila.reputacion) || 0,
      temas: Number(fila.temas) || 0,
      respuestas: Number(fila.respuestas) || 0,
      votos_recibidos: (Number(fila.votos_temas) || 0) + (Number(fila.votos_respuestas) || 0),
      mejores_respuestas: Number(fila.mejores) || 0,
    }
  } catch (e) {
    if (foroSinEstrenar(e)) {
      return { ...VACIO, motivo: "sin_abrir" }
    }
    console.error("[tablero] foro:", e instanceof Error ? e.message : e)
    return { ...VACIO, motivo: "error" }
  }
}

// El esquema "foro" todavía no se ha creado en la base. Es el mismo caso que
// el storefront llama "sin_foro" y pinta como "El foro abre muy pronto":
// 42P01 es tabla inexistente y 3F000 esquema inexistente.
function foroSinEstrenar(e: unknown): boolean {
  const codigo = (e as { code?: string })?.code
  return codigo === "42P01" || codigo === "3F000"
}

// Reputación de todos los talleres que tienen perfil, para el ranking.
// Devuelve un mapa seller_id -> puntos de foro. Si el foro no está disponible
// devuelve un mapa vacío y el ranking se calcula sin esa dimensión.
export async function reputacionDeTalleres(): Promise<Map<string, number>> {
  const mapa = new Map<string, number>()
  if (!urlForo()) return mapa

  try {
    const { rows } = await pool().query<{ vendedor_id: string; reputacion: number }>(
      `select vendedor_id, reputacion
         from foro.perfiles
        where vendedor_id is not null`
    )
    for (const fila of rows) {
      mapa.set(fila.vendedor_id, Number(fila.reputacion) || 0)
    }
  } catch (e) {
    // Mientras el foro no se estrene esto falla en CADA carga del tablero de
    // CADA taller. Loguearlo llenaría el log de una línea que no es noticia.
    if (!foroSinEstrenar(e)) {
      console.error("[tablero] reputaciones del foro:", e instanceof Error ? e.message : e)
    }
  }
  return mapa
}
