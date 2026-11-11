// Distribuidores y referidos del Cotizador (supabase/referidos.sql de la app).
//
//   · codigos_promo: códigos que HETNA da a distribuidores de máquinas o para
//     promociones ("BAJIO90" = 90 días de HETNA Taller). El taller nuevo lo
//     escribe en la app (o entra por hetnacnc.com/distribuidores/<código>) y
//     recibe esos días de prueba.
//   · negocios.meses_a_favor: meses ganados por referidos por talleres que YA
//     pagan. La app no los puede aplicar sola (el cobro lo lleva Mercado Pago),
//     así que se ven aquí y HETNA los marca como aplicados.
//   · Solicitudes de distribuidor: el formulario de hetnacnc.com/distribuidores
//     las guarda aquí (base de Medusa); se atienden desde el panel y el código
//     se le manda por correo desde HETNA. Nada de WhatsApp: todo dentro.
//
// Códigos y meses van por la llave de servicio de Supabase del Cotizador (supa()).
import { correosDeLaCasa } from "./cuentas-casa"
import { supa } from "./cotizador-crm"
import { sendEmail } from "./resend"

export type CodigoPromo = {
  codigo: string
  nombre: string
  dias_regalo: number
  activo: boolean
  usos: number
  max_usos: number | null
  vence: string | null
  created_at: string | null
}

const CODIGO = /^[A-Z0-9]{4,24}$/

export class ErrorDistribuidor extends Error {
  constructor(msg: string, public status = 400) { super(msg) }
}

const sinTabla = (e: unknown) => /codigos_promo|does not exist|42P01|PGRST205|referido|meses_a_favor/i.test((e as Error)?.message || "")

/** Público: lo que necesita la página del distribuidor. null si no existe o ya no vale. */
export async function codigoPublico(codigoCrudo: string) {
  const codigo = String(codigoCrudo || "").trim().toUpperCase()
  if (!CODIGO.test(codigo)) return null
  try {
    const [c] = await supa<CodigoPromo[]>(`/rest/v1/codigos_promo?codigo=eq.${codigo}&select=*&limit=1`)
    if (!c || !c.activo) return null
    if (c.vence && new Date(c.vence + "T23:59:59") < new Date()) return null
    if (c.max_usos != null && c.usos >= c.max_usos) return null
    return { codigo: c.codigo, nombre: c.nombre, dias: c.dias_regalo }
  } catch (e) {
    if (sinTabla(e)) return null
    throw e
  }
}

/** Panel: códigos, talleres con meses a favor y resumen de referidos. */
export async function panelDistribuidores() {
  let instalado = true
  const [codigos, conMeses, referidos] = await Promise.all([
    supa<CodigoPromo[]>(`/rest/v1/codigos_promo?select=*&order=created_at.desc&limit=500`).catch((e): CodigoPromo[] => { if (sinTabla(e)) { instalado = false; return [] } throw e }),
    supa<any[]>(`/rest/v1/negocios?select=id,nombre,correo,telefono,plan,meses_a_favor&meses_a_favor=gt.0&order=meses_a_favor.desc&limit=500`).catch((e): any[] => { if (sinTabla(e)) { instalado = false; return [] } throw e }),
    supa<any[]>(`/rest/v1/negocios?select=id,nombre,referido_por,referido_codigo,referido_premio,created_at&referido_codigo=not.is.null&order=created_at.desc&limit=2000`).catch((e): any[] => { if (sinTabla(e)) { instalado = false; return [] } throw e }),
  ])

  // Quién invitó a quién (talleres que más invitan)
  const ids = Array.from(new Set(referidos.map((r) => r.referido_por).filter(Boolean)))
  const nombres = new Map<string, string>()
  if (ids.length) {
    const filas = await supa<any[]>(`/rest/v1/negocios?select=id,nombre&id=in.(${ids.map(encodeURIComponent).join(",")})`).catch(() => [])
    for (const f of filas) nombres.set(f.id, f.nombre)
  }
  const porTaller = new Map<string, { id: string; nombre: string; invitados: number; completaron: number }>()
  for (const r of referidos) {
    if (!r.referido_por) continue
    const t = porTaller.get(r.referido_por) || { id: r.referido_por, nombre: nombres.get(r.referido_por) || "Taller", invitados: 0, completaron: 0 }
    t.invitados++
    if (r.referido_premio) t.completaron++
    porTaller.set(r.referido_por, t)
  }
  const codigosSet = new Set(codigos.map((c) => c.codigo))
  return {
    instalado,
    codigos,
    meses_a_favor: conMeses.map((n) => ({ id: n.id, nombre: n.nombre, correo: n.correo, telefono: n.telefono, plan: n.plan, meses: n.meses_a_favor })),
    referidos: {
      por_taller: [...porTaller.values()].sort((a, b) => b.invitados - a.invitados).slice(0, 50),
      por_distribuidor: referidos.filter((r) => !r.referido_por && codigosSet.has(r.referido_codigo)).length,
      total: referidos.filter((r) => r.referido_por).length,
      completaron: referidos.filter((r) => r.referido_por && r.referido_premio).length,
      ultimos: referidos.slice(0, 20).map((r) => ({
        nombre: r.nombre, codigo: r.referido_codigo, fecha: r.created_at,
        de: r.referido_por ? nombres.get(r.referido_por) || "Taller" : (codigos.find((c) => c.codigo === r.referido_codigo)?.nombre || "Distribuidor"),
        completo: !!r.referido_premio,
      })),
    },
  }
}

