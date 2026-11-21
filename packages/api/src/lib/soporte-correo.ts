// Agente de soporte por correo (decidido por Vlado el 21 nov 2026): contesta a
// clientes y talleres que escriben a contacto@hetnacnc.com y NO son prospectos
// de la campaña (esos los atiende lib/correo-respuesta.ts).
//
// n8n («Agente HETNA - Soporte») lee el buzón, descarta rebotes, respuestas
// automáticas y prospectos, y llama a POST /admin/hetna-soporte-correo:
//   - responder = true  -> pregunta frecuente con respuesta en los datos de abajo:
//     n8n la manda y te avisa por Telegram con lo que contestó.
//   - responder = false -> pedido, pago, devolución, queja, factura, algo legal o
//     que no está en los datos: NO se manda nada; te llega a Telegram con un
//     borrador listo para que contestes tú.
import Anthropic from "@anthropic-ai/sdk"
import type { MedusaContainer } from "@medusajs/framework/types"

import { datos } from "./correo-respuesta"
import { IA_MODELO_WHATSAPP, modeloIA } from "./ia-modelo"
import { STORE_URL } from "./licitacion"
import { iaSocial } from "./social-hub"

// Copia de las preguntas frecuentes de la tienda
// (apps/storefront/src/app/[locale]/(main)/preguntas-frecuentes/page.tsx).
// Si cambias una respuesta allá, cámbiala aquí.
export const FAQ = [
  "¿Qué es HETNA CNC? Un marketplace mexicano especializado en CNC: servicios de fabricación (corte láser, router, plasma, maquinado e impresión 3D) con talleres de todo México y diseños digitales listos para cortar. Las máquinas, herramientas y materiales se cotizan con proveedores mientras se suma inventario publicado.",
  "¿Cómo compro un producto? Agrégalo al carrito, escribe tu dirección de entrega y elige Envíos HETNA. Verás el costo del envío antes de pagar.",
  "¿Cuánto cuesta el envío y cuánto tarda? Envíos HETNA calcula el costo con tu código postal en el checkout, junto con los días estimados de entrega. El costo depende del peso, medidas y destino.",
  "¿Qué formas de pago aceptan? Pagos con Mercado Pago. Para compras grandes o trabajos cotizados también puedes pagar por transferencia SPEI; escríbenos para darte los datos.",
  "¿Cómo pido una cotización de maquila o corte? En Cotizar describes tu trabajo (material, cantidad, medidas y fecha) y subes sus archivos (DXF, SVG, STL, STEP y más). HETNA revisa tu solicitud y la publica a los talleres de la red, que te mandan propuestas; las comparas y eliges. Para corte láser, router, plasma e impresión 3D tienes además un precio estimado al instante.",
  "¿Mis datos los ve el taller? No. Tus datos de contacto solo los ve HETNA. El taller recibe la descripción del trabajo y la cotización pasa por la plataforma, así tu compra queda protegida.",
  "¿Puedo devolver un producto? Sí, en productos físicos sin uso dentro de 5 días hábiles después de recibirlos. Los trabajos fabricados a la medida y los diseños digitales descargados no tienen devolución, salvo defecto. Consulta la política completa de devoluciones.",
  "¿Cómo rastreo mi pedido? Entra a tu cuenta, en Mis pedidos, para ver el estado de cada compra.",
  "Tengo un taller, ¿cómo vendo en HETNA? Regístrate como vendedor, completa tu Perfil público (servicios, máquinas, materiales y tiempos de entrega) y publica tus productos. Tu taller aparece en el directorio de talleres por estado.",
  "¿Cuál es el horario de atención? Lunes a viernes de 9:00 a 18:00 h (hora del centro de México). Por WhatsApp te respondemos en ese horario.",
  `Páginas útiles: preguntas frecuentes ${STORE_URL}/mx/preguntas-frecuentes · devoluciones ${STORE_URL}/mx/devoluciones · formas de pago ${STORE_URL}/mx/formas-de-pago · cotizar ${STORE_URL}/mx/cotizar · talleres ${STORE_URL}/mx/talleres · vender ${STORE_URL}/mx/talleres/unete`,
]

