// Una vez al día (10:17 de CDMX): recordatorios de licitaciones detenidas.
// Al cliente: propuestas sin elegir y elegida sin pagar. Al taller:
// contraofertas sin responder e hitos atrasados. Ver lib/licitacion-recordatorios.
//
// Salen por correo y por celular (push y WhatsApp si la persona lo verificó).
// RECORDATORIOS_LICITACION=0 los apaga.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../lib/resend"
import { pushACliente, pushATalleres } from "../lib/push"
import { VENDOR_URL, asegurarTablas, boton, esc, ligaPropuestas, marco } from "../lib/licitacion"
import { asegurarSeguimiento } from "../lib/seguimiento"
import {
  type Pendiente,
  apartar,
  asegurarRecordatorios,
  folioTexto,
  pendientes,
  pesos,
  plural,
  soltar,
} from "../lib/licitacion-recordatorios"

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))
const p = (t: string) => `<p style="margin:0 0 12px;color:#40403A">${t}</p>`
const hola = (s: any) => `Hola${s.contacto?.nombre ? ` ${esc(String(s.contacto.nombre).split(" ")[0])}` : ""}`

type Mensaje = { para: "cliente" | "taller"; asunto: string; titulo: string; html: string; push: string; url: string }

export function redactar(x: Pendiente): Mensaje {
  const folio = folioTexto(x.s.folio)
  if (x.tipo === "elegir") {
    const datos = [x.mejorPrecio != null ? `desde ${pesos(x.mejorPrecio)}` : "", x.menosDias != null ? `entrega desde ${plural(x.menosDias, "día", "días")}` : ""].filter(Boolean).join(" y ")
    const ultimo = x.n >= 2
    return {
      para: "cliente",
      asunto: ultimo ? `[${folio}] Tus propuestas siguen esperando` : `[${folio}] Tienes ${plural(x.propuestas, "propuesta", "propuestas")} para elegir`,
      titulo: ultimo ? "¿Te ayudamos a decidir?" : "Tus propuestas te esperan",
      html:
        p(`${hola(x.s)}, en <strong>${esc(folio)}</strong> te llegaron <strong>${plural(x.propuestas, "propuesta", "propuestas")}</strong>${datos ? ` (${esc(datos)})` : ""} y todavía no eliges.`) +
        p("En la tabla comparas precio, tiempo de entrega y la reputación medida de cada taller. Si algo no te cuadra, puedes mandar una contraoferta antes de decidir.") +
        (ultimo ? p("Si ya no necesitas el trabajo, no pasa nada: sólo ignora este correo. Si tienes dudas, responde y te ayudamos a elegir.") : "") +
        boton("Comparar y elegir", ligaPropuestas(x.s.token)),
      push: `${folio}: ${plural(x.propuestas, "propuesta espera", "propuestas esperan")} tu decisión.`,
      url: ligaPropuestas(x.s.token),
    }
  }
  if (x.tipo === "pagar") {
    return {
      para: "cliente",
      asunto: `[${folio}] Falta el pago para empezar tu pedido`,
      titulo: "Tu taller está listo para empezar",
      html:
        p(`${hola(x.s)}, ya elegiste taller para <strong>${esc(folio)}</strong>. En cuanto confirmes el pago, el taller empieza y ves el avance por etapas, con fotos.`) +
        p("El pago queda protegido dentro de HETNA: al taller se le libera hasta que confirmas que recibiste tu pedido.") +
        boton("Pagar y empezar", ligaPropuestas(x.s.token)),
      push: `${folio}: confirma el pago para que el taller empiece.`,
      url: ligaPropuestas(x.s.token),
    }
  }
  const liga = `${VENDOR_URL}/solicitudes`
  if (x.tipo === "contraoferta") {
    const pide = [x.c.precio != null ? pesos(Number(x.c.precio)) : "", x.c.dias != null ? plural(Number(x.c.dias), "día", "días") : ""].filter(Boolean).join(" · ")
    return {
      para: "taller",
      asunto: `[${folio}] Un cliente espera tu respuesta a su contraoferta`,
      titulo: x.n >= 2 ? "La contraoferta sigue sin respuesta" : "Tienes una contraoferta pendiente",
      html:
        p(`El cliente de <strong>${esc(folio)}</strong> te mandó una contraoferta${pide ? ` (<strong>${esc(pide)}</strong>)` : ""} y sigue esperando.`) +
        p("Acéptala, recházala con una nota o ajusta tu propuesta. Los talleres que responden rápido ganan más trabajos y su reputación lo refleja.") +
        boton("Responder", liga),
      push: `${folio}: el cliente espera tu respuesta a su contraoferta.`,
      url: liga,
    }
  }
  const lista = x.hitos.map((h) => `<li>${esc(h.nombre)}: planeado para el ${esc(h.fecha_plan)} (${plural(h.dias, "día", "días")} de atraso)</li>`).join("")
  return {
    para: "taller",
    asunto: `[${folio}] ${x.hitos.length === 1 ? `"${x.hitos[0].nombre}" va atrasado` : `${x.hitos.length} etapas van atrasadas`}`,
    titulo: "Actualiza el avance del pedido",
    html:
      p(`El cliente de <strong>${esc(folio)}</strong> ve en su liga que estas etapas pasaron su fecha planeada:`) +
      `<ul style="margin:0 0 12px;color:#40403A;padding-left:18px">${lista}</ul>` +
      p("Si ya están listas, márcalas con una foto. Si necesitas más tiempo, mueve la fecha y deja una nota: un cliente informado espera tranquilo.") +
      boton("Actualizar hitos", liga),
    push: `${folio}: ${x.hitos.length === 1 ? `"${x.hitos[0].nombre}" va atrasado` : `${x.hitos.length} etapas atrasadas`}. Actualiza el avance.`,
    url: liga,
  }
}

