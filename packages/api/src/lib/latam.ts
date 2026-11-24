// Fase 5 (expansión a Latinoamérica): pre-registro de talleres fundadores y
// clientes por país, antes de abrir cada país en la tienda. Con los números del
// panel se decide qué país abrir primero (y se le avisa a cada registrado).
//
// Abrir un país en la tienda = crear su región en Medusa (moneda, impuestos,
// envíos); este módulo no lo hace, sólo junta la demanda.
import { correosDeLaCasa } from "./cuentas-casa"
import { sendEmail } from "./resend"

export const T_LATAM = "hetna_latam_registro"

export const PAISES_LATAM: Record<string, { nombre: string; moneda: string; bandera: string }> = {
  co: { nombre: "Colombia", moneda: "COP", bandera: "🇨🇴" },
  cl: { nombre: "Chile", moneda: "CLP", bandera: "🇨🇱" },
  pe: { nombre: "Perú", moneda: "PEN", bandera: "🇵🇪" },
  ar: { nombre: "Argentina", moneda: "ARS", bandera: "🇦🇷" },
  gt: { nombre: "Guatemala", moneda: "GTQ", bandera: "🇬🇹" },
  ec: { nombre: "Ecuador", moneda: "USD", bandera: "🇪🇨" },
  cr: { nombre: "Costa Rica", moneda: "CRC", bandera: "🇨🇷" },
  bo: { nombre: "Bolivia", moneda: "BOB", bandera: "🇧🇴" },
  do: { nombre: "República Dominicana", moneda: "DOP", bandera: "🇩🇴" },
  es: { nombre: "España", moneda: "EUR", bandera: "🇪🇸" },
  // EUA hispano (fase 5.2)
  us: { nombre: "Estados Unidos", moneda: "USD", bandera: "🇺🇸" },
  uy: { nombre: "Uruguay", moneda: "UYU", bandera: "🇺🇾" },
  py: { nombre: "Paraguay", moneda: "PYG", bandera: "🇵🇾" },
  sv: { nombre: "El Salvador", moneda: "USD", bandera: "🇸🇻" },
}

let lista = false
async function asegurar(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_LATAM))) {
    await knex.schema.createTable(T_LATAM, (t: any) => {
      t.increments("id").primary()
      t.text("pais").notNullable().index()
      t.text("tipo").notNullable() // taller | cliente
      t.text("nombre").notNullable()
      t.text("empresa")
      t.text("correo").notNullable()
      t.text("telefono")
      t.text("ciudad")
      t.text("maquinas")
      t.text("mensaje")
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.unique(["pais", "correo"])
    })
  }
  lista = true
}

export class ErrorLatam extends Error {
  constructor(msg: string, public status = 400) {
    super(msg)
  }
}

const limpio = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n)
const CORREO = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const intentos = new Map<string, number[]>()
function excedido(ip: string) {
  const ahora = Date.now()
  const l = (intentos.get(ip) || []).filter((t) => ahora - t < 3600_000)
  l.push(ahora)
  intentos.set(ip, l)
  if (intentos.size > 5000) intentos.clear()
  return l.length > 5
}

export async function registrarLatam(knex: any, b: any, ip: string) {
  if (limpio(b?.sitio_web, 200)) return { ok: true } // trampa para robots
  if (excedido(ip || "?")) throw new ErrorLatam("Ya recibimos tu registro. Te escribimos pronto.", 429)
  const r = {
    pais: limpio(b?.pais, 2).toLowerCase(),
    tipo: b?.tipo === "taller" ? "taller" : "cliente",
    nombre: limpio(b?.nombre, 100),
    empresa: limpio(b?.empresa, 120),
    correo: limpio(b?.correo, 120).toLowerCase(),
    telefono: limpio(b?.telefono, 30),
    ciudad: limpio(b?.ciudad, 80),
    maquinas: limpio(b?.maquinas, 200),
    mensaje: limpio(b?.mensaje, 600),
  }
  if (!PAISES_LATAM[r.pais]) throw new ErrorLatam("Elige tu país.")
  if (r.nombre.length < 2) throw new ErrorLatam("Escribe tu nombre.")
  if (!CORREO.test(r.correo)) throw new ErrorLatam("Escribe un correo válido: ahí te avisamos cuando abramos tu país.")
  if (r.tipo === "taller" && !r.maquinas) throw new ErrorLatam("Dinos qué máquinas tiene tu taller.")
  await asegurar(knex)
  await knex(T_LATAM).insert(r).onConflict(["pais", "correo"]).merge()
  const p = PAISES_LATAM[r.pais]
  await sendEmail({
    to: r.correo,
    subject: `${p.bandera} Recibimos tu registro: HETNA CNC en ${p.nombre}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#222"><p>Hola ${esc(r.nombre)}:</p><p>Gracias por apuntarte${r.tipo === "taller" ? " como <b>taller fundador</b>" : ""} para cuando HETNA CNC abra en <b>${p.nombre}</b>. Te avisamos por este medio en cuanto esté listo, antes que a nadie.</p><p>Mientras, ya puedes usar gratis las herramientas de diseño, la Calculadora CNC y el Cotizador para talleres: hetnacnc.com</p><p>— Equipo HETNA CNC</p></div>`,
  }).catch(() => null)
  const para = String(process.env.CONTROL_AVISOS_PARA || correosDeLaCasa()[0] || "").split(",").map((x) => x.trim()).filter(Boolean)
  for (const to of para)
    await sendEmail({
      to,
      subject: `${p.bandera} Nuevo ${r.tipo} para ${p.nombre}: ${r.empresa || r.nombre}`,
      html: `<div style="font-family:Arial,sans-serif"><p><b>${esc(r.nombre)}</b>${r.empresa ? ` · ${esc(r.empresa)}` : ""} · ${esc(r.ciudad)} · ${esc(r.correo)}</p><p>${esc(r.maquinas || "")}</p><p>${esc(r.mensaje || "")}</p></div>`,
    }).catch(() => null)
  return { ok: true }
}

/** Cuántos van por país (público: sólo números). */
export async function conteoLatam(knex: any) {
  await asegurar(knex)
  const filas = (await knex(T_LATAM).select("pais", "tipo").count({ n: "*" }).groupBy("pais", "tipo")) as any[]
  const out: Record<string, { talleres: number; clientes: number }> = {}
  for (const f of filas) {
    const x = (out[f.pais] ||= { talleres: 0, clientes: 0 })
    if (f.tipo === "taller") x.talleres += Number(f.n)
    else x.clientes += Number(f.n)
  }
  return out
}

/** Panel: conteo y los últimos registros. */
export async function panelLatam(knex: any) {
  await asegurar(knex)
  const [conteo, ultimos] = await Promise.all([conteoLatam(knex), knex(T_LATAM).orderBy("created_at", "desc").limit(200).select("*")])
  return { paises: PAISES_LATAM, conteo, ultimos }
}
