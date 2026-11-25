// Avisos por correo del flujo "liberar pago" y reclamos (lib/reclamos-pedido.ts).
// Nunca tiran el flujo: si un correo falla, se anota en el log.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { STORE_URL, VENDOR_URL, boton, esc, marco } from "./licitacion"
import { DECISIONES, DIAS_HABILES_RESPUESTA, MOTIVOS, folioReclamo, type Decision, type Motivo } from "./reclamos-pedido"
import { sendEmail } from "./resend"
import { ADMIN_URL } from "./seguimiento"

const p = (t: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">${t}</p>`
const fecha = (d: any) =>
  d ? new Date(d).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Mexico_City" }) : "—"
const dinero = (n: number, m = "mxn") =>
  `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${String(m).toUpperCase()}`

async function taller(c: MedusaContainer, sellerId: string) {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "seller", fields: ["id", "name", "email"], filters: { id: sellerId } }).catch(() => ({ data: [] as any[] }))
  const s = (data[0] || {}) as { name?: string; email?: string }
  return { nombre: s.name || "el taller", email: s.email || null }
}

async function enviarTodos(c: MedusaContainer, etiqueta: string, correos: (Parameters<typeof sendEmail>[0] | null)[]) {
  const logger = c.resolve("logger") as any
  const r = await Promise.allSettled(correos.filter(Boolean).map((x) => sendEmail(x!)))
  for (const x of r) if (x.status === "rejected") logger.error(`[reclamos] ${etiqueta}: no se pudo avisar: ${x.reason}`)
}

export async function avisarReclamoAbierto(c: MedusaContainer, r: any, pedido: { email?: string | null }) {
  const t = await taller(c, r.seller_id)
  const folio = folioReclamo(r.folio)
  const motivo = MOTIVOS[r.motivo as Motivo]?.nombre || r.motivo
  const pedidoTxt = `pedido #${r.display_id ?? "—"}`
  const hetna = process.env.HETNA_LEADS_EMAIL
  await enviarTodos(c, folio, [
    hetna
      ? {
          to: hetna,
          subject: `[${folio}] Reclamo de compra: ${motivo}`,
          html: marco(
            `Reclamo ${folio}`,
            p(`<strong>${esc(motivo)}</strong> en el ${pedidoTxt} de ${esc(t.nombre)}.`) +
              p(esc(r.detalle).replace(/\n/g, "<br>")) +
              p(`Saldo del taller al abrir: ${esc(r.saldo_estado_previo || "—")}. ${r.horas_desde_entrega != null ? `Reportado ${r.horas_desde_entrega} h después de la entrega.` : "Sin entrega registrada."}`) +
              p(`El taller tiene hasta el ${esc(fecha(r.responder_antes))} para responder.`) +
              boton("Abrir Reclamos en el dashboard", `${ADMIN_URL}/reclamos`)
          ),
        }
      : null,
    t.email
      ? {
          to: t.email,
          subject: `[${folio}] Un cliente reportó un problema con su pedido #${r.display_id ?? ""}`,
          html: marco(
            "Un cliente reportó un problema",
            p(`El cliente del ${pedidoTxt} reportó: <strong>${esc(motivo)}</strong>.`) +
              p(
                `Tienes <strong>${DIAS_HABILES_RESPUESTA} días hábiles</strong> (hasta el ${esc(fecha(r.responder_antes))}) para responder con tu versión y tu evidencia: fotos del producto antes de enviarlo, del empaque, la guía de envío. Si no respondes a tiempo, el caso se resuelve a favor del cliente.`
              ) +
              p("Mientras se resuelve, el pago de este pedido queda congelado. HETNA revisa la evidencia de los dos y decide con justicia.") +
              boton("Ver el reclamo y responder", `${VENDOR_URL}/reclamos`)
          ),
        }
      : null,
    pedido.email
      ? {
          to: pedido.email,
          subject: `[${folio}] Recibimos tu reporte del pedido #${r.display_id ?? ""}`,
          html: marco(
            "Recibimos tu reporte",
            p(`Motivo: <strong>${esc(motivo)}</strong>. Congelamos el pago al taller mientras se resuelve.`) +
              p(`Le pedimos al taller su versión (tiene hasta el ${esc(fecha(r.responder_antes))}). Después HETNA revisa la evidencia de los dos y te avisa la decisión por correo.`) +
              p("Conserva el producto y su empaque: si procede una devolución, te diremos cómo enviarlo.") +
              boton("Ver mis compras", `${STORE_URL}/mx/user/orders`)
          ),
        }
      : null,
  ])
}

