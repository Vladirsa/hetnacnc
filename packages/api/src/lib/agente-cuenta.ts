// @ts-nocheck
// Lo que el Agente de WhatsApp sabe de la cuenta de quien le escribe (pedido de
// Vlado, 27 nov 2026: «que vea todo»). Con esto el Agente:
//   - motiva al taller a dejar su perfil al 100 % (qué le falta y la liga),
//   - le recuerda al cliente su carrito olvidado (con la liga),
//   - le dice cuántas propuestas tiene cada solicitud abierta (con la liga).
// Sólo datos de ESA persona: el número verificado (hetna_whatsapp) o el que
// escribió en sus solicitudes. Nunca datos de otros.
import { STORE_URL, T_PROPUESTA, T_SOLICITUD, folioTexto, ligaPropuestas } from "./licitacion"
import { faltantesPerfil } from "./datos-faltantes"
import { NOMBRE_ETAPA, etapaDe } from "./seguimiento"
import { T_WA } from "./whatsapp"

const LIGA_PANEL = `${STORE_URL}/seller`
const LIGA_PERFIL = `${STORE_URL}/seller/perfil-taller`
const LIGA_CARRITO = `${STORE_URL}/mx/cart`

export type Cuenta = {
  taller?: { nombre: string; verificado: boolean; faltan: string[]; recibe: boolean } | null
  carrito?: { productos: string[] } | null
  solicitudes?: { folio: string; etapa: string; propuestas: number; liga: string }[]
}

async function hay(knex: any, t: string) {
  return knex.schema.hasTable(t).catch(() => false)
}

export async function leerCuenta(knex: any, numero: string): Promise<Cuenta> {
  const c: Cuenta = {}
  const wa = (await hay(knex, T_WA)) ? await knex(T_WA).where({ numero }).whereNotNull("verificado_en").first("seller_id", "customer_id").catch(() => null) : null

  if (wa?.seller_id) {
    const v = await knex("seller").where({ id: wa.seller_id }).whereNull("deleted_at").first("name", "metadata").catch(() => null)
    if (v) {
      const m = (typeof v.metadata === "string" ? JSON.parse(v.metadata || "{}") : v.metadata) || {}
      c.taller = {
        nombre: v.name,
        verificado: m.verificado === true || m.verificado === "true",
        faltan: faltantesPerfil(m.perfil),
        recibe: m.recibe_solicitudes !== false,
      }
    }
  }

  if (wa?.customer_id) {
    const items = (await knex("cart as c")
      .join("cart_line_item as i", "i.cart_id", "c.id")
      .where("c.customer_id", wa.customer_id)
      .whereNull("c.completed_at")
      .whereNull("c.deleted_at")
      .whereNull("i.deleted_at")
      .where("c.updated_at", ">=", knex.raw("now() - interval '14 days'"))
      .orderBy("c.updated_at", "desc")
      .limit(5)
      .select("i.title")
      .catch(() => [])) as { title: string }[]
    if (items.length) c.carrito = { productos: [...new Set(items.map((i) => i.title))].slice(0, 3) }
  }

  if (await hay(knex, T_SOLICITUD)) {
    const sols = (await knex(T_SOLICITUD)
      .whereNotIn("estado", ["cerrada", "cancelada"])
      .where("created_at", ">=", knex.raw("now() - interval '45 days'"))
      .where((w: any) => {
        w.whereRaw("contacto->>'whatsapp' in (?, ?)", [numero, numero.slice(2)])
        if (wa?.customer_id) w.orWhere("cliente_id", wa.customer_id)
      })
      .orderBy("created_at", "desc")
      .limit(3)
      .select("*")
      .catch(() => [])) as any[]
    const n = sols.length
      ? ((await knex(T_PROPUESTA).whereIn("solicitud_id", sols.map((s) => s.id)).groupBy("solicitud_id").select("solicitud_id").count("* as n").catch(() => [])) as any[])
      : []
    const por = Object.fromEntries(n.map((x) => [x.solicitud_id, Number(x.n)]))
    c.solicitudes = sols.map((s) => ({ folio: folioTexto(s.folio), etapa: NOMBRE_ETAPA[etapaDe(s, por[s.id] || 0)] || s.estado, propuestas: por[s.id] || 0, liga: ligaPropuestas(s.token) }))
  }
  return c
}

/** El bloque que se le agrega al Agente. Vacío si no sabemos nada de su cuenta. */
export function textoCuenta(c: Cuenta) {
  const l: string[] = []
  if (c.taller) {
    l.push(
      `Es el taller «${c.taller.nombre}» registrado en HETNA (${c.taller.verificado ? "verificado" : "sin verificar"}${c.taller.recibe ? "" : "; tiene pausado «Recibiendo solicitudes»"}).`
    )
    l.push(
      c.taller.faltan.length
        ? `A su perfil le falta: ${c.taller.faltan.join(", ")}. Liga para completarlo: ${LIGA_PERFIL}`
        : `Su perfil está completo. Su panel: ${LIGA_PANEL}`
    )
  }
  if (c.carrito) l.push(`Tiene un carrito sin terminar con: ${c.carrito.productos.join(", ")}. Liga: ${LIGA_CARRITO}`)
  for (const s of c.solicitudes || [])
    l.push(`Solicitud ${s.folio}: ${s.etapa}, ${s.propuestas} ${s.propuestas === 1 ? "propuesta" : "propuestas"}. Liga para verlas: ${s.liga}`)
  if (!l.length) return ""
  return (
    "\n\nSu cuenta en HETNA (sólo de esta persona; úsalo para ayudarle, una cosa por mensaje y cuando encaje en la plática):\n- " +
    l.join("\n- ") +
    "\nCómo usarlo: si es taller con perfil incompleto, motívalo a dejarlo al 100 % (sale en los filtros y páginas de su estado y le llegan más solicitudes que encajan con lo que hace) y dale la liga; si tiene carrito, ofrécele ayuda para terminar la compra con la liga; si una solicitud tiene propuestas, díselo con la liga para compararlas; si tiene pausado recibir solicitudes, pregúntale si quiere reactivarlo desde su panel. No lo menciones todo de golpe ni repitas lo que ya le dijiste."
  )
}
