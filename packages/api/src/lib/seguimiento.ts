// Seguimiento de una solicitud de fabricación, de que llega hasta que se cierra.
//
// Va en su propia columna (`etapa`) y no en `estado`, a propósito: `estado`
// (abierta | elegida | pagada | cerrada, y "revision" mientras HETNA la
// revisa) es lo que deciden el cierre a los 7 días, la elección y el pago, y
// ya funciona. La etapa es lo que se le cuenta al cliente, con su historial.
//
//   nueva → en_revision → enviada_talleres → cotizada → aceptada
//         → en_produccion → entregada → cerrada        (o cancelada)
//
// Quién mueve cada una:
//   - en_revision: al llegar, si LICITACION_REVISION no es "0".
//   - enviada_talleres: HETNA aprueba en el dashboard (o el job, si nadie la
//     revisó en LICITACION_REVISION_HORAS).
//   - cotizada: la primera propuesta de un taller.
//   - aceptada: el cliente elige propuesta.
//   - en_produccion: Mercado Pago confirma el pago.
//   - entregada: el taller ganador la marca, con paquetería y guía.
//   - cerrada: el cliente confirma que la recibió (o el job, pasados
//     DIAS_PARA_CERRAR desde la entrega), o cerró sin propuestas.
//   - cancelada: HETNA la rechaza en la revisión.
// HETNA puede mover cualquiera a mano desde el dashboard.
import { sendEmail } from "./resend"
import {
  STORE_URL,
  T_SOLICITUD,
  asegurarTablas,
  boton,
  esc,
  fila,
  folioTexto,
  ligaPropuestas,
  marco,
  nuevoId,
} from "./licitacion"

export const ETAPAS = [
  "nueva",
  "en_revision",
  "enviada_talleres",
  "cotizada",
  "aceptada",
  "en_produccion",
  "entregada",
  "cerrada",
  "cancelada",
] as const
export type Etapa = (typeof ETAPAS)[number]

export const NOMBRE_ETAPA: Record<Etapa, string> = {
  nueva: "Nueva",
  en_revision: "En revisión",
  enviada_talleres: "Enviada a talleres",
  cotizada: "Cotizada",
  aceptada: "Aceptada",
  en_produccion: "En producción",
  entregada: "Entregada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
}

// Lo que ve el cliente debajo de cada etapa en su liga privada.
export const EXPLICA_ETAPA: Record<Etapa, string> = {
  nueva: "Recibimos tu solicitud.",
  en_revision: "HETNA revisa que tu solicitud tenga lo necesario para cotizar.",
  enviada_talleres: "Los talleres que hacen ese trabajo ya la tienen y pueden mandarte propuestas.",
  cotizada: "Ya tienes propuestas para comparar.",
  aceptada: "Elegiste una propuesta. Falta confirmar el pago.",
  en_produccion: "Pago confirmado. El taller está fabricando tu pedido.",
  entregada: "El taller entregó o envió tu pedido.",
  cerrada: "Proyecto terminado.",
  cancelada: "La solicitud se canceló.",
}

export const T_EVENTO = "hetna_solicitud_evento"
export const DIAS_PARA_CERRAR = 10

export const revisionActiva = () => process.env.LICITACION_REVISION !== "0"
export const horasRevision = () => {
  const n = Number(process.env.LICITACION_REVISION_HORAS || 24)
  return n > 0 ? n : 24
}
// Dirección pública del dashboard (Nginx manda /dashboard al backend). No se
// arma con MEDUSA_BACKEND_URL: en el servidor ésa es la interna (localhost).
export const ADMIN_URL = (process.env.ADMIN_PANEL_URL || `${STORE_URL}/dashboard`).replace(/\/$/, "")