/** Panel: crear, activar/desactivar o marcar un mes a favor como aplicado. */
export async function accionDistribuidores(b: any) {
  const accion = String(b?.accion || "")
  if (accion === "crear") {
    const codigo = String(b.codigo || "").trim().toUpperCase()
    const nombre = String(b.nombre || "").trim().slice(0, 80)
    const dias = Math.round(Number(b.dias) || 0)
    const max = b.max_usos === "" || b.max_usos == null ? null : Math.round(Number(b.max_usos))
    const vence = b.vence ? String(b.vence).slice(0, 10) : null
    if (!CODIGO.test(codigo)) throw new ErrorDistribuidor("El código debe tener de 4 a 24 letras o números, sin espacios.")
    if (!nombre) throw new ErrorDistribuidor("Escribe el nombre del distribuidor o la promoción.")
    if (dias < 1 || dias > 365) throw new ErrorDistribuidor("Los días de regalo van de 1 a 365.")
    if (max != null && (!Number.isFinite(max) || max < 1)) throw new ErrorDistribuidor("El tope de usos debe ser 1 o más (o vacío para sin tope).")
    if (vence && !/^\d{4}-\d{2}-\d{2}$/.test(vence)) throw new ErrorDistribuidor("Fecha de vencimiento inválida.")
    // Que no choque con el código de un taller
    const choca = await supa<any[]>(`/rest/v1/negocios?codigo_referido=eq.${codigo}&select=id&limit=1`).catch(() => [])
    if (choca.length) throw new ErrorDistribuidor("Ese código ya lo tiene un taller. Elige otro.")
    try {
      await supa(`/rest/v1/codigos_promo`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ codigo, nombre, dias_regalo: dias, max_usos: max, vence, activo: true }),
      })
    } catch (e) {
      if (/duplicate|23505/.test((e as Error).message)) throw new ErrorDistribuidor("Ese código ya existe.")
      throw e
    }
    return { ok: true, codigo }
  }
  if (accion === "activar" || accion === "desactivar") {
    const codigo = String(b.codigo || "").trim().toUpperCase()
    if (!CODIGO.test(codigo)) throw new ErrorDistribuidor("Código inválido.")
    await supa(`/rest/v1/codigos_promo?codigo=eq.${codigo}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ activo: accion === "activar" }),
    })
    return { ok: true }
  }
  if (accion === "mes_aplicado") {
    const id = String(b.negocio_id || "")
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErrorDistribuidor("Taller inválido.")
    const [n] = await supa<any[]>(`/rest/v1/negocios?id=eq.${id}&select=meses_a_favor&limit=1`)
    const actual = Number(n?.meses_a_favor) || 0
    if (actual < 1) throw new ErrorDistribuidor("Ese taller ya no tiene meses a favor.")
    // Sólo baja si nadie lo cambió mientras tanto
    await supa(`/rest/v1/negocios?id=eq.${id}&meses_a_favor=eq.${actual}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ meses_a_favor: actual - 1 }),
    })
    return { ok: true, quedan: actual - 1 }
  }
  throw new ErrorDistribuidor("Acción desconocida.")
}

// ── Solicitudes de distribuidor (formulario público) ──────────────────────
export const T_SOL_DIST = "hetna_distribuidor_solicitud"
let tablaLista = false
async function asegurarTabla(knex: any) {
  if (tablaLista) return
  if (!(await knex.schema.hasTable(T_SOL_DIST))) {
    await knex.schema.createTable(T_SOL_DIST, (t: any) => {
      t.increments("id").primary()
      t.text("empresa").notNullable()
      t.text("contacto").notNullable()
      t.text("correo").notNullable()
      t.text("telefono")
      t.text("ciudad")
      t.text("maquinas")
      t.text("ventas_mes")
      t.text("mensaje")
      t.text("estado").notNullable().defaultTo("nueva") // nueva | atendida | descartada
      t.text("codigo")
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("atendida_en", { useTz: true })
    })
  }
  tablaLista = true
}

const limpio = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n)
const CORREO = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/

