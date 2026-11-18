// Calendarios para Google Calendar (suscripción por URL, sólo lectura).
//
// 1. Taller del Cotizador: entregas de sus pedidos, sus citas y los
//    mantenimientos que tocan. La app pide su liga con
//      GET /api/cotizador-calendario   (sesión de Supabase del taller)
//    y el calendario vive en
//      GET /api/calendario/taller/<negocioId>/<firma>.ics
// 2. HETNA (el dueño): pedidos de la tienda, cierres de licitaciones, entregas
//    y hitos de producción. Liga en el Dashboard (GET /admin/hetna-calendario):
//      GET /api/calendario/hetna/<firma>.ics
//
// Las ligas van firmadas con CALENDARIO_SECRET (o JWT_SECRET): nadie puede
// adivinar la de otro taller. Quien tenga la liga ve el calendario, así que
// se trata como contraseña. Para cambiarlas todas, se cambia CALENDARIO_SECRET.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { armarIcs, firmar, firmaValida, uidDe, type EventoIcs } from "./calendario-ics"
import { ErrorSuscripcion, supa } from "./cotizador-suscripciones"

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")
const API = (process.env.COTIZADOR_API_URL || `${SITIO}/api`).replace(/\/$/, "")
const supaUrl = () => (process.env.COTIZADOR_SUPABASE_URL || "https://ldfmkfbhcbsbecfbzsny.supabase.co").replace(/\/$/, "")
const supaKey = () => process.env.COTIZADOR_SUPABASE_SERVICE_KEY || ""
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DIA = 86_400_000

const dinero = (n: unknown) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const hoyMenos = (dias: number) => new Date(Date.now() - dias * DIA).toISOString().slice(0, 10)
const soloDia = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

async function intentar<T>(fn: () => Promise<T>, def: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return def
  }
}