export default async function recordatoriosLicitaciones(container: MedusaContainer) {
  if (process.env.RECORDATORIOS_LICITACION === "0") return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    await asegurarTablas(knex)
    await asegurarSeguimiento(knex)
    await asegurarRecordatorios(knex)
    const lista = await pendientes(knex)
    const cuenta: Record<string, number> = {}
    for (const x of lista) {
      // Apartar las claves primero: si otra corrida ya lo mandó, no se repite
      let claves: string[]
      let item: Pendiente = x
      if (x.tipo === "hitos") {
        const nuevos: typeof x.hitos = []
        claves = []
        for (let i = 0; i < x.claves.length; i++) {
          if (await apartar(knex, x.claves[i])) { claves.push(x.claves[i]); nuevos.push(x.hitos[i]) }
        }
        if (!nuevos.length) continue
        item = { ...x, hitos: nuevos }
      } else {
        if (!(await apartar(knex, x.clave))) continue
        claves = [x.clave]
      }

      const m = redactar(item)
      let correo: string | null = null
      if (m.para === "cliente") correo = item.s.contacto?.email || null
      else correo = (await knex("seller").where({ id: (item as any).sellerId }).first("email").catch(() => null))?.email || null

      let mandado = false
      if (correo) {
        const r = await sendEmail({ to: correo, subject: m.asunto, html: marco(m.titulo, m.html) })
        mandado = r.sent
        if (!r.sent) logger.info(`[recordatorios] ${m.asunto}: correo no enviado (${r.reason})`)
        await pausa(600)
      }
      const aviso = { titulo: m.titulo, cuerpo: m.push, url: m.url, etiqueta: `recordatorio-${item.s.id}` }
      const celulares = m.para === "cliente"
        ? await pushACliente(knex, { customerId: item.s.cliente_id, email: item.s.contacto?.email }, aviso, logger)
        : await pushATalleres(knex, [(item as any).sellerId], aviso, logger)
      if (!mandado && !celulares) {
        // No salió por ningún lado: se suelta para intentarlo mañana
        for (const c of claves) await soltar(knex, c)
        continue
      }
      cuenta[item.tipo] = (cuenta[item.tipo] || 0) + 1
    }
    if (Object.keys(cuenta).length) logger.info(`[recordatorios] enviados: ${JSON.stringify(cuenta)}`)
  } catch (e) {
    logger.error(`[recordatorios] falló: ${(e as Error).message}`)
  }
}

export const config = {
  name: "recordatorios-licitaciones",
  schedule: "17 16 * * *",
}