let listo = false
export const asegurarSeguimiento = async (knex: any) => {
  if (listo) return
  await asegurarTablas(knex)
  for (const [col, tipo] of [
    ["etapa", "text"],
    ["etapa_desde", "fecha"],
    ["paqueteria", "text"],
    ["guia", "text"],
  ] as const) {
    if (!(await knex.schema.hasColumn(T_SOLICITUD, col))) {
      await knex.schema.alterTable(T_SOLICITUD, (t: any) =>
        tipo === "fecha" ? t.timestamp(col, { useTz: true }).nullable() : t.text(col).nullable()
      )
    }
  }
  if (!(await knex.schema.hasTable(T_EVENTO))) {
    await knex.schema.createTable(T_EVENTO, (t: any) => {
      t.text("id").primary()
      t.text("solicitud_id").notNullable().index()
      t.text("etapa").nullable() // la etapa a la que pasó; null = nota sin cambio de etapa
      t.text("actor").notNullable() // cliente | hetna | taller | sistema
      t.text("nota").nullable()
      // false = sólo para HETNA (p. ej. el motivo interno de un rechazo)
      t.boolean("visible_cliente").notNullable().defaultTo(true)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

// Solicitudes de antes de que existiera la columna: la etapa se deduce del
// estado, para que su liga privada también enseñe dónde van.
export const etapaDe = (s: { etapa?: string | null; estado: string; pago_estado?: string | null }, propuestas = 0): Etapa => {
  if (s.etapa && (ETAPAS as readonly string[]).includes(s.etapa)) return s.etapa as Etapa
  if (s.estado === "revision") return "en_revision"
  if (s.estado === "pagada" || s.pago_estado === "pagado") return "en_produccion"
  if (s.estado === "elegida") return "aceptada"
  if (s.estado === "cerrada") return "cerrada"
  return propuestas > 0 ? "cotizada" : "enviada_talleres"
}

type Actor = "cliente" | "hetna" | "taller" | "sistema"

// Anota en el historial sin cambiar de etapa (un avance del taller, una
// pregunta de HETNA al cliente).
export const anotar = async (
  knex: any,
  solicitudId: string,
  actor: Actor,
  nota: string,
  visibleCliente = true
) => {
  await asegurarSeguimiento(knex)
  await knex(T_EVENTO).insert({
    id: nuevoId("evt"),
    solicitud_id: solicitudId,
    etapa: null,
    actor,
    nota: nota.slice(0, 2000),
    visible_cliente: visibleCliente,
  })
}

// Correo al cliente en cada etapa que le cambia algo. "cotizada", "aceptada"
// y "en_produccion" no llevan correo propio: ya les avisa la ruta que las
// provoca (propuesta nueva, elección, pago) con más detalle.
const CORREO: Partial<Record<Etapa, { asunto: string; titulo: string; texto: string; boton: string }>> = {
  en_revision: {
    asunto: "Estamos revisando tu solicitud",
    titulo: "Estamos revisando tu solicitud",
    texto: "Revisamos que tenga lo necesario para que los talleres te den un precio real. Si falta algo te escribimos; si no, en cuanto la aprobemos la enviamos a los talleres.",
    boton: "Ver mi solicitud",
  },
  enviada_talleres: {
    asunto: "Tu solicitud ya está con los talleres",
    titulo: "Tu solicitud ya está con los talleres",
    texto: "Los talleres que hacen ese trabajo ya la recibieron. Te avisamos por correo cada vez que llegue una propuesta.",
    boton: "Ver mi solicitud",
  },
  entregada: {
    asunto: "Tu pedido fue entregado o enviado",
    titulo: "Tu pedido va en camino o ya fue entregado",
    texto: "Cuando lo tengas en tus manos, confírmalo en tu liga: así cerramos el proyecto y el taller recibe su pago.",
    boton: "Confirmar que lo recibí",
  },
  cerrada: {
    asunto: "Proyecto terminado",
    titulo: "¡Gracias por fabricar con HETNA!",
    texto: "Cerramos tu proyecto. Si necesitas otra pieza o más del mismo lote, puedes pedirla desde la misma página.",
    boton: "Ver mi solicitud",
  },
  cancelada: {
    asunto: "Tu solicitud se canceló",
    titulo: "Tu solicitud se canceló",
    texto: "Si fue por falta de datos, puedes mandarla de nuevo con la información que te pedimos. Respóndenos por WhatsApp si tienes dudas.",
    boton: "Ver mi solicitud",
  },
}

export const cambiarEtapa = async (
  knex: any,
  s: { id: string; folio: number | string; token: string; contacto?: any; etapa?: string | null },
  etapa: Etapa,
  opciones: {
    actor: Actor
    nota?: string
    visibleCliente?: boolean
    correo?: boolean
    extra?: Record<string, unknown>
    logger?: { info: (m: string) => void }
  }
) => {
  await asegurarSeguimiento(knex)
  await knex(T_SOLICITUD)
    .where({ id: s.id })
    .update({ etapa, etapa_desde: knex.fn.now(), updated_at: knex.fn.now(), ...(opciones.extra || {}) })
  await knex(T_EVENTO).insert({
    id: nuevoId("evt"),
    solicitud_id: s.id,
    etapa,
    actor: opciones.actor,
    nota: opciones.nota ? opciones.nota.slice(0, 2000) : null,
    visible_cliente: opciones.visibleCliente !== false,
  })

  const c = CORREO[etapa]
  const email = s.contacto?.email
  if (opciones.correo === false || !c || !email) return
  const folio = folioTexto(s.folio)
  const extra = opciones.extra || {}
  const r = await sendEmail({
    to: email,
    subject: `[${folio}] ${c.asunto}`,
    html: marco(
      c.titulo,
      `<p style="margin:0 0 12px;color:#40403A">Folio <strong>${esc(folio)}</strong>. ${esc(c.texto)}</p>` +
        (opciones.nota && opciones.visibleCliente !== false
          ? `<p style="margin:0 0 12px;color:#40403A;background:#F3F1EA;padding:10px 12px;border-radius:8px">${esc(opciones.nota)}</p>`
          : "") +
        (extra.paqueteria || extra.guia
          ? `<table style="border-collapse:collapse;font-size:14px">` +
            fila("Paquetería", String(extra.paqueteria || "")) +
            fila("Guía", String(extra.guia || "")) +
            `</table>`
          : "") +
        boton(c.boton, ligaPropuestas(s.token))
    ),
  })
  if (!r.sent) opciones.logger?.info(`[seguimiento] correo de ${etapa} no enviado (${folio}): ${r.reason}`)
}