export type CorreoSoporte = { de: string; asunto: string; texto: string; anteriores?: number }
export type RespuestaSoporte = { responder: boolean; asunto: string; cuerpo: string; borrador: string; categoria: string; motivo: string; resumen: string }

const CATEGORIAS = ["pregunta_general", "como_comprar", "envios", "pagos", "cotizar", "vender", "cuenta", "pedido", "devolucion", "factura", "queja", "otro"]
const SOLAS = ["pregunta_general", "como_comprar", "envios", "pagos", "cotizar", "vender", "cuenta"]

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["categoria", "responder", "cuerpo", "motivo", "resumen"],
  properties: {
    categoria: { type: "string", enum: CATEGORIAS },
    responder: { type: "boolean" },
    cuerpo: { type: "string" },
    motivo: { type: "string" },
    resumen: { type: "string" },
  },
}

const SISTEMA = (d: string[]) =>
  "Eres Vladimir Rivera, de atención a clientes de HETNA CNC (marketplace mexicano de fabricación CNC). " +
  "Contestas correos de clientes y talleres que escriben a contacto@hetnacnc.com.\n\n" +
  "Cómo escribes: correo cordial y breve, en el idioma del mensaje (español de México por defecto), tratando de usted. " +
  "Contesta lo que preguntan, con pasos concretos y la liga de la página que sirve. Termina ofreciendo ayuda por WhatsApp +52 221 707 6014. " +
  "Firma: «Saludos cordiales,» y en otra línea «Vladimir Rivera», luego «HETNA CNC · hetnacnc.com». Texto plano, sin Markdown ni HTML.\n\n" +
  "Siempre escribe en cuerpo la mejor respuesta posible (aunque responder sea false: servirá de borrador para una persona).\n" +
  "responder = true SÓLO si la categoría es una de estas: " + SOLAS.join(", ") + ", y TODO lo que contestas está en los datos de abajo.\n" +
  "responder = false si es sobre un pedido o pago concreto, devolución, factura, queja, algo legal o fiscal, piden descuento o trato especial, " +
  "o la respuesta necesita algo que no está en los datos. En motivo explica por qué.\n" +
  "Nunca inventes precios, plazos, estados de pedidos, políticas ni funciones. resumen: una línea para el equipo.\n\n" +
  "Datos de HETNA (lo único que puedes afirmar):\n- " + d.join("\n- ")

let ia: Anthropic | null = null

export async function redactarSoporte(container: MedusaContainer, c: CorreoSoporte): Promise<RespuestaSoporte> {
  const asunto = /^re:/i.test(c.asunto.trim()) ? c.asunto.trim() : `Re: ${c.asunto.trim() || "HETNA CNC"}`
  const vacio = { responder: false, asunto, cuerpo: "", borrador: "", categoria: "otro", resumen: "" }
  if (!iaSocial()) return { ...vacio, motivo: "No hay IA configurada en el servidor." }
  ia ??= new Anthropic()
  const resp = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO_WHATSAPP()),
    max_tokens: 1500,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
    system: SISTEMA([...FAQ, ...(await datos(container))]),
    messages: [{ role: "user", content: `Correo de ${c.de}.\nAsunto: ${c.asunto}\n\n${String(c.texto || "").slice(0, 6000)}` }],
  } as any)
  if ((resp as any).stop_reason === "refusal") return { ...vacio, motivo: "La IA no pudo contestar este correo." }
  const r = JSON.parse((resp as any).content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
  const cuerpo = String(r.cuerpo || "").trim()
  const categoria = CATEGORIAS.includes(r.categoria) ? r.categoria : "otro"
  // Doble candado: aunque la IA diga que sí, sólo salen solas las categorías seguras
  // y nunca más de 2 respuestas automáticas al mismo remitente.
  const responder = !!r.responder && SOLAS.includes(categoria) && cuerpo.length > 40 && (c.anteriores || 0) < 2
  return { responder, asunto, cuerpo: responder ? cuerpo : "", borrador: cuerpo, categoria, motivo: String(r.motivo || ""), resumen: String(r.resumen || "") }
}
