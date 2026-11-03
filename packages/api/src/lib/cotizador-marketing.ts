// @ts-nocheck
// Marketing del Cotizador en piloto automático.
//
// Cada taller prende "recetas" en la app (Marketing → Automático). Todos los
// días a las 11:07 (Ciudad de México) este archivo revisa sus cotizaciones,
// pedidos y clientes y, a quien le toca:
//   · le manda un CORREO solo (sale con el nombre del taller; las respuestas
//     le llegan al correo del taller; lleva liga de baja), y
//   · deja el WHATSAPP listo en "Cola de hoy" para mandarlo con un toque
//     (WhatsApp no deja que una app mande mensajes sola sin la API de Meta).
// marketing_envios guarda qué se mandó para no repetir nunca el mismo mensaje
// y para los números de "Resultados".
//
// Recetas:
//   seguimiento_cotizacion  N días después de mandar una cotización sin respuesta
//   ultimo_aviso            N días antes de que venza
//   anticipo_pendiente      aceptó pero no ha pagado el anticipo
//   gracias_resena          pedido entregado: gracias + liga para reseña
//   reactivacion            cliente que no compra hace N días (con cupón opcional)
//
// Variables en los mensajes: *NOMBRE* *FOLIO* *MONTO* *LIGA* *TALLER*
// *ANTICIPO* *VENCE* *CUPON* *RESENA*. Si una variable queda vacía, el renglón
// que la tiene se quita (p. ej. sin cupón no sale la línea del cupón).
//
// Sólo para planes con Marketing (Pro, Industrial, prueba vigente, master),
// igual que lib/services/planes.dart de la app.
import { anticipoDe } from "./cotizacion-liga"
import { ligaBaja, estaDeBaja } from "./baja"
import { adminDesdeToken, ErrorSuscripcion, supa } from "./cotizador-suscripciones"
import { sendEmail } from "./resend"

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")
const TOPE_CORREOS = Number(process.env.COTIZADOR_MARKETING_TOPE || 200) // por corrida, todos los talleres
const TOPE_TALLER = Number(process.env.COTIZADOR_MARKETING_TOPE_TALLER || 40) // por taller y día
export const marketingCotizadorApagado = () => (process.env.COTIZADOR_MARKETING || "").toLowerCase() === "off"

type Campo = { clave: string; tipo: "numero" | "texto" | "url"; etiqueta: string; ayuda?: string; min?: number; max?: number }
export type Receta = {
  clave: string
  titulo: string
  descripcion: string
  asunto: string
  mensaje: string
  recomendada: boolean
  config: Record<string, any>
  campos: Campo[]
}

