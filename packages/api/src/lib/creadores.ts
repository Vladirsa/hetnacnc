// Programa de creadores (estrategia 1.5, como SendCutSend o Inventables):
// youtubers, tiktokers e instructores de CNC con su código y su página
// hetnacnc.com/creadores/<código>.
//
//   · Su audiencia recibe días de HETNA Taller gratis: el código es un
//     codigos_promo del Cotizador (lib/distribuidores.ts), así que la app lo
//     aplica sola al registrarse con ?ref=<código>.
//   · El creador gana lo que HETNA defina por creador: meses gratis de su plan
//     por cada taller que llega a pagar y, si se decide, una comisión (%).
//     Por defecto 1 mes por taller pagando y 0 % de comisión (no se paga
//     dinero sin que el dueño lo ponga).
//   · Se mide: visitas a su página, talleres registrados con su código y los
//     que ya pagan. Las visitas se guardan en la base de Medusa.
//   · Solicitudes: el formulario de hetnacnc.com/creadores las guarda aquí y
//     se atienden desde Panel → App → Creadores.
import { accionDistribuidores, codigoPublico, ErrorDistribuidor } from "./distribuidores"
import { correosDeLaCasa } from "./cuentas-casa"
import { leerTalleres, pagaSuscripcion, supa } from "./cotizador-crm"
import { sendEmail } from "./resend"

export const T_CREADOR = "hetna_creador"
export const T_CREADOR_VISITA = "hetna_creador_visita"
export const T_CREADOR_SOL = "hetna_creador_solicitud"
export const REDES = ["youtube", "tiktok", "instagram", "facebook", "otra"] as const

