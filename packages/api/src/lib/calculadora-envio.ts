// "Mándame estos parámetros por correo" desde la Calculadora CNC pública.
//
// Es un formulario sin cuenta que manda correo desde el dominio de la tienda,
// así que se cuida que no sirva para mandar spam:
//   - el correo es una plantilla fija; lo único variable es la liga al cálculo,
//     y esa liga se arma aquí con valores ya validados (nada de texto libre);
//   - una vez por dirección y cálculo, y a lo más 3 por dirección al día;
//   - a lo más 10 por IP en una hora;
//   - cuenta contra el mismo tope diario que el resto de los correos de
//     marketing (MARKETING_MAX_DIA), que comparte la cuota de Resend;
//   - respeta la lista de bajas y lleva su liga para darse de baja.
// El permiso para recibir novedades se guarda aparte y sólo si la persona
// marcó la casilla.
import { createHash } from "crypto"

import { ligaBaja, T_BAJA } from "./baja"
import { boton, marco, STORE_URL } from "./licitacion"
import { asegurarTablaPromo, T_PROMO } from "./marketing-correos"
import { sendEmail } from "./resend"

export const T_CALC_LEAD = "hetna_calc_lead"
const PROCESOS = new Set(["router", "laser_co2", "fibra", "fibra_corte", "plasma", "impresion3d"])
const NOMBRE: Record<string, string> = {
  router: "router CNC",
  laser_co2: "láser CO₂",
  fibra: "marcado con fibra o UV",
  fibra_corte: "corte por fibra",
  plasma: "plasma CNC",
  impresion3d: "impresión 3D",
}
const maxDia = () => Math.max(0, Number(process.env.MARKETING_MAX_DIA) || 80)

let lista = false
async function asegurarTabla(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_CALC_LEAD))) {
    await knex.schema.createTable(T_CALC_LEAD, (t: any) => {
      t.bigIncrements("id").primary()
      t.text("correo").notNullable().index()
      t.text("proceso").notNullable()
      t.boolean("acepta_marketing").notNullable().defaultTo(false)
      t.text("ip").notNullable().index()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

export class EnvioCalcError extends Error {
  constructor(
    public status: number,
    mensaje: string
  ) {
    super(mensaje)
  }
}

const correoValido = (c: string) => /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/i.test(c) && c.length <= 120

/** Revisa el código del cálculo (?c=…): un objeto chico de textos cortos y simples. */
export function codigoValido(c: string): boolean {
  if (!/^[A-Za-z0-9_-]{2,700}$/.test(c)) return false
  try {
    const datos = JSON.parse(Buffer.from(c, "base64url").toString("utf8"))
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) return false
    const pares = Object.entries(datos)
    return pares.length <= 25 && pares.every(([k, v]) => /^[a-z0-9_]{1,30}$/.test(k) && typeof v === "string" && /^[\w.,\- ]{0,40}$/.test(v))
  } catch {
    return false
  }
}

export function correoCalculo(proceso: string, enlace: string) {
  const utm = "utm_source=correo&utm_medium=calculadora&utm_campaign=parametros"
  return {
    asunto: `Tus parámetros de ${NOMBRE[proceso] || "CNC"} — HETNA CNC`,
    html: marco(
      "Tus parámetros de corte",
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">Aquí está el cálculo que hiciste en la Calculadora CNC de HETNA para <b>${NOMBRE[proceso] || "tu máquina"}</b>. La liga lo abre con los mismos datos: RPM, avance, profundidad, pasadas y los avisos de tu máquina.</p>` +
        boton("Abrir mi cálculo", enlace) +
        `<p style="margin:16px 0 0;color:#6B675C;font-size:13px;line-height:1.5">Son puntos de partida: prueba siempre en un retazo del mismo material antes del trabajo real.</p>` +
        `<hr style="border:0;border-top:1px solid #E7E4DC;margin:20px 0">` +
        `<p style="margin:0 0 8px;color:#40403A;line-height:1.5"><b>¿Cotizas trabajos CNC?</b> La app HETNA CNC para talleres convierte el tiempo de máquina en precio con tus costos. 14 días gratis.</p>` +
        `<p style="margin:0"><a href="${STORE_URL}/mx/servicios/cotizador-cnc?${utm}" style="color:#C2560A;font-weight:bold">Conocer la app</a> · <a href="${STORE_URL}/mx/cam/subir?${utm}" style="color:#C2560A;font-weight:bold">CAM Studio gratis</a></p>`
    ),
  }
}

export async function enviarCalculo(
  knex: any,
  p: { correo: string; proceso: string; modo: string; c: string; acepta_marketing: boolean; ip: string }
): Promise<{ enviado: boolean }> {
  const correo = String(p.correo || "").trim().toLowerCase()
  if (!correoValido(correo)) throw new EnvioCalcError(400, "Revisa tu correo.")
  if (!PROCESOS.has(p.proceso) || !/^[a-z0-9_]{2,30}$/.test(p.modo) || !codigoValido(p.c)) throw new EnvioCalcError(400, "No se pudo leer el cálculo. Vuelve a calcular.")
  await asegurarTabla(knex)
  await asegurarTablaPromo(knex)

  const hora = new Date(Date.now() - 3600_000)
  const dia = new Date(Date.now() - 86400_000)
  const [{ n: porIp }] = await knex(T_CALC_LEAD).where({ ip: p.ip }).where("created_at", ">=", hora).count("* as n")
  if (Number(porIp) >= 10) throw new EnvioCalcError(429, "Ya mandaste varios cálculos. Intenta en una hora.")
  const [{ n: porCorreo }] = await knex(T_CALC_LEAD).where({ correo }).where("created_at", ">=", dia).count("* as n")
  if (Number(porCorreo) >= 3) throw new EnvioCalcError(429, "Ya te mandamos 3 cálculos hoy. Usa Copiar o la liga de WhatsApp.")

  await knex(T_CALC_LEAD).insert({ correo, proceso: p.proceso, acepta_marketing: !!p.acepta_marketing, ip: p.ip })

  // Quien se dio de baja no recibe nada; se responde igual para no revelar quién está en la lista
  if (await knex(T_BAJA).where({ correo }).first()) return { enviado: false }
  const ref = createHash("sha256").update(`${p.proceso}|${p.modo}|${p.c}`).digest("base64url").slice(0, 24)
  if (await knex(T_PROMO).where({ tipo: "calc_envio", ref, correo }).first()) return { enviado: true }
  const hoy = new Date()
  hoy.setUTCHours(0, 0, 0, 0)
  const [{ n: hoyN }] = await knex(T_PROMO).where("created_at", ">=", hoy).count("* as n")
  if (Number(hoyN) >= maxDia()) throw new EnvioCalcError(503, "Por hoy ya no podemos mandar más correos. Usa Copiar o WhatsApp.")

  const enlace = `${STORE_URL}/mx/calculadora-cnc?proceso=${p.proceso}&modo=${p.modo}&c=${p.c}&utm_source=correo&utm_medium=calculadora&utm_campaign=parametros`
  const { asunto, html } = correoCalculo(p.proceso, enlace)
  const r = await sendEmail({ to: correo, subject: asunto, html, bajaUrl: ligaBaja(correo) })
  if (!r.sent) throw new EnvioCalcError(503, "No se pudo mandar el correo. Intenta más tarde.")
  await knex(T_PROMO).insert({ correo, tipo: "calc_envio", ref }).onConflict(["tipo", "ref", "correo"]).ignore()
  return { enviado: true }
}