export const RECETAS: Receta[] = [
  {
    clave: "seguimiento_cotizacion",
    titulo: "Seguimiento de cotización",
    descripcion: "Unos días después de mandar una cotización que no han aceptado, le recuerda al cliente con la liga para verla, aceptarla y pagar.",
    asunto: "Tu cotización *FOLIO* de *TALLER*",
    mensaje:
      "Hola *NOMBRE* 👋 ¿Pudiste revisar la cotización *FOLIO* por *MONTO*?\n\nAquí la puedes ver, aceptar y pagar el anticipo: *LIGA*\n\nCualquier duda o ajuste, con gusto te ayudamos. — *TALLER*",
    recomendada: true,
    config: { dias: 3 },
    campos: [{ clave: "dias", tipo: "numero", etiqueta: "Días después de mandarla", min: 1, max: 30 }],
  },
  {
    clave: "ultimo_aviso",
    titulo: "Último aviso antes de vencer",
    descripcion: "Cuando a una cotización sin aceptar le quedan pocos días de vigencia, avisa que está por vencer.",
    asunto: "Tu cotización *FOLIO* vence el *VENCE*",
    mensaje:
      "Hola *NOMBRE*, te aviso que la cotización *FOLIO* por *MONTO* vence el *VENCE*. Después tendríamos que revisar precios de nuevo.\n\nPuedes aceptarla aquí: *LIGA*\n\n— *TALLER*",
    recomendada: true,
    config: { dias_antes: 2 },
    campos: [{ clave: "dias_antes", tipo: "numero", etiqueta: "Días antes de que venza", min: 1, max: 15 }],
  },
  {
    clave: "anticipo_pendiente",
    titulo: "Anticipo pendiente",
    descripcion: "Si el cliente aceptó pero no ha pagado el anticipo, se lo recuerda con la liga de pago.",
    asunto: "Anticipo de tu pedido *FOLIO*",
    mensaje:
      "Hola *NOMBRE* 😊 Gracias por aceptar la cotización *FOLIO*. Para arrancar con tu trabajo solo falta el anticipo de *ANTICIPO*.\n\nLo puedes pagar en línea aquí: *LIGA*\n\n— *TALLER*",
    recomendada: true,
    config: { dias: 2 },
    campos: [{ clave: "dias", tipo: "numero", etiqueta: "Días después de aceptar", min: 1, max: 15 }],
  },
  {
    clave: "gracias_resena",
    titulo: "Gracias y reseña",
    descripcion: "Unos días después de entregar, da las gracias y pide una reseña (Google, Facebook o la que pongas).",
    asunto: "¡Gracias por tu compra, *NOMBRE*!",
    mensaje:
      "¡Hola *NOMBRE*! Gracias por confiar en *TALLER* para tu pedido *FOLIO* 🙌\n\nSi te gustó el trabajo, ¿nos ayudas con una reseña? Nos toma un minuto y nos ayuda muchísimo: *RESENA*\n\nAquí seguimos para lo que necesites.",
    recomendada: true,
    config: { dias: 2, resena_url: "" },
    campos: [
      { clave: "dias", tipo: "numero", etiqueta: "Días después de entregar", min: 1, max: 30 },
      { clave: "resena_url", tipo: "url", etiqueta: "Liga para dejar reseña (opcional)", ayuda: "Tu perfil de Google Maps o Facebook. Sin liga, el mensaje solo da las gracias." },
    ],
  },
  {
    clave: "reactivacion",
    titulo: "Reactivar clientes",
    descripcion: "A los clientes que no te compran hace tiempo, les escribe para volver a cotizar, con un cupón si quieres.",
    asunto: "*NOMBRE*, ¿tienes un nuevo proyecto?",
    mensaje:
      "Hola *NOMBRE* 👋 Hace tiempo no trabajamos juntos y queríamos saludarte de parte de *TALLER*.\n\nSi tienes un nuevo proyecto, mándanos tu archivo o medidas y te cotizamos rápido.\nTienes un descuento con el cupón *CUPON* 🎁\n\n¡Saludos!",
    recomendada: false,
    config: { dias: 90, cupon: "" },
    campos: [
      { clave: "dias", tipo: "numero", etiqueta: "Días sin comprar", min: 30, max: 365 },
      { clave: "cupon", tipo: "texto", etiqueta: "Cupón (opcional)", ayuda: "Escribe el código de uno de tus cupones. Sin cupón, el mensaje no lo menciona." },
    ],
  },
]
const POR_CLAVE = Object.fromEntries(RECETAS.map((r) => [r.clave, r]))

const PLANES_CON_MARKETING = ["pro", "premium", "industrial", "master"]
export const tieneMarketing = (n) =>
  PLANES_CON_MARKETING.includes(String(n?.plan || "")) ||
  (["trial", "prueba"].includes(String(n?.plan || "")) && n?.trial_hasta && new Date(n.trial_hasta) > new Date())

// ── Utilidades ─────────────────────────────────────────────────────────
const DIA = 86_400_000
const hace = (dias: number) => new Date(Date.now() - dias * DIA).toISOString()
const hoyMx = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })
const fechaLarga = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" })
const dinero = (n: number, moneda: string) =>
  `$${Number(n || 0).toLocaleString(moneda === "USD" ? "en-US" : "es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${moneda === "USD" ? " USD" : ""}`
const primerNombre = (s: string) => String(s || "").trim().split(/\s+/)[0] || ""
const correoValido = (c: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(c || "").trim())
const ligaCot = (token: string | null) => (token ? `${SITIO}/c/${token}` : "")
const numero = (v, def: number, min: number, max: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}
const esc = (s: string) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