/** Ligas para suscribirse: https, webcal y el botón de Google. */
function ligas(url: string) {
  const webcal = url.replace(/^https?:\/\//, "webcal://")
  return { url, webcal, google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}` }
}

// ── 1. Taller ───────────────────────────────────────────────────────────
async function miembroDesdeToken(token: string | undefined) {
  if (!token) throw new ErrorSuscripcion("Inicia sesión en el Cotizador.", 401)
  const r = await fetch(`${supaUrl()}/auth/v1/user`, {
    headers: { apikey: supaKey(), Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) throw new ErrorSuscripcion("Tu sesión expiró. Vuelve a iniciar sesión.", 401)
  const user = (await r.json()) as { id: string }
  const filas = await supa<{ negocio_id: string }[]>(
    `/rest/v1/usuarios_negocio?user_id=eq.${user.id}&activo=eq.true&select=negocio_id&order=id.desc&limit=1`
  )
  if (!filas[0]) throw new ErrorSuscripcion("Tu cuenta no tiene taller.", 403)
  return filas[0].negocio_id
}

export async function ligaCalendarioTaller(token: string | undefined) {
  const negocioId = await miembroDesdeToken(token)
  let firma: string
  try {
    firma = firmar(`taller:${negocioId}`)
  } catch {
    throw new ErrorSuscripcion("El calendario se está activando. Intenta más tarde.", 503)
  }
  return ligas(`${API}/calendario/taller/${negocioId}/${firma}.ics`)
}

export async function eventosTaller(negocioId: string): Promise<{ nombre: string; eventos: EventoIcs[] }> {
  const desde = hoyMenos(120)
  const app = `${SITIO}/cotizador/`
  const [negocio, pedidos, citas, tareas] = await Promise.all([
    intentar(async () => (await supa<any[]>(`/rest/v1/negocios?id=eq.${negocioId}&select=nombre&limit=1`))[0] || null, null),
    intentar(
      () =>
        supa<any[]>(
          `/rest/v1/pedidos?negocio_id=eq.${negocioId}&or=(fecha_entrega_estimada.gte.${desde},fecha_entregado.gte.${desde})` +
            `&select=id,folio,estado,total,fecha_entrega_estimada,fecha_entregado,cliente_id&order=fecha_entrega_estimada.asc&limit=500`
        ),
      [] as any[]
    ),
    // Si la tabla no tiene negocio_id, se omite (nunca sin filtrar por taller)
    intentar(
      () =>
        supa<any[]>(
          `/rest/v1/citas?negocio_id=eq.${negocioId}&fecha_hora=gte.${hoyMenos(60)}` +
            `&select=id,titulo,descripcion,lugar,duracion_min,fecha_hora,estado,cliente_id&order=fecha_hora.asc&limit=500`
        ),
      [] as any[]
    ),
    intentar(
      () =>
        supa<any[]>(
          `/rest/v1/mantenimiento_tareas?negocio_id=eq.${negocioId}&activa=eq.true&cada_dias=not.is.null&select=id,nombre,cada_dias,ultima_fecha,maquina_id&limit=200`
        ),
      [] as any[]
    ),
  ])

  const idsClientes = [...new Set([...pedidos, ...citas].map((x) => x.cliente_id).filter(Boolean))]
  const clientes = idsClientes.length
    ? await intentar(() => supa<any[]>(`/rest/v1/clientes?negocio_id=eq.${negocioId}&id=in.(${idsClientes.join(",")})&select=id,nombre,empresa`), [] as any[])
    : []
  const cliente = new Map(clientes.map((c) => [c.id, c.empresa || c.nombre]))
  const idsMaquinas = [...new Set(tareas.map((t) => t.maquina_id).filter(Boolean))]
  const maquinas = idsMaquinas.length
    ? await intentar(() => supa<any[]>(`/rest/v1/maquinaria?id=in.(${idsMaquinas.join(",")})&select=id,nombre`), [] as any[])
    : []
  const maquina = new Map(maquinas.map((m) => [m.id, m.nombre]))

  const eventos: EventoIcs[] = []
  for (const p of pedidos) {
    if (p.estado === "Cancelado") continue
    const entregado = p.estado === "Entregado"
    const dia = soloDia(entregado ? p.fecha_entregado || p.fecha_entrega_estimada : p.fecha_entrega_estimada)
    if (!dia) continue
    const quien = cliente.get(p.cliente_id)
    eventos.push({
      uid: uidDe("pedido", p.id),
      dia,
      titulo: `${entregado ? "✅ Entregado" : "📦 Entrega"} ${p.folio || ""}${quien ? ` · ${quien}` : ""}`.trim(),
      descripcion: [`Pedido ${p.folio || ""} · ${p.estado}`, p.total ? `Total ${dinero(p.total)}` : "", `Ábrelo en el Cotizador: ${app}`].filter(Boolean).join("\n"),
      url: app,
    })
  }
  for (const c of citas) {
    if (c.estado === "Cancelada") continue
    // La app guarda la hora "de reloj" del taller: se toma tal cual
    const local = typeof c.fecha_hora === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(c.fecha_hora) ? c.fecha_hora.slice(0, 16) : null
    if (!local) continue
    const quien = cliente.get(c.cliente_id)
    eventos.push({
      uid: uidDe("cita", c.id),
      inicioLocal: local,
      minutos: Math.min(Math.max(Number(c.duracion_min) || 60, 15), 24 * 60),
      titulo: `📅 ${c.titulo || "Cita"}${quien ? ` · ${quien}` : ""}`,
      descripcion: [c.descripcion, c.estado ? `Estado: ${c.estado}` : ""].filter(Boolean).join("\n"),
      lugar: c.lugar || null,
      url: app,
    })
  }
  for (const t of tareas) {
    const base = soloDia(t.ultima_fecha)
    if (!base || !t.cada_dias) continue
    const d = new Date(`${base}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + Number(t.cada_dias))
    const nombreMaquina = maquina.get(t.maquina_id)
    eventos.push({
      uid: uidDe("mantenimiento", `${t.id}:${base}`),
      dia: d.toISOString().slice(0, 10),
      titulo: `🔧 ${t.nombre}${nombreMaquina ? ` · ${nombreMaquina}` : ""}`,
      descripcion: `Mantenimiento cada ${t.cada_dias} días. Regístralo en el Cotizador cuando lo hagas.`,
      url: app,
    })
  }
  return { nombre: `${negocio?.nombre || "Mi taller"} · Cotizador HETNA`, eventos }
}

export async function icsTaller(negocioId: string, firma: string) {
  if (!UUID.test(negocioId) || !firmaValida(`taller:${negocioId}`, firma)) throw new ErrorSuscripcion("Calendario no encontrado.", 404)
  const { nombre, eventos } = await eventosTaller(negocioId)
  return armarIcs(nombre, eventos, { descripcion: "Entregas, citas y mantenimientos del Cotizador HETNA" })
}

