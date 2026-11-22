// @ts-nocheck
// Tablero de ventas de la semana (lunes temprano, por Telegram y correo): qué se
// vendió, qué publicaciones trajeron visitas y dinero, y qué herramientas se
// usan más, comparado con la semana anterior. Sirve para decidir qué impulsar.
// Cada bloque se calcula por separado: si uno falla (tabla que aún no existe),
// los demás salen igual.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ventasPorPublicacion } from "./social-estadisticas"
import { CAMPOS_PAGO, pedidoPagado } from "./pago-pedido"

const DIA = 864e5
const pagada = (o: any) => pedidoPagado(o)

export type Tablero = {
  desde: string
  ventas: { pedidos: number; ingresos: number; antes_pedidos: number; antes_ingresos: number } | null
  creditos: { compras: number; vendidos: number; gastados: number; antes_compras: number } | null
  disenos: { total: number; antes: number; por_herramienta: { herramienta: string; n: number }[] } | null
  publicaciones: { clics: number; pagos: number; ingresos: number; top: { titulo: string; clics: number; pagos: number; ingresos: number }[] } | null
}

async function intento<T>(f: () => Promise<T>, logger?: any): Promise<T | null> {
  try {
    return await f()
  } catch (e) {
    logger?.warn?.(`[tablero-ventas] ${(e as Error).message}`)
    return null
  }
}

export async function calcularTablero(scope: any, logger?: any, ahora = Date.now()): Promise<Tablero> {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const ini = new Date(ahora - 7 * DIA), ant = new Date(ahora - 14 * DIA)

  const ventas = await intento(async () => {
    const { data } = await query.graph({ entity: "order", fields: ["id", "total", "created_at", ...CAMPOS_PAGO], filters: { created_at: { $gte: ant } } })
    const r = { pedidos: 0, ingresos: 0, antes_pedidos: 0, antes_ingresos: 0 }
    for (const o of data || []) {
      if (!pagada(o)) continue
      const esta = new Date(o.created_at) >= ini
      r[esta ? "pedidos" : "antes_pedidos"]++
      r[esta ? "ingresos" : "antes_ingresos"] += Number(o.total) || 0
    }
    return r
  }, logger)

  const creditos = await intento(async () => {
    const { rows } = await knex.raw(
      `select
         count(*) filter (where type = 'compra' and created_at >= ?) as compras,
         coalesce(sum(amount) filter (where type = 'compra' and created_at >= ?), 0) as vendidos,
         coalesce(-sum(amount) filter (where type = 'consumo' and created_at >= ?), 0) as gastados,
         count(*) filter (where type = 'compra' and created_at < ?) as antes_compras
       from credit_ledger_entry where deleted_at is null and created_at >= ?`,
      [ini, ini, ini, ini, ant]
    )
    const f = rows[0] || {}
    return { compras: Number(f.compras) || 0, vendidos: Number(f.vendidos) || 0, gastados: Number(f.gastados) || 0, antes_compras: Number(f.antes_compras) || 0 }
  }, logger)

  const disenos = await intento(async () => {
    if (!(await knex.schema.hasTable("hetna_disenos"))) return null
    const { rows } = await knex.raw(
      `select coalesce(herramienta, 'otro') as herramienta, count(*) filter (where creado >= ?) as n, count(*) filter (where creado < ?) as antes
       from hetna_disenos where creado >= ? group by 1`,
      [ini, ini, ant]
    )
    const por = rows.map((r: any) => ({ herramienta: r.herramienta, n: Number(r.n) || 0 })).filter((r: any) => r.n).sort((a: any, b: any) => b.n - a.n)
    return { total: por.reduce((s: number, r: any) => s + r.n, 0), antes: rows.reduce((s: number, r: any) => s + (Number(r.antes) || 0), 0), por_herramienta: por }
  }, logger)

  const publicaciones = await intento(async () => {
    const v = await ventasPorPublicacion(knex, 7)
    return { clics: v.totales.clics, pagos: v.totales.pagos, ingresos: v.totales.ingresos, top: v.publicaciones.slice(0, 3).map((p: any) => ({ titulo: p.titulo || "(sin título)", clics: p.clics, pagos: p.pagos, ingresos: p.ingresos })) }
  }, logger)

  return { desde: ini.toISOString().slice(0, 10), ventas, creditos, disenos, publicaciones }
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`
const cambio = (a: number, b: number) => (a > b ? `▲ +${a - b}` : a < b ? `▼ ${a - b}` : "= igual")
const NOMBRES: Record<string, string> = { cocina: "Cocina integral", mueble: "Muebles", moldura: "Molduras y tallados" }
const nombre = (h: string) => NOMBRES[h] || h

/** Texto para Telegram (sin HTML) con lo que conviene impulsar. */
export function textoTablero(t: Tablero) {
  const l: string[] = [`📊 Tablero de la semana (desde ${t.desde})`, ""]
  if (t.ventas) l.push(`🛒 Tienda: ${t.ventas.pedidos} pedidos pagados · ${pesos(t.ventas.ingresos)} (${cambio(t.ventas.pedidos, t.ventas.antes_pedidos)} vs semana pasada)`)
  if (t.creditos) l.push(`🎟 Créditos: ${t.creditos.compras} compras · ${t.creditos.vendidos} vendidos · ${t.creditos.gastados} usados (${cambio(t.creditos.compras, t.creditos.antes_compras)} compras)`)
  if (t.disenos) {
    l.push(`📐 Diseños guardados: ${t.disenos.total} (${cambio(t.disenos.total, t.disenos.antes)})`)
    for (const h of t.disenos.por_herramienta.slice(0, 4)) l.push(`   · ${nombre(h.herramienta)}: ${h.n}`)
  }
  if (t.publicaciones) {
    l.push("", `📣 Publicaciones: ${t.publicaciones.clics} clics · ${t.publicaciones.pagos} pagos · ${pesos(t.publicaciones.ingresos)}`)
    t.publicaciones.top.forEach((p, i) => l.push(`   ${i + 1}. ${p.titulo.slice(0, 60)} — ${p.clics} clics${p.pagos ? ` · ${p.pagos} pagos` : ""}`))
  }
  const consejo = consejoTablero(t)
  if (consejo) l.push("", `💡 ${consejo}`)
  return l.join("\n")
}

/** Una recomendación sencilla a partir de los números. */
export function consejoTablero(t: Tablero) {
  const top = t.publicaciones?.top?.[0]
  if (top && (top.pagos || top.clics >= 20)) return `Impulsa «${top.titulo.slice(0, 50)}»: fue la que más ${top.pagos ? "vendió" : "visitas trajo"}. Puedes aprobarla como anuncio en Social Hub.`
  const h = t.disenos?.por_herramienta?.[0]
  if (h && h.n >= 3) return `${nombre(h.herramienta)} es la herramienta más usada: conviene publicar más sobre ella esta semana.`
  if (t.ventas && t.ventas.pedidos < t.ventas.antes_pedidos) return "Bajaron los pedidos: revisa que el carrito abandonado y las promociones estén prendidos."
  return ""
}

export function htmlTablero(t: Tablero, panel: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
<h2 style="margin:0 0 12px">Tablero de ventas · semana desde ${t.desde}</h2>
<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;line-height:1.55;margin:0">${textoTablero(t).split("\n").slice(2).join("\n").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c])}</pre>
<p style="margin:18px 0 0"><a href="${panel}" style="background:#C2560A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700;font-size:13px">Abrir Social Hub</a></p>
</div>`
}
