// @ts-nocheck
// Invitación a verificar el WhatsApp (talleres y clientes registrados).
// Va por CORREO y aviso de la plataforma, nunca por WhatsApp en frío (eso
// pone en riesgo el número). Cada correo se manda una sola vez, en lotes
// diarios para no pasar la cuota de correos, respetando las bajas.
import { estaDeBaja, ligaBaja } from "./baja"
import { STORE_URL, VENDOR_URL, boton, esc, marco } from "./licitacion"
import { pushATalleres } from "./push"
import { sendEmail } from "./resend"
import { T_CONFIG_S, asegurarSocial } from "./social-hub"
import { T_WA, asegurarWhatsapp, numeroHetna } from "./whatsapp"

export const T_INV = "hetna_wa_invitacion"
const LOTE_DIA = Number(process.env.WA_INVITACION_LOTE || 60)

async function asegurar(knex: any) {
  await asegurarWhatsapp(knex)
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_INV))) {
    await knex.schema.createTable(T_INV, (t: any) => {
      t.text("correo").primary()
      t.text("quien")
      t.timestamp("enviado_en").defaultTo(knex.fn.now())
    })
  }
}

export async function leerCampana(knex: any) {
  await asegurar(knex)
  return (await knex(T_CONFIG_S).where({ clave: "wa_invitacion" }).first())?.valor || { activo: false }
}
async function guardarCampana(knex: any, v: any) {
  await knex.raw(`insert into ?? (clave, valor) values ('wa_invitacion', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(v)])
}

/** Talleres y clientes con cuenta que aún no verifican su WhatsApp ni han sido invitados. */
async function pendientes(knex: any, limite: number) {
  const talleres = await knex("seller as s")
    .whereNull("s.deleted_at")
    .whereNotNull("s.email")
    .whereNotExists(function () { this.select(knex.raw("1")).from(`${T_WA} as w`).whereRaw("w.seller_id = s.id").whereNotNull("w.verificado_en") })
    .whereNotExists(function () { this.select(knex.raw("1")).from(`${T_INV} as i`).whereRaw("lower(i.correo) = lower(s.email)") })
    .orderBy("s.created_at", "desc")
    .limit(limite)
    .select("s.id", "s.name", "s.email")
  const clientes = talleres.length >= limite ? [] : await knex("customer as c")
    .whereNull("c.deleted_at")
    .where("c.has_account", true)
    .whereNotNull("c.email")
    .whereNotExists(function () { this.select(knex.raw("1")).from(`${T_WA} as w`).whereRaw("w.customer_id = c.id").whereNotNull("w.verificado_en") })
    .whereNotExists(function () { this.select(knex.raw("1")).from(`${T_INV} as i`).whereRaw("lower(i.correo) = lower(c.email)") })
    .orderBy("c.created_at", "desc")
    .limit(limite - talleres.length)
    .select("c.id", "c.first_name as name", "c.email")
  return { talleres, clientes }
}

export function correoTaller(nombre?: string) {
  return marco(
    "Recibe tus trabajos por WhatsApp",
    `<p style="color:#40403A;line-height:1.5">Hola${nombre ? ` ${esc(nombre)}` : ""}, ahora HETNA te puede avisar por <b>WhatsApp</b> cuando llegue una solicitud de trabajo en tu zona o un pedido nuevo, para que contestes antes que nadie.</p>
     <p style="color:#40403A;line-height:1.5">Sólo verifica tu número: entra a tu panel, toca <b>«Verificar mi WhatsApp»</b> y dale Enviar al mensaje que se abre. Toma menos de un minuto. También puedes mandarnos por ahí las fotos de tu taller para tu verificación.</p>
     ${boton("Verificar mi WhatsApp", `${VENDOR_URL}/verificacion`)}
     <p style="color:#6B675C;font-size:12px;margin-top:18px">Sólo te escribimos de trabajos y pedidos tuyos. Escribe BAJA en el chat cuando quieras dejar de recibir avisos.</p>`,
  )
}
export function correoCliente(nombre?: string) {
  return marco(
    "Tus pedidos y cotizaciones, por WhatsApp",
    `<p style="color:#40403A;line-height:1.5">Hola${nombre ? ` ${esc(nombre)}` : ""}, en HETNA ya te podemos avisar por <b>WhatsApp</b> cuando un taller te mande cotización o cuando tu pedido vaya en camino.</p>
     <p style="color:#40403A;line-height:1.5">Verifica tu número en tu cuenta: toca <b>«Verificar mi WhatsApp»</b> y dale Enviar al mensaje que se abre.</p>
     ${boton("Verificar mi WhatsApp", `${STORE_URL}/mx/user/settings`)}
     <p style="color:#6B675C;font-size:12px;margin-top:18px">Sólo avisos de tus pedidos y cotizaciones. Escribe BAJA en el chat cuando quieras dejar de recibirlos.</p>`,
  )
}

/** Manda el lote de hoy. */
export async function loteInvitacion(knex: any, logger?: any, limite = LOTE_DIA) {
  await asegurar(knex)
  if (!numeroHetna()) return { enviados: 0, motivo: "Falta el número de HETNA (WHATSAPP_HETNA) en el servidor" }
  const { talleres, clientes } = await pendientes(knex, limite)
  let enviados = 0
  const avisados: string[] = []
  for (const [quien, filas] of [["taller", talleres], ["cliente", clientes]] as const) {
    for (const f of filas) {
      const correo = String(f.email).trim().toLowerCase()
      try {
        if (await estaDeBaja(knex, correo).catch(() => false)) {
          await knex(T_INV).insert({ correo, quien }).onConflict("correo").ignore()
          continue
        }
        const r = await sendEmail({
          to: correo,
          bajaUrl: ligaBaja(correo),
          subject: quien === "taller" ? "Recibe tus trabajos de HETNA por WhatsApp" : "Tus pedidos de HETNA, también por WhatsApp",
          html: quien === "taller" ? correoTaller(f.name) : correoCliente(f.name),
        })
        if (!r.sent) {
          if (r.configuracion || /quota|limit|429/i.test(String(r.reason || ""))) break
          continue
        }
        await knex(T_INV).insert({ correo, quien }).onConflict("correo").ignore()
        enviados++
        if (quien === "taller") avisados.push(f.id)
        await new Promise((ok) => setTimeout(ok, 700))
      } catch (e) {
        logger?.warn?.(`[wa-invitacion] ${(e as Error).message}`)
      }
    }
  }
  if (avisados.length) {
    await pushATalleres(knex, avisados, { titulo: "Recibe tus trabajos por WhatsApp 💬", cuerpo: "Verifica tu número y te avisamos ahí de solicitudes y pedidos.", url: "/seller/verificacion", etiqueta: "wa-invitacion" }, logger).catch(() => null)
  }
  const quedan = await pendientes(knex, 1)
  return { enviados, quedan: quedan.talleres.length + quedan.clientes.length > 0 }
}

/** Botón del panel: prende la campaña y manda el primer lote. */
export async function iniciarCampana(knex: any, logger?: any) {
  await guardarCampana(knex, { activo: true, desde: new Date().toISOString() })
  const r = await loteInvitacion(knex, logger)
  if (!r.quedan) await guardarCampana(knex, { activo: false, terminada: new Date().toISOString() })
  return r
}

/** Job diario: sigue con los lotes hasta invitar a todos. */
export async function seguirCampana(knex: any, logger?: any) {
  const c = await leerCampana(knex)
  if (!c.activo) return null
  const r = await loteInvitacion(knex, logger)
  if (!r.quedan) await guardarCampana(knex, { ...c, activo: false, terminada: new Date().toISOString() })
  return r
}

export async function resumenInvitacion(knex: any) {
  const c = await leerCampana(knex)
  const n = await knex(T_INV).count({ n: "*" }).first().catch(() => ({ n: 0 }))
  return { activo: !!c.activo, terminada: c.terminada || null, invitados: Number(n?.n || 0), lote_dia: LOTE_DIA }
}