export async function avisarRespuestaTaller(c: MedusaContainer, r: any) {
  const hetna = process.env.HETNA_LEADS_EMAIL
  if (!hetna) return
  const folio = folioReclamo(r.folio)
  await enviarTodos(c, folio, [
    {
      to: hetna,
      subject: `[${folio}] El taller respondió: ya puedes decidir`,
      html: marco(`El taller respondió ${folio}`, p(esc(r.respuesta_taller).replace(/\n/g, "<br>")) + boton("Decidir en el dashboard", `${ADMIN_URL}/reclamos`)),
    },
  ])
}

export async function avisarSinRespuesta(c: MedusaContainer, filas: any[]) {
  const hetna = process.env.HETNA_LEADS_EMAIL
  if (!hetna || !filas.length) return
  await enviarTodos(c, "sin respuesta", [
    {
      to: hetna,
      subject: `${filas.length} reclamo(s) sin respuesta del taller: resolver a favor del cliente`,
      html: marco(
        "Talleres que no respondieron a tiempo",
        p("Se les acabó el plazo de respuesta. Según la política, el caso se resuelve a favor del cliente:") +
          `<ul>${filas.map((f) => `<li>${esc(folioReclamo(f.folio))} · pedido #${esc(f.display_id ?? "—")} · ${esc(MOTIVOS[f.motivo as Motivo]?.nombre || f.motivo)}</li>`).join("")}</ul>` +
          boton("Abrir Reclamos", `${ADMIN_URL}/reclamos`)
      ),
    },
  ])
}

export async function avisarDecision(c: MedusaContainer, r: any, saldo: { moneda?: string } | null) {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["id", "email"], filters: { id: r.order_id } }).catch(() => ({ data: [] as any[] }))
  const email = (data[0] as any)?.email as string | undefined
  const t = await taller(c, r.seller_id)
  const folio = folioReclamo(r.folio)
  const decision = DECISIONES[r.decision as Decision] || r.decision
  const m = saldo?.moneda || "mxn"
  const monto = r.monto_reembolso != null ? Number(r.monto_reembolso) : 0
  const guia =
    r.decision === "liberar"
      ? ""
      : r.guia_paga === "taller"
        ? "La guía de regreso la paga el taller."
        : "La guía de regreso la pagas tú (el producto se devuelve por cambio de opinión)."
  const nota = p(`<strong>Explicación de HETNA:</strong> ${esc(r.decision_nota).replace(/\n/g, "<br>")}`)
  await enviarTodos(c, folio, [
    email
      ? {
          to: email,
          subject: `[${folio}] Decisión sobre tu pedido #${r.display_id ?? ""}: ${decision}`,
          html: marco(
            decision,
            (monto > 0 ? p(`Monto a reembolsar: <strong>${dinero(monto, m)}</strong>, por el mismo medio con el que pagaste.`) : "") +
              (guia ? p(guia) : "") +
              nota +
              boton("Ver mis compras", `${STORE_URL}/mx/user/orders`)
          ),
        }
      : null,
    t.email
      ? {
          to: t.email,
          subject: `[${folio}] Decisión sobre el reclamo del pedido #${r.display_id ?? ""}: ${decision}`,
          html: marco(
            decision,
            (Number(r.descontado_taller) > 0
              ? p(`Se descuenta <strong>${dinero(Number(r.descontado_taller), m)}</strong> de tu saldo (lo ves en Mi saldo).`)
              : r.decision === "liberar"
                ? p("Tu pago de este pedido ya está disponible en Mi saldo.")
                : "") +
              (guia && r.decision !== "liberar" ? p(r.guia_paga === "taller" ? "La guía de regreso corre por tu cuenta." : "La guía de regreso la paga el cliente.") : "") +
              nota +
              boton("Ver Mi saldo", `${VENDOR_URL}/saldo`)
          ),
        }
      : null,
  ])
}