let listas = false
export async function asegurarCreadores(knex: any) {
  if (listas) return
  if (!(await knex.schema.hasTable(T_CREADOR))) {
    await knex.schema.createTable(T_CREADOR, (t: any) => {
      t.text("codigo").primary()
      t.text("nombre").notNullable()
      t.text("red")
      t.text("canal_url")
      t.text("correo")
      t.text("mensaje") // lo que dice su página ("Yo uso HETNA para…")
      t.integer("dias_regalo").notNullable().defaultTo(30)
      t.integer("meses_por_taller").notNullable().defaultTo(1)
      t.decimal("comision_pct", 5, 2).notNullable().defaultTo(0)
      t.boolean("activo").notNullable().defaultTo(true)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasTable(T_CREADOR_VISITA))) {
    await knex.schema.createTable(T_CREADOR_VISITA, (t: any) => {
      t.text("codigo").notNullable()
      t.date("dia").notNullable()
      t.integer("n").notNullable().defaultTo(0)
      t.primary(["codigo", "dia"])
    })
  }
  if (!(await knex.schema.hasTable(T_CREADOR_SOL))) {
    await knex.schema.createTable(T_CREADOR_SOL, (t: any) => {
      t.increments("id").primary()
      t.text("nombre").notNullable()
      t.text("correo").notNullable()
      t.text("red")
      t.text("canal_url").notNullable()
      t.text("seguidores")
      t.text("mensaje")
      t.text("estado").notNullable().defaultTo("nueva") // nueva | atendida | descartada
      t.text("codigo")
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listas = true
}

const limpio = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n)
const CORREO = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/
const URL_OK = /^https:\/\/[^\s<>"]+$/i
const CODIGO = /^[A-Z0-9]{4,24}$/
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const STORE = (process.env.STOREFRONT_URL || process.env.STORE_URL || "https://hetnacnc.com").replace(/\/$/, "")
const red = (v: unknown) => ((REDES as readonly string[]).includes(String(v)) ? String(v) : "otra")

/** Público: lo que muestra la página del creador. null si no existe o está pausado. */
export async function creadorPublico(knex: any, codigoCrudo: string) {
  const codigo = String(codigoCrudo || "").trim().toUpperCase()
  if (!CODIGO.test(codigo)) return null
  await asegurarCreadores(knex)
  const c = await knex(T_CREADOR).where({ codigo, activo: true }).first()
  if (!c) return null
  const promo = await codigoPublico(codigo).catch(() => null)
  if (!promo) return null // el código del Cotizador se pausó, venció o se agotó
  return { codigo, nombre: c.nombre, red: c.red, canal_url: c.canal_url, mensaje: c.mensaje, dias: promo.dias }
}

/** Cuenta una visita a la página del creador (una fila por día). */
export async function registrarVisita(knex: any, codigoCrudo: string) {
  const codigo = String(codigoCrudo || "").trim().toUpperCase()
  if (!CODIGO.test(codigo)) return
  await asegurarCreadores(knex)
  const existe = await knex(T_CREADOR).where({ codigo }).first("codigo")
  if (!existe) return
  await knex.raw(
    `insert into ${T_CREADOR_VISITA} (codigo, dia, n) values (?, current_date, 1)
     on conflict (codigo, dia) do update set n = ${T_CREADOR_VISITA}.n + 1`,
    [codigo]
  )
}

export type ResumenCreador = {
  codigo: string
  nombre: string
  red: string | null
  canal_url: string | null
  correo: string | null
  dias_regalo: number
  meses_por_taller: number
  comision_pct: number
  activo: boolean
  visitas_30: number
  visitas: number
  registrados: number
  pagando: number
  meses_ganados: number
}

/** Cuenta registrados y pagando por código (pura, para probarla). */
export function contarPorCodigo(negocios: { id: string; referido_codigo: string | null }[], pagan: Set<string>) {
  const m = new Map<string, { registrados: number; pagando: number }>()
  for (const n of negocios) {
    const c = String(n.referido_codigo || "").toUpperCase()
    if (!c) continue
    const x = m.get(c) || { registrados: 0, pagando: 0 }
    x.registrados++
    if (pagan.has(n.id)) x.pagando++
    m.set(c, x)
  }
  return m
}

/** Panel: creadores con sus números, y solicitudes. */
export async function panelCreadores(knex: any) {
  await asegurarCreadores(knex)
  const [creadores, visitas, solicitudes] = await Promise.all([
    knex(T_CREADOR).select("*").orderBy("created_at", "desc"),
    knex(T_CREADOR_VISITA)
      .select("codigo")
      .sum({ total: "n" })
      .select(knex.raw(`sum(case when dia >= current_date - interval '30 days' then n else 0 end) as ultimos`))
      .groupBy("codigo"),
    knex(T_CREADOR_SOL).select("*").orderByRaw("case when estado = 'nueva' then 0 else 1 end").orderBy("created_at", "desc").limit(100),
  ])
  const codigos = creadores.map((c: any) => c.codigo)
  let porCodigo = new Map<string, { registrados: number; pagando: number }>()
  if (codigos.length) {
    const [negocios, talleres] = await Promise.all([
      supa<any[]>(`/rest/v1/negocios?select=id,referido_codigo&referido_codigo=in.(${codigos.map(encodeURIComponent).join(",")})&limit=5000`).catch(() => []),
      leerTalleres().catch(() => []),
    ])
    const pagan = new Set(talleres.filter((t: any) => pagaSuscripcion(t)).map((t: any) => t.id))
    porCodigo = contarPorCodigo(negocios, pagan)
  }
  const vis = new Map(visitas.map((v: any) => [v.codigo, { total: Number(v.total || 0), ultimos: Number(v.ultimos || 0) }]))
  const lista: ResumenCreador[] = creadores.map((c: any) => {
    const n = porCodigo.get(c.codigo) || { registrados: 0, pagando: 0 }
    const v = (vis.get(c.codigo) as any) || { total: 0, ultimos: 0 }
    return {
      codigo: c.codigo,
      nombre: c.nombre,
      red: c.red,
      canal_url: c.canal_url,
      correo: c.correo,
      dias_regalo: Number(c.dias_regalo),
      meses_por_taller: Number(c.meses_por_taller),
      comision_pct: Number(c.comision_pct),
      activo: !!c.activo,
      visitas_30: v.ultimos,
      visitas: v.total,
      registrados: n.registrados,
      pagando: n.pagando,
      meses_ganados: n.pagando * Number(c.meses_por_taller),
    }
  })
  return { creadores: lista, solicitudes }
}

async function correoBienvenida(c: { nombre: string; correo: string; codigo: string; dias: number; meses: number; comision: number }) {
  const pagina = `${STORE}/mx/creadores/${c.codigo}`
  const premio = [
    c.meses > 0 ? `<b>${c.meses} ${c.meses === 1 ? "mes" : "meses"} de HETNA Taller gratis</b> por cada taller que llegue con tu código y contrate un plan` : "",
    c.comision > 0 ? `<b>${c.comision}% de comisión</b> sobre su primer pago` : "",
  ].filter(Boolean).join(" y ")
  await sendEmail({
    to: c.correo,
    subject: `Ya eres creador HETNA: tu código ${c.codigo}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#222">
<p>Hola ${esc(c.nombre)}:</p>
<p>¡Bienvenido al programa de creadores de HETNA CNC! Tu audiencia recibe <b>${c.dias} días de HETNA Taller gratis</b> con tu código${premio ? `, y tú ganas ${premio}` : ""}.</p>
<p style="font-size:30px;font-weight:900;letter-spacing:4px;margin:18px 0">${c.codigo}</p>
<p>Tu página propia, para poner en la descripción de tus videos y en tu perfil:<br><a href="${pagina}">${pagina}</a></p>
<p>Ahí tu audiencia se registra y el código se aplica solo. Te mandaremos cada mes cuántas visitas, registros y talleres pagando llegaron por ti.</p>
<p>— Equipo HETNA CNC</p></div>`,
  }).catch(() => null)
}

/** Panel: crear, pausar/activar, cambiar premio o atender solicitudes. */
export async function accionCreadores(knex: any, b: any) {
  await asegurarCreadores(knex)
  const accion = String(b?.accion || "")
  if (accion === "crear" || accion === "crear_para_solicitud") {
    let sol: any = null
    if (accion === "crear_para_solicitud") {
      sol = await knex(T_CREADOR_SOL).where({ id: Number(b.solicitud_id) }).first()
      if (!sol) throw new ErrorDistribuidor("No encontré esa solicitud.", 404)
    }
    const codigo = String(b.codigo || "").trim().toUpperCase()
    const nombre = limpio(b.nombre || sol?.nombre, 80)
    const correo = limpio(b.correo || sol?.correo, 120).toLowerCase()
    const canal = limpio(b.canal_url || sol?.canal_url, 300)
    const dias = Math.round(Number(b.dias) || 30)
    const meses = Math.max(0, Math.min(12, Math.round(Number(b.meses_por_taller ?? 1))))
    const comision = Math.max(0, Math.min(50, Number(b.comision_pct) || 0))
    if (correo && !CORREO.test(correo)) throw new ErrorDistribuidor("Correo inválido.")
    if (canal && !URL_OK.test(canal)) throw new ErrorDistribuidor("La liga del canal debe empezar con https://")
    // El código del Cotizador (días para su audiencia) va primero: valida el código y que no choque
    await accionDistribuidores({ accion: "crear", codigo, nombre: `Creador: ${nombre}`, dias })
    await knex(T_CREADOR).insert({
      codigo,
      nombre,
      red: red(b.red || sol?.red),
      canal_url: canal || null,
      correo: correo || null,
      mensaje: limpio(b.mensaje, 280) || null,
      dias_regalo: dias,
      meses_por_taller: meses,
      comision_pct: comision,
    })
    if (sol) await knex(T_CREADOR_SOL).where({ id: sol.id }).update({ estado: "atendida", codigo })
    if (correo) await correoBienvenida({ nombre, correo, codigo, dias, meses, comision })
    return { ok: true, codigo }
  }
  if (accion === "descartar") {
    await knex(T_CREADOR_SOL).where({ id: Number(b.solicitud_id) }).update({ estado: "descartada" })
    return { ok: true }
  }
  const codigo = String(b.codigo || "").trim().toUpperCase()
  if (!CODIGO.test(codigo)) throw new ErrorDistribuidor("Código inválido.")
  if (accion === "activar" || accion === "pausar") {
    await accionDistribuidores({ accion: accion === "activar" ? "activar" : "desactivar", codigo })
    await knex(T_CREADOR).where({ codigo }).update({ activo: accion === "activar" })
    return { ok: true }
  }
  if (accion === "premio") {
    const meses = Math.max(0, Math.min(12, Math.round(Number(b.meses_por_taller) || 0)))
    const comision = Math.max(0, Math.min(50, Number(b.comision_pct) || 0))
    await knex(T_CREADOR).where({ codigo }).update({ meses_por_taller: meses, comision_pct: comision })
    return { ok: true }
  }
  throw new ErrorDistribuidor("Acción desconocida.")
}

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

/** Formulario público de hetnacnc.com/creadores. */
export async function guardarSolicitudCreador(knex: any, b: any, ip: string) {
  if (limpio(b?.sitio_web, 200)) return { ok: true } // trampa para robots
  if (excedido(ip || "?")) throw new ErrorDistribuidor("Ya recibimos tu solicitud. Te escribimos pronto.", 429)
  const s = {
    nombre: limpio(b?.nombre, 80),
    correo: limpio(b?.correo, 120).toLowerCase(),
    red: red(b?.red),
    canal_url: limpio(b?.canal_url, 300),
    seguidores: limpio(b?.seguidores, 40),
    mensaje: limpio(b?.mensaje, 600),
  }
  if (s.nombre.length < 2) throw new ErrorDistribuidor("Escribe tu nombre o el de tu canal.")
  if (!CORREO.test(s.correo)) throw new ErrorDistribuidor("Escribe un correo válido: ahí te mandamos tu código.")
  if (!URL_OK.test(s.canal_url)) throw new ErrorDistribuidor("Pon la liga de tu canal o perfil (empieza con https://).")
  await asegurarCreadores(knex)
  await knex(T_CREADOR_SOL).insert(s)
  const para = String(process.env.CONTROL_AVISOS_PARA || correosDeLaCasa()[0] || "").split(",").map((x) => x.trim()).filter(Boolean)
  for (const to of para) {
    await sendEmail({
      to,
      subject: `Nuevo creador quiere su código: ${s.nombre}`,
      html: `<div style="font-family:Arial,sans-serif"><h3>Solicitud de creador</h3><p><b>${esc(s.nombre)}</b> · ${esc(s.red)} · ${esc(s.seguidores || "")}</p><p><a href="${esc(s.canal_url)}">${esc(s.canal_url)}</a></p><p>${esc(s.mensaje || "")}</p><p><a href="${STORE}/mx/panel/cotizador/creadores">Atenderla en el panel</a></p></div>`,
    }).catch(() => null)
  }
  await sendEmail({
    to: s.correo,
    subject: "Recibimos tu solicitud al programa de creadores HETNA",
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#222"><p>Hola ${esc(s.nombre)}:</p><p>Recibimos tu solicitud al programa de creadores de HETNA CNC. La revisamos y te mandamos por este medio tu código y tu página propia.</p><p>— Equipo HETNA CNC</p></div>`,
  }).catch(() => null)
  return { ok: true }
}
