// Respuesta automática a los correos de prospectos (decidido por Vlado el 17 nov 2026).
//
// n8n («Prospectos HETNA - Respuestas del correo») lee contacto@hetnacnc.com; si
// un prospecto contesta con una pregunta, llama a POST /admin/hetna-responder-correo
// y manda lo que regresa. Reglas:
//   - Sólo datos reales: la lista de precios (lib/tarifas.ts) y el catálogo del
//     agente de WhatsApp (catalogoVentas). Nunca inventa precios, descuentos,
//     plazos, funciones ni acuerdos.
//   - Si piden negociar, un trato especial, hay una queja, un tema legal o fiscal,
//     o no se puede contestar con estos datos: NO responde y te avisa para que
//     contestes tú (responder = false).
//   - Tono de correo de empresa, en el idioma del prospecto, tratando de usted.
import Anthropic from "@anthropic-ai/sdk"
import type { MedusaContainer } from "@medusajs/framework/types"

import { IA_MODELO_WHATSAPP, modeloIA } from "./ia-modelo"
import { STORE_URL } from "./licitacion"
import { iaSocial } from "./social-hub"
import { tarifasHetna } from "./tarifas"
import { catalogoVentas } from "./whatsapp-bot"

export type CorreoEntrante = { de: string; asunto: string; texto: string; empresa?: string; tipo?: string; pais?: string; anteriores?: number }
export type RespuestaCorreo = { responder: boolean; asunto: string; cuerpo: string; motivo: string; resumen: string }

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["responder", "cuerpo", "motivo", "resumen"],
  properties: {
    responder: { type: "boolean" },
    cuerpo: { type: "string" },
    motivo: { type: "string" },
    resumen: { type: "string" },
  },
}

const EXTRA = [
  `Taller fundador: los primeros 30 talleres o vendedores verificados reciben la insignia de Taller fundador para siempre y 6 meses del plan Pro gratis (sus propuestas salen primero). Se pide verificando el taller desde su panel. Más información: ${STORE_URL}/mx/talleres/fundadores`,
  "Academia HETNA: los cursos que se publican en la Academia son cursos grabados (lecciones en video por secciones, con lecciones de muestra gratis). Publicar es gratis y la comisión por venta está en la lista de precios. Los cursos gratis no pagan comisión.",
  "Cursos en vivo (en línea, presenciales o en la planta del cliente): todavía no hay una sección especial; se publican como servicio en la tienda del vendedor indicando modalidad, fecha, duración, cupo y precio. El cliente paga dentro de HETNA y el vendedor imparte el curso. Paga la comisión general de productos y servicios.",
  "Software, licencias (si son distribuidores autorizados), implementación, soporte, capacitación en planta y otros servicios se pueden publicar como productos o servicios en la tienda del vendedor, con la comisión general. Publicar es gratis.",
  `Proceso para empezar: 1) registrarse gratis en ${STORE_URL}/mx/talleres/unete, 2) confirmar su correo (la cuenta queda activa), 3) completar el perfil, 4) publicar desde su panel (Cursos para cursos grabados; Publicar para productos, servicios y cursos en vivo), 5) cada venta se paga con Mercado Pago dentro de HETNA y se abona a su saldo; cada vendedor factura (CFDI) directo a su cliente.`,
  `Términos completos para vendedores: ${STORE_URL}/mx/terminos-vendedores`,
  "Contacto: correo contacto@hetnacnc.com y WhatsApp +52 221 707 6014. Se puede ofrecer una videollamada de 15 minutos para ayudarles a dar de alta su cuenta (la agenda Vladimir, del equipo de HETNA).",
]

export async function datos(container: MedusaContainer): Promise<string[]> {
  const l = [...catalogoVentas(), ...EXTRA]
  try {
    const { grupos } = await tarifasHetna(container)
    for (const g of grupos) {
      l.push(`${g.titulo}: ${g.filas.map((f) => `${f.concepto} = ${f.precio}${f.nota ? ` (${f.nota})` : ""}`).join("; ")}`)
    }
  } catch {
    // sin la lista de precios, no se habla de comisiones (ver reglas)
  }
  return l
}

