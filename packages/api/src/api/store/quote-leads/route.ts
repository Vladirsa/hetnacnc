import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { SERVICIOS_SOPORTADOS, precioInstantaneo } from "../../../lib/precio-instantaneo"
import { sendEmail } from "../../../lib/resend"
import { quoteLeadEmailHtml } from "../../../lib/email-templates"

// Funnel público de ventas (job shop): calcula un estimado con el motor real
// del Cotizador CNC (hetna/cotizador/engine.js, copiado en cotizador-engine.ts)
// para los servicios que ya tienen tarifas reales, manda confirmación por
// correo y avisa a n8n para la alerta instantánea por WhatsApp. No requiere
// cuenta ni toca el Cotizador CNC (herramienta de suscripción para talleres).

type QuoteLeadBody = {
  servicio?: string
  tipo?: string
  material?: string
  ancho?: number
  largo?: number
  alto?: number
  // Plasma: "Lámina delgada (cal. 20 a 12)" o "Placa (cal. 10 o más grueso)"
  calibre?: string
  // Impresión 3D: "Prototipo rápido" | "Pieza funcional" | "Alta calidad"
  calidad?: string
  cantidad?: number
  piezas_mes_estimado?: number
  email?: string
  nombre?: string
  telefono?: string
  ciudad?: string
}

const UMBRAL_VOLUMEN_ALTO = 100

export const POST = async (req: MedusaRequest<QuoteLeadBody>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  const body = req.validatedBody || req.body || {}

  const { servicio, material, ancho, largo, alto, calibre, calidad, cantidad, piezas_mes_estimado, email, nombre, telefono, ciudad } = body

  if (!SERVICIOS_SOPORTADOS[servicio || ""]) {
    return res.status(400).json({ message: "servicio debe ser 'laser_co2', 'router', 'plasma' o 'impresion_3d'" })
  }
  if (!ancho || !largo || !cantidad || !email) {
    return res.status(400).json({ message: "Faltan campos requeridos: ancho, largo, cantidad, email" })
  }
  const precio = precioInstantaneo({ servicio, material, ancho, largo, alto, calibre, calidad, cantidad })
  if (!precio.ok) return res.status(400).json({ message: precio.mensaje })
  const { servicioCfg, resultado } = precio

  const volumenAlto = Boolean(piezas_mes_estimado && piezas_mes_estimado >= UMBRAL_VOLUMEN_ALTO)
  const whatsappNumber = process.env.OWNER_WHATSAPP_NUMBER
  const whatsappText = encodeURIComponent(
    `Hola HETNA CNC, quiero cotización formal de ${servicioCfg.nombre} (${largo}x${ancho}cm, ${cantidad} pieza(s), ${material || "material a confirmar"}).`
  )
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${whatsappText}`
    : `https://wa.me/?text=${whatsappText}`

  const { sent, reason } = await sendEmail({
    to: email,
    subject: `Tu estimado de ${servicioCfg.nombre} — ${process.env.NEXT_PUBLIC_SITE_NAME || "HETNA CNC"}`,
    html: quoteLeadEmailHtml({
      servicioNombre: servicioCfg.nombre,
      estimadoMin: resultado.pvMinimo,
      estimadoMax: resultado.pvPremium,
      whatsappUrl,
    }),
  })
  if (sent) {
    logger.info(`[quote-lead] correo enviado a ${email}`)
  } else {
    logger.info(`[quote-lead] correo no enviado a ${email}: ${reason}`)
  }

  const n8nWebhook = process.env.N8N_QUOTE_LEAD_WEBHOOK_URL
  if (n8nWebhook) {
    try {
      await fetch(n8nWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicio: servicioCfg.nombre,
          material: material || null,
          ancho,
          largo,
          cantidad,
          piezas_mes_estimado: piezas_mes_estimado || null,
          volumen_alto: volumenAlto,
          email,
          nombre: nombre || null,
          telefono: telefono || null,
          ciudad: ciudad || null,
          estimado_min: resultado.pvMinimo,
          estimado_rec: resultado.pvRecomendado,
          estimado_max: resultado.pvPremium,
        }),
      })
    } catch (e) {
      logger.error(`[quote-lead] fallo avisando a n8n: ${e}`)
    }
  }

  res.json({
    estimado: {
      minimo: resultado.pvMinimo,
      recomendado: resultado.pvRecomendado,
      maximo: resultado.pvPremium,
    },
    volumen_alto: volumenAlto,
    whatsapp_url: whatsappUrl,
  })
}