/** Pone las variables; quita los renglones cuya variable quedó vacía. */
export function armar(plantilla: string, vars: Record<string, string>) {
  return String(plantilla || "")
    .split("\n")
    .filter((linea) => {
      const usadas = [...linea.matchAll(/\*([A-ZÑ]+)\*/g)].map((m) => m[1]).filter((v) => v in vars)
      return usadas.every((v) => String(vars[v] || "").trim() !== "")
    })
    .join("\n")
    .replace(/\*([A-ZÑ]+)\*/g, (todo, v) => (v in vars ? vars[v] : todo))
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function htmlCorreo(texto: string, taller: string, liga: string, logo: string | null) {
  const cuerpo = esc(texto)
    .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#C2560A">$1</a>')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${p.replace(/\n/g, "<br>")}</p>`)
    .join("")
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1B1B18">
  ${logo ? `<img src="${esc(logo)}" alt="${esc(taller)}" style="max-height:56px;max-width:180px;margin:0 0 16px">` : `<p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#142033">${esc(taller)}</p>`}
  ${cuerpo}
  ${liga ? `<a href="${esc(liga)}" style="display:inline-block;margin:6px 0 4px;background:#C2560A;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Ver cotización</a>` : ""}
  <p style="margin:22px 0 0;font-size:12px;color:#7A776E">Te escribe ${esc(taller)}. Puedes responder a este correo.</p>
</div>`
}

// ── Lectura (llave de servicio) ────────────────────────────────────────
async function intentar<T>(fn: () => Promise<T>, def: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return def
  }
}

async function datosTaller(negocioId: string) {
  const [neg, cfg] = await Promise.all([
    supa<any[]>(`/rest/v1/negocios?id=eq.${negocioId}&select=id,nombre,plan,trial_hasta&limit=1`),
    intentar(
      () => supa<any[]>(`/rest/v1/configuracion_empresa?negocio_id=eq.${negocioId}&select=nombre_comercial,correo,logo_url,moneda&limit=1`),
      null
    ).then((r) => r ?? intentar(() => supa<any[]>(`/rest/v1/configuracion_empresa?negocio_id=eq.${negocioId}&select=nombre_comercial,correo,logo_url&limit=1`), [])),
  ])
  const n = neg[0]
  const c = cfg?.[0] || {}
  return n
    ? {
        negocio: n,
        nombre: c.nombre_comercial || n.nombre || "Tu taller",
        correo: correoValido(c.correo) ? String(c.correo).trim() : null,
        logo: c.logo_url || null,
        moneda: String(c.moneda || "MXN").toUpperCase() === "USD" ? "USD" : "MXN",
      }
    : null
}

async function clientes(ids: string[]) {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (!unicos.length) return new Map()
  const filas = await supa<any[]>(`/rest/v1/clientes?id=in.(${unicos.join(",")})&select=id,nombre,correo,whatsapp,telefono`)
  return new Map(filas.map((c) => [c.id, c]))
}

const CAMPOS_COT =
  "id,folio,total,cliente_id,token_publico,estado,fecha_envio_wa,liga_vista_en,vigencia_dias,created_at,aceptada_en,anticipo_monto,anticipo_pagado,anticipo_estado,metodo_pago"
const venceEl = (c) => new Date(new Date(c.created_at).getTime() + Number(c.vigencia_dias || 7) * DIA)

type Candidato = { clienteId: string; referencia: string; vars: Record<string, string>; liga: string }

async function candidatos(negocioId: string, receta: string, cfg: Record<string, any>, t): Promise<Candidato[]> {
  const base = (c) => ({ FOLIO: c.folio || "", MONTO: dinero(c.total, t.moneda), LIGA: ligaCot(c.token_publico) })
  switch (receta) {
    case "seguimiento_cotizacion": {
      const dias = numero(cfg.dias, 3, 1, 30)
      const filas = await supa<any[]>(
        `/rest/v1/cotizaciones?negocio_id=eq.${negocioId}&aceptada_en=is.null&estado=in.(Enviada,Borrador)` +
          `&created_at=lt.${hace(dias)}&created_at=gt.${hace(dias + 10)}&select=${CAMPOS_COT}&limit=200`
      )
      return filas
        .filter((c) => c.cliente_id && (c.estado === "Enviada" || c.fecha_envio_wa || c.liga_vista_en) && venceEl(c) > new Date())
        .map((c) => ({ clienteId: c.cliente_id, referencia: `${c.id}:seguimiento`, vars: base(c), liga: ligaCot(c.token_publico) }))
    }
    case "ultimo_aviso": {
      const antes = numero(cfg.dias_antes, 2, 1, 15)
      const filas = await supa<any[]>(
        `/rest/v1/cotizaciones?negocio_id=eq.${negocioId}&aceptada_en=is.null&estado=in.(Enviada,Borrador)` +
          `&created_at=lt.${hace(1)}&created_at=gt.${hace(60)}&select=${CAMPOS_COT}&limit=300`
      )
      const ahora = Date.now()
      return filas
        .filter((c) => {
          if (!c.cliente_id || !(c.estado === "Enviada" || c.fecha_envio_wa || c.liga_vista_en)) return false
          const resta = venceEl(c).getTime() - ahora
          return resta > 0 && resta <= antes * DIA
        })
        .map((c) => ({
          clienteId: c.cliente_id,
          referencia: `${c.id}:vence`,
          vars: { ...base(c), VENCE: fechaLarga(venceEl(c)) },
          liga: ligaCot(c.token_publico),
        }))
    }
    case "anticipo_pendiente": {
      const dias = numero(cfg.dias, 2, 1, 15)
      const filas = await supa<any[]>(
        `/rest/v1/cotizaciones?negocio_id=eq.${negocioId}&aceptada_en=lt.${hace(dias)}&aceptada_en=gt.${hace(dias + 20)}` +
          `&anticipo_estado=eq.pendiente&estado=neq.Rechazada&select=${CAMPOS_COT}&limit=200`
      )
      return filas
        .map((c) => ({ c, anticipo: anticipoDe(c) - Number(c.anticipo_pagado || 0) }))
        .filter(({ c, anticipo }) => c.cliente_id && anticipo > 0)
        .map(({ c, anticipo }) => ({
          clienteId: c.cliente_id,
          referencia: `${c.id}:anticipo`,
          vars: { ...base(c), ANTICIPO: dinero(anticipo, t.moneda) },
          liga: ligaCot(c.token_publico),
        }))
    }
    case "gracias_resena": {
      const dias = numero(cfg.dias, 2, 1, 30)
      const pedidos = await supa<any[]>(
        `/rest/v1/pedidos?negocio_id=eq.${negocioId}&estado=eq.Entregado&updated_at=lt.${hace(dias)}&updated_at=gt.${hace(dias + 7)}` +
          `&select=id,folio,cliente_id,cotizacion_id&limit=200`
      )
      const resena = /^https:\/\/\S+$/i.test(String(cfg.resena_url || "")) ? String(cfg.resena_url) : ""
      return pedidos
        .filter((p) => p.cliente_id)
        .map((p) => ({ clienteId: p.cliente_id, referencia: `${p.id}:gracias`, vars: { FOLIO: p.folio || "", RESENA: resena }, liga: "" }))
    }
    case "reactivacion": {
      const dias = numero(cfg.dias, 90, 30, 365)
      const pedidos = await supa<any[]>(`/rest/v1/pedidos?negocio_id=eq.${negocioId}&estado=neq.Cancelado&select=cliente_id,created_at&limit=5000`)
      const ultimo = new Map<string, number>()
      for (const p of pedidos) {
        if (!p.cliente_id) continue
        const f = new Date(p.created_at).getTime()
        if (!ultimo.has(p.cliente_id) || f > ultimo.get(p.cliente_id)) ultimo.set(p.cliente_id, f)
      }
      const limite = Date.now() - dias * DIA
      // Un mensaje por cliente cada 120 días como máximo
      const periodo = `react:${Math.floor(Date.now() / (120 * DIA))}`
      const cupon = String(cfg.cupon || "").trim().toUpperCase().slice(0, 30)
      return [...ultimo.entries()]
        .filter(([, f]) => f < limite)
        .slice(0, 25)
        .map(([clienteId]) => ({ clienteId, referencia: periodo, vars: { CUPON: cupon }, liga: "" }))
    }
  }
  return []
}

/** Anota el envío; true si es la primera vez (si ya existía, no se repite). */
async function reservar(negocioId: string, receta: string, clienteId: string, referencia: string) {
  const filas = await supa<any[]>(`/rest/v1/marketing_envios?on_conflict=negocio_id,receta,cliente_id,referencia`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ negocio_id: negocioId, receta, cliente_id: clienteId, referencia }),
  })
  return filas?.[0]?.id || null
}

async function aCola(negocioId: string, receta: string, clienteId: string, mensaje: string, titulo: string) {
  const fila = {
    cliente_id: clienteId,
    mensaje_final: mensaje,
    campana: `🤖 ${titulo}`,
    fecha_programada: hoyMx(),
    estado: "pendiente",
    negocio_id: negocioId,
    receta,
  }
  try {
    await supa(`/rest/v1/cola_mensajes_wa`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(fila) })
  } catch {
    const { negocio_id, receta: _r, ...sin } = fila
    await supa(`/rest/v1/cola_mensajes_wa`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(sin) })
  }
}

type Totales = { talleres: number; whatsapp: number; correos: number }

/** Corre las recetas activas (de todos los talleres o de uno). */
export async function correrMarketingCotizador(knex: any, logger?: any, soloNegocio?: string): Promise<Totales> {
  const tot: Totales = { talleres: 0, whatsapp: 0, correos: 0 }
  const filtro = soloNegocio ? `&negocio_id=eq.${soloNegocio}` : ""
  const activas = await supa<any[]>(`/rest/v1/marketing_recetas?activa=eq.true${filtro}&select=*`)
  const porTaller = new Map<string, any[]>()
  for (const r of activas) {
    if (!POR_CLAVE[r.receta]) continue
    porTaller.set(r.negocio_id, [...(porTaller.get(r.negocio_id) || []), r])
  }

  let correosGlobal = 0
  for (const [negocioId, recetas] of porTaller) {
    const t = await intentar(() => datosTaller(negocioId), null)
    if (!t || !tieneMarketing(t.negocio)) continue
    tot.talleres++
    let usados = 0
    for (const r of recetas) {
      const def = POR_CLAVE[r.receta]
      const cfg = { ...def.config, ...(r.config || {}) }
      let lista: Candidato[] = []
      try {
        lista = await candidatos(negocioId, r.receta, cfg, t)
      } catch (e) {
        logger?.warn?.(`[cotizador-marketing] ${negocioId} ${r.receta}: ${(e as Error).message}`)
        continue
      }
      if (!lista.length) continue
      const mapa = await clientes(lista.map((x) => x.clienteId))
      for (const cand of lista) {
        if (usados >= TOPE_TALLER) break
        const cli = mapa.get(cand.clienteId)
        if (!cli) continue
        const whats = String(cli.whatsapp || cli.telefono || "").replace(/\D/g, "")
        const correo = correoValido(cli.correo) ? String(cli.correo).trim().toLowerCase() : ""
        const quiereWa = r.whatsapp !== false && whats.length >= 10
        const quiereCorreo = r.correo !== false && correo && correosGlobal < TOPE_CORREOS && !(await estaDeBaja(knex, correo))
        if (!quiereWa && !quiereCorreo) continue

        const envioId = await reservar(negocioId, r.receta, cand.clienteId, cand.referencia).catch(() => null)
        if (!envioId) continue // ya se le mandó esto antes
        usados++

        const vars = { NOMBRE: primerNombre(cli.nombre), TALLER: t.nombre, ...cand.vars }
        const texto = armar(String(r.mensaje || "").trim() || def.mensaje, vars)
        const marcas: Record<string, boolean> = {}

        if (quiereWa) {
          try {
            await aCola(negocioId, r.receta, cand.clienteId, texto, def.titulo)
            marcas.whatsapp = true
            tot.whatsapp++
          } catch (e) {
            logger?.warn?.(`[cotizador-marketing] cola WA ${negocioId}: ${(e as Error).message}`)
          }
        }
        if (quiereCorreo) {
          const res = await sendEmail({
            to: correo,
            subject: armar(def.asunto, vars).replace(/\*/g, ""),
            html: htmlCorreo(texto, t.nombre, cand.liga, t.logo),
            bajaUrl: ligaBaja(correo),
            de: t.nombre,
            responderA: t.correo || undefined,
          }).catch((e) => ({ sent: false, reason: (e as Error).message }))
          if (res.sent) {
            marcas.correo = true
            tot.correos++
            correosGlobal++
          } else {
            logger?.warn?.(`[cotizador-marketing] correo ${negocioId}: ${res.reason}`)
          }
        }
        if (Object.keys(marcas).length) {
          await supa(`/rest/v1/marketing_envios?id=eq.${envioId}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(marcas),
          }).catch(() => {})
        } else {
          // No salió por ningún lado: se borra la reserva para reintentar mañana
          await supa(`/rest/v1/marketing_envios?id=eq.${envioId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {})
        }
      }
    }
  }
  return tot
}

// ── Lo que usa la app (sesión de Supabase del administrador) ───────────
/** Taller del administrador con plan y fin de prueba (adminDesdeToken no trae trial_hasta). */
async function tallerDe(sesion: string | undefined) {
  const { negocio } = await adminDesdeToken(sesion)
  const filas = await supa<any[]>(`/rest/v1/negocios?id=eq.${negocio.id}&select=id,plan,trial_hasta&limit=1`)
  return filas[0] || negocio
}

export async function recetasDelTaller(sesion: string | undefined) {
  const negocio = await tallerDe(sesion)
  const guardadas = await intentar(() => supa<any[]>(`/rest/v1/marketing_recetas?negocio_id=eq.${negocio.id}&select=*`), null)
  const g = new Map((guardadas || []).map((r) => [r.receta, r]))
  return {
    permitido: tieneMarketing(negocio),
    // false = falta correr supabase/paypal_y_marketing.sql
    tabla_lista: guardadas !== null,
    recetas: RECETAS.map((d) => {
      const r = g.get(d.clave)
      return {
        clave: d.clave,
        titulo: d.titulo,
        descripcion: d.descripcion,
        recomendada: d.recomendada,
        mensaje_sugerido: d.mensaje,
        campos: d.campos,
        activa: Boolean(r?.activa),
        mensaje: r?.mensaje || "",
        correo: r ? r.correo !== false : true,
        whatsapp: r ? r.whatsapp !== false : true,
        config: { ...d.config, ...(r?.config || {}) },
      }
    }),
  }
}

export async function guardarReceta(sesion: string | undefined, b: Record<string, any>) {
  const negocio = await tallerDe(sesion)
  const def = POR_CLAVE[String(b.receta || "")]
  if (!def) throw new ErrorSuscripcion("Esa automatización no existe.")
  if (b.activa === true && !tieneMarketing(negocio))
    throw new ErrorSuscripcion("El marketing automático es del plan Pro o superior.", 402)
  const config = { ...def.config }
  for (const campo of def.campos) {
    const v = b.config?.[campo.clave]
    if (v === undefined) continue
    if (campo.tipo === "numero") config[campo.clave] = numero(v, def.config[campo.clave], campo.min ?? 0, campo.max ?? 365)
    else if (campo.tipo === "url") {
      const u = String(v || "").trim()
      if (u && !/^https:\/\/\S+$/i.test(u)) throw new ErrorSuscripcion("La liga debe empezar con https://")
      config[campo.clave] = u.slice(0, 300)
    } else config[campo.clave] = String(v || "").trim().slice(0, 60)
  }
  const fila: Record<string, any> = { negocio_id: negocio.id, receta: def.clave, config, actualizado: new Date().toISOString() }
  if (typeof b.activa === "boolean") fila.activa = b.activa
  if (typeof b.correo === "boolean") fila.correo = b.correo
  if (typeof b.whatsapp === "boolean") fila.whatsapp = b.whatsapp
  if (typeof b.mensaje === "string") {
    const m = b.mensaje.trim().slice(0, 1500)
    fila.mensaje = m === def.mensaje ? null : m || null
  }
  await supa(`/rest/v1/marketing_recetas?on_conflict=negocio_id,receta`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(fila),
  })
  return { ok: true }
}

const ultimaCorrida = new Map<string, number>()
export async function correrAhora(knex: any, sesion: string | undefined, logger?: any) {
  const negocio = await tallerDe(sesion)
  if (!tieneMarketing(negocio)) throw new ErrorSuscripcion("El marketing automático es del plan Pro o superior.", 402)
  const antes = ultimaCorrida.get(negocio.id) || 0
  if (Date.now() - antes < 10 * 60_000) throw new ErrorSuscripcion("Ya se revisó hace unos minutos. Intenta en un rato.", 429)
  ultimaCorrida.set(negocio.id, Date.now())
  return correrMarketingCotizador(knex, logger, negocio.id)
}
