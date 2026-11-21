// Tablero de la estrategia de liderazgo (docs/estrategia-liderazgo-mundial.md,
// "Cómo sabremos que somos los mejores"): los indicadores en una sola pantalla
// del panel, con la comparación contra los 30 días anteriores.
import { resumenCampanaPrecios } from "./campana-precios-talleres"
import { conteoLatam } from "./latam"
import { T_PROPUESTA, T_SOLICITUD } from "./licitacion"
import { capacidadVigente } from "./capacidad-libre"

const DIA = 86_400_000
const r1 = (x: number) => Math.round(x * 10) / 10

export function medianaHoras(xs: number[]): number | null {
  if (!xs.length) return null
  const o = xs.slice().sort((a, b) => a - b)
  const k = Math.floor(o.length / 2)
  return r1(o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2)
}

/** % de entregas a tiempo de la red: puntualidad de cada taller ponderada por sus entregas con fecha. */
export function puntualidadRed(perfiles: any[]): { pct: number | null; entregas: number } {
  let a = 0
  let n = 0
  for (const p of perfiles) {
    const m = p?.medido
    const con = Number(m?.con_fecha || 0)
    if (con > 0 && typeof m?.puntualidad_pct === "number") {
      a += (m.puntualidad_pct / 100) * con
      n += con
    }
  }
  return { pct: n ? Math.round((a / n) * 100) : null, entregas: n }
}

async function periodo(knex: any, desde: Date, hasta: Date) {
  const sols = (await knex(T_SOLICITUD)
    .where("created_at", ">=", desde)
    .where("created_at", "<", hasta)
    .whereRaw("coalesce(tipo, 'fabricacion') <> 'suministro'")
    .select("id", "created_at", "trabajo")
    .catch(() => knex(T_SOLICITUD).where("created_at", ">=", desde).where("created_at", "<", hasta).select("id", "created_at", "trabajo"))) as any[]
  const ids = sols.map((s) => s.id)
  const primeras = ids.length
    ? ((await knex(T_PROPUESTA).whereIn("solicitud_id", ids).groupBy("solicitud_id").select("solicitud_id").min({ primera: "created_at" })) as any[])
    : []
  const creada = new Map(sols.map((s) => [s.id, new Date(s.created_at).getTime()]))
  const horas = primeras.map((p) => (new Date(p.primera).getTime() - (creada.get(p.solicitud_id) || 0)) / 3_600_000).filter((h) => h >= 0)
  const talleresActivos = (await knex(T_PROPUESTA).where("created_at", ">=", desde).where("created_at", "<", hasta).countDistinct({ n: "seller_id" }).first()) as any
  // Revisión del archivo: viaja en "medidas_archivo" ("revisión: …" o "archivo revisado sin problemas")
  const conArchivo = sols.filter((s) => String(s.trabajo?.medidas_archivo || "").length > 0)
  const conProblema = conArchivo.filter((s) => /revisi[oó]n:/i.test(String(s.trabajo?.medidas_archivo || "")))
  return {
    solicitudes: sols.length,
    con_propuesta: primeras.length,
    horas_primera_propuesta: medianaHoras(horas),
    talleres_activos: Number(talleresActivos?.n || 0),
    archivos_revisados: conArchivo.length,
    archivos_con_problema: conProblema.length,
  }
}

export async function tableroEstrategia(knex: any) {
  const ahora = Date.now()
  const [actual, anterior] = await Promise.all([
    periodo(knex, new Date(ahora - 30 * DIA), new Date(ahora)),
    periodo(knex, new Date(ahora - 60 * DIA), new Date(ahora - 30 * DIA)),
  ])
  const sellers = (await knex("seller").whereNull("deleted_at").select("metadata")) as { metadata: any }[]
  const perfiles = sellers.map((s) => s.metadata?.perfil || {})
  const red = puntualidadRed(perfiles)
  const [precios, latam] = await Promise.all([resumenCampanaPrecios(knex).catch(() => null), conteoLatam(knex).catch(() => ({}))])
  const paises = Object.entries(latam as Record<string, { talleres: number; clientes: number }>)
    .map(([pais, c]) => ({ pais, ...c }))
    .sort((a, b) => b.talleres + b.clientes - (a.talleres + a.clientes))
  return {
    actual,
    anterior,
    red: {
      talleres: sellers.length,
      puntualidad_pct: red.pct,
      entregas_con_fecha: red.entregas,
      con_capacidad_libre: sellers.filter((s) => capacidadVigente(s.metadata)).length,
      con_precios: precios?.con_precios ?? null,
      campana_precios: precios,
    },
    latam: paises,
    metas: { puntualidad_pct: 95, horas_primera_propuesta: 0.5, archivos_detectados_pct: 95 },
  }
}