// Freno simple por IP: 3 solicitudes por hora
const intentos = new Map<string, number[]>()
function excedido(ip: string) {
  const ahora = Date.now()
  const l = (intentos.get(ip) || []).filter((t) => ahora - t < 3600_000)
  l.push(ahora)
  intentos.set(ip, l)
  if (intentos.size > 5000) intentos.clear()
  return l.length > 3
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const STORE = (process.env.STOREFRONT_URL || process.env.STORE_URL || "https://hetnacnc.com").replace(/\/$/, "")

export async function guardarSolicitudDistribuidor(knex: any, b: any, ip: string) {
  if (limpio(b?.sitio_web, 200)) return { ok: true } // trampa para robots: se finge éxito
  if (excedido(ip || "?")) throw new ErrorDistribuidor("Ya recibimos tu solicitud. Te escribimos pronto.", 429)
  const s = {
    empresa: limpio(b?.empresa, 100),
    contacto: limpio(b?.contacto, 80),
    correo: limpio(b?.correo, 120).toLowerCase(),
    telefono: limpio(b?.telefono, 30),
    ciudad: limpio(b?.ciudad, 80),
    maquinas: limpio(b?.maquinas, 160),
    ventas_mes: limpio(b?.ventas_mes, 40),
    mensaje: limpio(b?.mensaje, 600),
  }
  if (s.empresa.length < 2) throw new ErrorDistribuidor("Escribe el nombre de tu empresa.")
  if (s.contacto.length < 2) throw new ErrorDistribuidor("Escribe tu nombre.")
  if (!CORREO.test(s.correo)) throw new ErrorDistribuidor("Escribe un correo válido: ahí te mandamos tu código.")
  if (!s.maquinas) throw new ErrorDistribuidor("Dinos qué máquinas vendes.")
  await asegurarTabla(knex)
  await knex(T_SOL_DIST).insert(s)

  // Aviso interno a HETNA (correo); el distribuidor recibe confirmación.
  const para = String(process.env.CONTROL_AVISOS_PARA || correosDeLaCasa()[0] || "").split(",").map((x) => x.trim()).filter(Boolean)
  const filas = Object.entries(s).filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:4px 10px 4px 0;color:#666">${k}</td><td style="padding:4px 0"><b>${esc(String(v))}</b></td></tr>`).join("")
  for (const to of para) {
    await sendEmail({ to, subject: `Nuevo distribuidor quiere su código: ${s.empresa}`, html: `<div style="font-family:Arial,sans-serif"><h3>Solicitud de distribuidor</h3><table>${filas}</table><p><a href="${STORE}/mx/panel/cotizador/distribuidores">Atenderla en el panel</a></p></div>` }).catch(() => null)
  }
  await sendEmail({
    to: s.correo,
    subject: "Recibimos tu solicitud de distribuidor HETNA",
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#222"><p>Hola ${esc(s.contacto)}:</p><p>Recibimos la solicitud de <b>${esc(s.empresa)}</b> para regalar HETNA Taller con las máquinas que vendes. En cuanto la revisemos te mandamos por este medio tu código y tu página propia en hetnacnc.com.</p><p>— Equipo HETNA CNC</p></div>`,
  }).catch(() => null)
  return { ok: true }
}

export async function solicitudesDistribuidor(knex: any) {
  try {
    await asegurarTabla(knex)
    return await knex(T_SOL_DIST).select("*").orderByRaw("case when estado = 'nueva' then 0 else 1 end").orderBy("created_at", "desc").limit(100)
  } catch {
    return []
  }
}

async function correoCodigo(sol: any, codigo: string, dias: number) {
  const pagina = `${STORE}/mx/distribuidores/${codigo}`
  await sendEmail({
    to: sol.correo,
    subject: `Tu código de distribuidor HETNA: ${codigo}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#222">
<p>Hola ${esc(sol.contacto)}:</p>
<p>Ya está listo el código de <b>${esc(sol.empresa)}</b>. Cada taller que lo use recibe <b>${dias} días de HETNA Taller</b> gratis.</p>
<p style="font-size:30px;font-weight:900;letter-spacing:4px;margin:18px 0">${codigo}</p>
<p>Tu página propia (puedes imprimirla como QR y entregarla con cada máquina):<br><a href="${pagina}">${pagina}</a></p>
<p>Desde ahí tu cliente se registra y el código se aplica solo. También puede escribirlo en la app, en Menú → Invitar a un taller.</p>
<p>— Equipo HETNA CNC</p></div>`,
  }).catch(() => null)
}

/** Acciones del panel sobre solicitudes: crear su código (y mandárselo) o descartar. */
export async function accionSolicitud(knex: any, b: any) {
  const id = Number(b?.solicitud_id)
  if (!Number.isInteger(id) || id < 1) throw new ErrorDistribuidor("Solicitud inválida.")
  await asegurarTabla(knex)
  const sol = await knex(T_SOL_DIST).where({ id }).first()
  if (!sol) throw new ErrorDistribuidor("No encontré esa solicitud.", 404)
  if (b.accion === "descartar") {
    await knex(T_SOL_DIST).where({ id }).update({ estado: "descartada", atendida_en: knex.fn.now() })
    return { ok: true }
  }
  // accion === "crear_para_solicitud"
  const r = await accionDistribuidores({ accion: "crear", codigo: b.codigo, nombre: b.nombre || sol.empresa, dias: b.dias, max_usos: b.max_usos, vence: b.vence })
  await knex(T_SOL_DIST).where({ id }).update({ estado: "atendida", codigo: r.codigo, atendida_en: knex.fn.now() })
  await correoCodigo(sol, r.codigo!, Math.round(Number(b.dias) || 0))
  return { ok: true, codigo: r.codigo }
}