// ── 2. HETNA ────────────────────────────────────────────────────────────
export function ligaCalendarioHetna() {
  return ligas(`${API}/calendario/hetna/${firmar("hetna")}.ics`)
}

export async function eventosHetna(scope: any): Promise<EventoIcs[]> {
  const eventos: EventoIcs[] = []
  const panel = (process.env.ADMIN_PANEL_URL || `${SITIO}/dashboard`).replace(/\/$/, "")

  // Pedidos de la tienda (últimos 60 días), a la hora en que se hicieron
  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "created_at", "status", "currency_code", "total"],
      filters: { created_at: { $gte: new Date(Date.now() - 60 * DIA) } },
      pagination: { take: 500, order: { created_at: "DESC" } },
    })
    for (const o of (data || []) as any[]) {
      if (o.status === "canceled" || o.status === "draft") continue
      eventos.push({
        uid: uidDe("orden", o.id),
        inicio: new Date(o.created_at),
        minutos: 15,
        titulo: `🛒 Pedido tienda #${o.display_id}${o.total != null ? ` · ${dinero(o.total)} ${String(o.currency_code || "").toUpperCase()}` : ""}`,
        url: `${panel}/orders/${o.id}`,
      })
    }
  } catch {
    // sin pedidos: el resto del calendario sale igual
  }

  // Licitaciones: cierre de las abiertas, entrega prometida e hitos pendientes
  try {
    const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    if (await knex.schema.hasTable("hetna_solicitud")) {
      const solicitudes = (await knex("hetna_solicitud")
        .where("created_at", ">", new Date(Date.now() - 180 * DIA))
        .whereIn("estado", ["abierta", "elegida", "pagada"])
        .select("id", "folio", "estado", "trabajo", "cierra_en", "propuesta_elegida")
        .limit(500)) as any[]
      const elegidas = solicitudes.map((s) => s.propuesta_elegida).filter(Boolean)
      const propuestas = elegidas.length && (await knex.schema.hasTable("hetna_propuesta"))
        ? ((await knex("hetna_propuesta").whereIn("id", elegidas).select("id", "fecha_entrega")) as any[])
        : []
      const entrega = new Map(propuestas.map((p) => [p.id, p.fecha_entrega]))
      const hitos = solicitudes.length && (await knex.schema.hasTable("hetna_solicitud_hito"))
        ? ((await knex("hetna_solicitud_hito")
            .whereIn("solicitud_id", solicitudes.map((s) => s.id))
            .whereNotNull("fecha_plan")
            .whereNull("fecha_real")
            .select("id", "solicitud_id", "nombre", "fecha_plan")) as any[])
        : []
      const porId = new Map(solicitudes.map((s) => [s.id, s]))
      const servicio = (s: any) => (s.trabajo && typeof s.trabajo === "object" ? s.trabajo.servicio : null) || "trabajo"

      for (const s of solicitudes) {
        const url = `${panel}/solicitudes`
        if (s.estado === "abierta" && s.cierra_en) {
          eventos.push({ uid: uidDe("cierre", s.id), inicio: new Date(s.cierra_en), minutos: 30, titulo: `⏳ Cierra licitación #${s.folio} · ${servicio(s)}`, url })
        }
        const fe = s.propuesta_elegida ? entrega.get(s.propuesta_elegida) : null
        const dia = fe ? (fe instanceof Date ? fe.toISOString().slice(0, 10) : soloDia(String(fe))) : null
        if (dia) eventos.push({ uid: uidDe("entrega-lic", s.id), dia, titulo: `📦 Entrega licitación #${s.folio} · ${servicio(s)}`, url })
      }
      for (const h of hitos) {
        const s = porId.get(h.solicitud_id)
        const dia = h.fecha_plan instanceof Date ? h.fecha_plan.toISOString().slice(0, 10) : soloDia(String(h.fecha_plan))
        if (!s || !dia) continue
        eventos.push({ uid: uidDe("hito", h.id), dia, titulo: `🔩 ${h.nombre} · licitación #${s.folio}`, url: `${panel}/solicitudes` })
      }
    }
  } catch {
    // sin licitaciones: el resto sale igual
  }
  return eventos
}

export async function icsHetna(scope: any, firma: string) {
  if (!firmaValida("hetna", firma)) throw new ErrorSuscripcion("Calendario no encontrado.", 404)
  return armarIcs("HETNA · tienda y licitaciones", await eventosHetna(scope), { descripcion: "Pedidos de la tienda, cierres de licitaciones, entregas e hitos" })
}