const SISTEMA = (d: string[]) =>
  "Eres Vladimir Rivera, del equipo de HETNA CNC (marketplace mexicano de fabricación CNC: talleres, proveedores, instructores y clientes). " +
  "Contestas por correo a empresas que respondieron a nuestra invitación. Tu meta es resolver sus dudas con claridad y llevarlas a registrarse y publicar.\n\n" +
  "Cómo escribes:\n" +
  "- Correo de empresa, cordial y profesional, tratando de usted, en el idioma del mensaje (español de México por defecto; inglés o portugués si escriben así).\n" +
  "- Contesta punto por punto lo que preguntan, con títulos cortos o viñetas si son varias preguntas. Breve: lo necesario.\n" +
  "- Termina con el siguiente paso (registro o liga) y ofrece la videollamada de 15 minutos o el WhatsApp. Firma: «Saludos cordiales,» y en otra línea «Vladimir Rivera», luego «HETNA CNC · hetnacnc.com».\n" +
  "- cuerpo: sólo el texto del correo, sin asunto, en texto plano con saltos de línea (nada de Markdown, asteriscos ni HTML).\n\n" +
  "Reglas que no se rompen:\n" +
  "- Usa SÓLO los datos de abajo. Nunca inventes precios, porcentajes, descuentos, plazos, funciones de la plataforma, integraciones ni acuerdos. Si algo no está en los datos, di que lo confirmas y que les escribes en breve (y pon responder = false si es lo principal que preguntan).\n" +
  "- responder = false (no se manda nada; contesta una persona) si: piden descuento, negociar comisiones o un trato especial; es una queja o un problema con un pedido o pago; preguntan algo legal, fiscal o de contratos; piden que les llamen a una hora; o el mensaje no es una pregunta sobre HETNA. En ese caso cuerpo vacío y en motivo explica por qué.\n" +
  "- resumen: una línea para el equipo con lo que preguntaron y lo que contestaste.\n\n" +
  "Datos de HETNA (lo único que puedes afirmar):\n- " + d.join("\n- ")

let ia: Anthropic | null = null

export async function redactarRespuestaCorreo(container: MedusaContainer, c: CorreoEntrante): Promise<RespuestaCorreo> {
  const asuntoRe = /^re:/i.test(c.asunto.trim()) ? c.asunto.trim() : `Re: ${c.asunto.trim() || "HETNA CNC"}`
  if (!iaSocial()) return { responder: false, asunto: asuntoRe, cuerpo: "", motivo: "No hay IA configurada en el servidor.", resumen: "" }
  if ((c.anteriores || 0) >= 3) {
    return { responder: false, asunto: asuntoRe, cuerpo: "", motivo: "Ya se le contestó en automático 3 veces: mejor que siga una persona.", resumen: "" }
  }
  ia ??= new Anthropic()
  const resp = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO_WHATSAPP()),
    max_tokens: 1500,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
    system: SISTEMA(await datos(container)),
    messages: [
      {
        role: "user",
        content:
          `Correo de ${c.empresa || c.de} (${[c.tipo, c.pais].filter(Boolean).join(", ") || "prospecto"}), de ${c.de}.\n` +
          `Asunto: ${c.asunto}\n\n${String(c.texto || "").slice(0, 6000)}`,
      },
    ],
  } as any)
  if ((resp as any).stop_reason === "refusal") {
    return { responder: false, asunto: asuntoRe, cuerpo: "", motivo: "La IA no pudo contestar este correo.", resumen: "" }
  }
  const r = JSON.parse((resp as any).content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
  const cuerpo = String(r.cuerpo || "").trim()
  return {
    responder: !!r.responder && cuerpo.length > 40,
    asunto: asuntoRe,
    cuerpo,
    motivo: String(r.motivo || ""),
    resumen: String(r.resumen || ""),
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string)

/** ¿La dirección es de hetnacnc.com (o un subdominio), por https y sin trucos
 *  de usuario@? Sólo esas se vuelven liga: el texto lo escribe la IA a partir
 *  del correo de un extraño, que puede traer instrucciones escondidas para que
 *  salga una liga ajena firmada por HETNA. */
export function esLigaDeHetna(direccion: string): boolean {
  if (direccion.includes("\\")) return false
  try {
    const u = new URL(direccion)
    const host = u.hostname.toLowerCase()
    return u.protocol === "https:" && !u.username && !u.password && (host === "hetnacnc.com" || host.endsWith(".hetnacnc.com"))
  } catch {
    return false
  }
}

/** El cuerpo en HTML sencillo (párrafos y ligas), para el correo. Las
 *  direcciones que no son de HETNA se quedan como texto. */
export function cuerpoHtml(cuerpo: string): string {
  const parrafos = cuerpo.split(/\n{2,}/).map((p) =>
    esc(p)
      .replace(/(https?:\/\/[^\s<]+[^\s<.,)])/g, (d) => (esLigaDeHetna(d) ? `<a href="${d}">${d}</a>` : d))
      .replace(/\n/g, "<br>")
  )
  return (
    '<!doctype html><html lang="es"><head><meta charset="utf-8"></head>' +
    '<body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2937;max-width:640px;margin:0;padding:16px">' +
    parrafos.map((p) => `<p>${p}</p>`).join("") +
    "</body></html>"
  )
}
