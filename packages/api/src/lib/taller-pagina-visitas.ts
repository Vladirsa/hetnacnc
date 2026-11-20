// Estadísticas del cotizador en línea de cada taller (estrategia 2.3):
// visitas a hetnacnc.com/t/<slug> y al widget que el taller pega en su página
// web o Facebook (/embed/t/<slug>), por día, más las solicitudes que llegaron.
// Las visitas viven en la base de Medusa; las solicitudes, en la del Cotizador.
import { supa } from "./cotizador-suscripciones"

export const T_VISITA_PAGINA = "hetna_taller_pagina_visita"
const ORIGENES = ["pagina", "widget"] as const
const slugValido = (s: string) => /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(String(s || ""))

let lista = false
async function asegurar(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_VISITA_PAGINA))) {
    await knex.schema.createTable(T_VISITA_PAGINA, (t: any) => {
      t.text("slug").notNullable()
      t.date("dia").notNullable()
      t.text("origen").notNullable() // pagina | widget
      t.integer("n").notNullable().defaultTo(0)
      t.primary(["slug", "dia", "origen"])
    })
  }
  lista = true
}

export async function registrarVisitaPagina(knex: any, slug: string, origen: string) {
  if (!slugValido(slug)) return
  const o = (ORIGENES as readonly string[]).includes(origen) ? origen : "pagina"
  await asegurar(knex)
  await knex.raw(
    `insert into ${T_VISITA_PAGINA} (slug, dia, origen, n) values (?, current_date, ?, 1)
     on conflict (slug, dia, origen) do update set n = ${T_VISITA_PAGINA}.n + 1`,
    [slug, o]
  )
}

export type EstadisticasPagina = { dias: number; visitas: number; widget: number; solicitudes: number; conversion_pct: number | null }

/** Últimos `dias` días: visitas a la página, al widget y solicitudes recibidas. */
export async function estadisticasPagina(knex: any, slug: string, negocioId: string, dias = 30): Promise<EstadisticasPagina> {
  const vacio = { dias, visitas: 0, widget: 0, solicitudes: 0, conversion_pct: null }
  if (!slugValido(slug)) return vacio
  await asegurar(knex)
  const filas = await knex(T_VISITA_PAGINA)
    .where({ slug })
    .whereRaw(`dia >= current_date - (? * interval '1 day')`, [dias])
    .select("origen")
    .sum({ n: "n" })
    .groupBy("origen")
  const por = Object.fromEntries(filas.map((f: any) => [f.origen, Number(f.n || 0)]))
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString()
  const sol = await supa<any[]>(`/rest/v1/solicitudes_en_linea?negocio_id=eq.${negocioId}&creado=gte.${desde}&select=id&limit=5000`).catch(() => [])
  const visitas = por.pagina || 0
  const widget = por.widget || 0
  const total = visitas + widget
  return { dias, visitas, widget, solicitudes: sol.length, conversion_pct: total ? Math.round((sol.length / total) * 1000) / 10 : null }
}
