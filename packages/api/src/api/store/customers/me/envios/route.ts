import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../../../lib/resend"
import { STORE_URL, fila, marco, nuevoId } from "../../../../../lib/licitacion"
import {
  T_ENVIO,
  T_ENVIO_COT,
  VIGENCIA_HORAS,
  asegurarTablasEnvio,
  configProteccion,
  costoProteccion,
  crearPagoEnvio,
  evidenciaCompleta,
  folioEnvio,
  leerEvidencia,
  limpiarContacto,
} from "../../../../../lib/envios"

// /store/customers/me/* exige cliente con sesión (middleware de Medusa).
const clienteId = (req: MedusaRequest) => (req as any).auth_context?.actor_id as string | undefined

// Mis envíos
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = clienteId(req)
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablasEnvio(knex)
  const filas = await knex(T_ENVIO).where({ customer_id: id }).orderBy("created_at", "desc").limit(50)
  return res.json({
    envios: filas.map((e: any) => ({
      folio: folioEnvio(e.folio), estado: e.estado, precio: Number(e.precio), tarifa: e.tarifa,
      origen: e.origen, destino: e.destino, pago_url: e.estado === "pendiente_pago" ? e.pago_url : null,
      guia: e.guia, created_at: e.created_at,
      proteccion_valor: e.proteccion_valor ? Number(e.proteccion_valor) : null,
      contenido_estado: e.contenido_estado || null,
      paquete: e.paquete,
      evidencia: leerEvidencia(e.evidencia).map(({ tipo, nombre, subido }) => ({ tipo, nombre, subido })),
      evidencia_completa: evidenciaCompleta(leerEvidencia(e.evidencia)),
    })),
  })
}

// Solicitar un envío a partir de una cotización guardada: se cobra con Mercado Pago.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const id = clienteId(req)
  if (!id) return res.status(401).json({ message: "Inicia sesión para solicitar tu envío." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablasEnvio(knex)

  const b = (req.body || {}) as any
  const cot = await knex(T_ENVIO_COT).where({ id: String(b.cotizacion_id || "") }).first()
  if (!cot) return res.status(404).json({ message: "Cotización no encontrada. Vuelve a cotizar." })
  if (Date.now() - new Date(cot.created_at).getTime() > VIGENCIA_HORAS * 3600_000)
    return res.status(410).json({ message: "La cotización ya venció. Vuelve a cotizar para ver precios actuales." })
  const d = typeof cot.datos === "string" ? JSON.parse(cot.datos) : cot.datos
  const op = d.opciones.find((o: any) => o.tarifa_id === String(b.tarifa_id || ""))
  if (!op) return res.status(404).json({ message: "Esa opción de envío ya no está disponible. Vuelve a cotizar." })

  const remitente = limpiarContacto(b.origen)
  if (typeof remitente === "string") return res.status(400).json({ message: `Remitente: ${remitente}` })
  const destinatario = limpiarContacto(b.destino)
  if (typeof destinatario === "string") return res.status(400).json({ message: `Destinatario: ${destinatario}` })
  const contenido = String(b.contenido || "").trim().slice(0, 200)
  if (contenido.length < 3) return res.status(400).json({ message: "Describe qué contiene el paquete." })
  if (b.acepta !== true) return res.status(400).json({ message: "Debes aceptar las condiciones del envío." })
  if (b.acepta_evidencia !== true)
    return res.status(400).json({ message: "Debes confirmar que tienes la evidencia fotográfica de las medidas y el peso." })
  const contenidoEstado = b.contenido_estado === "nuevo" || b.contenido_estado === "usado" ? b.contenido_estado : null
  if (!contenidoEstado) return res.status(400).json({ message: "Indica si lo que envías es nuevo o usado." })

  // Protección opcional: valor declarado del contenido -> costo con el margen de HETNA
  let proteccionValor: number | null = null
  let proteccionCosto = 0
  if (b.proteccion_valor !== undefined && b.proteccion_valor !== null && b.proteccion_valor !== "") {
    const v = Math.round(Number(b.proteccion_valor) * 100) / 100
    const cfg = configProteccion()
    if (!Number.isFinite(v) || v < cfg.valorMinimo || v > cfg.valorMaximo)
      return res.status(400).json({
        message: `El valor a proteger debe ser entre $${cfg.valorMinimo.toLocaleString("es-MX")} y $${cfg.valorMaximo.toLocaleString("es-MX")} MXN.`,
      })
    if (contenidoEstado === "usado")
      return res.status(400).json({ message: "La protección no cubre artículos usados o seminuevos." })
    proteccionValor = v
    proteccionCosto = costoProteccion(v)
  }
  const total = Math.round((Number(op.precio) + proteccionCosto) * 100) / 100

  const cliente = await knex("customer").where({ id }).first("email", "first_name", "last_name")
  const envioId = nuevoId("env")
  const [fila0] = await knex(T_ENVIO)
    .insert({
      id: envioId,
      customer_id: id,
      cotizacion_id: cot.id,
      tarifa_id: op.tarifa_id,
      tarifa: JSON.stringify(op),
      origen: JSON.stringify({ ...d.origen, ...remitente }),
      destino: JSON.stringify({ ...d.destino, ...destinatario }),
      paquete: JSON.stringify(d.paquete),
      contenido,
      precio: total,
      proteccion_valor: proteccionValor,
      proteccion_costo: proteccionValor ? proteccionCosto : null,
      contenido_estado: contenidoEstado,
      acepta_evidencia: true,
    })
    .returning(["folio"])
  const folio = folioEnvio(fila0.folio ?? fila0)

  let pagoUrl: string | null = null
  try {
    const pref = await crearPagoEnvio({
      envioId,
      folio,
      titulo: `${folio} · Envío ${op.paqueteria} ${op.servicio}${proteccionValor ? " + protección" : ""} · HETNA CNC`,
      monto: total,
      email: cliente?.email,
      retorno: `${STORE_URL}/mx/servicios/envios-hetna/listo?folio=${folio}`,
    })
    if (pref) {
      pagoUrl = pref.url
      await knex(T_ENVIO).where({ id: envioId }).update({ pago_url: pref.url, pago_estado: "pendiente", updated_at: knex.fn.now() })
    }
  } catch (e) {
    logger.error(`[envios] ${folio} no se pudo crear la liga de pago: ${(e as Error).message}`)
  }

  if (!pagoUrl) {
    if (process.env.HETNA_LEADS_EMAIL)
      await sendEmail({
        to: process.env.HETNA_LEADS_EMAIL,
        subject: `[${folio}] Envío sin liga de pago`,
        html: marco("No se pudo generar la liga de pago", `<table style="border-collapse:collapse;font-size:14px">${fila("Folio", folio)}${fila("Cliente", cliente?.email || "")}${fila("Paquetería", `${op.paqueteria} ${op.servicio}`)}${fila("Precio", `$${total} MXN`)}${proteccionValor ? fila("Protección", `valor declarado $${proteccionValor} MXN`) : ""}</table>`),
      })
    return res.status(502).json({ message: `Registramos tu envío ${folio}, pero no pudimos generar el pago. Te contactaremos por correo.` })
  }
  logger.info(`[envios] ${folio} creado (${op.paqueteria} ${op.servicio} $${total}${proteccionValor ? `, protegido por $${proteccionValor}` : ""})`)
  return res.json({ ok: true, folio, pago_url: pagoUrl })
}
