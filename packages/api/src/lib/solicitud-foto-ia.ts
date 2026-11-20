// Solicitud desde una foto o un boceto (estrategia 2.2, como el agente Accio
// de Alibaba): el cliente que no tiene archivo toma foto de la pieza, de un
// dibujo a mano o de una referencia, y la IA llena la solicitud de fabricación
// (qué es, proceso, material, medidas, cantidad, acabado) y dice qué le falta
// para que los talleres puedan cotizar.
//
// Regla: no inventa medidas. Sólo las pone si están escritas/acotadas en la
// imagen o en el texto del cliente; si las estima por un objeto de referencia,
// lo marca como aproximado. El cliente revisa todo antes de mandar.
import Anthropic from "@anthropic-ai/sdk"

import { IA_MODELO, modeloIA } from "./ia-modelo"

export const MEDIOS_FOTO = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
export type MedioFoto = (typeof MEDIOS_FOTO)[number]

// Mismas listas que el formulario (apps/storefront: lib/trabajos/servicios.ts y lib/fabricacion/opciones.ts)
export const PROCESOS = ["Corte CNC", "Corte láser", "Corte plasma", "Grabado", "Fresado de madera", "Fresado de metal", "Maquinado", "Impresión 3D", "Diseño CAD/CAM", "Otro"] as const
export const ACABADOS = ["Sin acabado (tal como sale de la máquina)", "Lijado", "Pintura o barniz", "Pintura electrostática", "Anodizado / galvanizado", "Doblez de lámina", "Roscado / machuelado", "Grabado (láser o fresa)", "Soldadura", "Ensamble", "No sé, que me recomienden"] as const

export type LecturaFoto = {
  es_pieza: boolean
  pieza: string
  descripcion: string
  proceso: (typeof PROCESOS)[number]
  material: string | null
  medidas: string | null
  medidas_aproximadas: boolean
  cantidad: string | null
  acabado: (typeof ACABADOS)[number] | null
  preguntas: string[]
  confianza: "alta" | "media" | "baja"
}

const textoONulo = { anyOf: [{ type: "string" }, { type: "null" }] }
const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["es_pieza", "pieza", "descripcion", "proceso", "material", "medidas", "medidas_aproximadas", "cantidad", "acabado", "preguntas", "confianza"],
  properties: {
    es_pieza: { type: "boolean" },
    pieza: { type: "string" },
    descripcion: { type: "string" },
    proceso: { type: "string", enum: [...PROCESOS] },
    material: textoONulo,
    medidas: textoONulo,
    medidas_aproximadas: { type: "boolean" },
    cantidad: textoONulo,
    acabado: { anyOf: [{ type: "string", enum: [...ACABADOS] }, { type: "null" }] },
    preguntas: { type: "array", items: { type: "string" } },
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
  },
}

const INSTRUCCIONES = `Eres un ingeniero de fabricación CNC en México que ayuda a un cliente a pedir una pieza a talleres (router CNC, láser, plasma, fresado, torno, impresión 3D). Recibes una imagen: foto de una pieza que quiere copiar o reparar, un boceto a mano, un plano acotado o una referencia de internet. Llena la solicitud para que un taller la pueda cotizar.

Reglas:
- es_pieza: false si la imagen no muestra algo que se pueda fabricar con CNC (una persona, un paisaje, una captura sin pieza). Entonces explica en descripcion qué se ve y deja lo demás en null/"Otro".
- pieza: nombre corto en español (ej. "Soporte en L de acero", "Letrero de MDF con logo", "Engrane de nylon").
- descripcion: 2 a 4 oraciones para el taller, en español de México, con lo que SÍ se ve: forma, perforaciones, ranuras, grabados, uso probable. Sin inventar.
- proceso: el más adecuado de la lista (lámina o placa plana de metal: "Corte plasma" o "Corte láser" según grosor; madera/MDF/acrílico plano: "Corte CNC" o "Corte láser"; piezas con volumen de metal: "Maquinado" o "Fresado de metal"; plástico con volumen: "Impresión 3D"; boceto que primero hay que dibujar: "Diseño CAD/CAM").
- material: el que se ve o el que diga el cliente; si no se puede saber, null.
- medidas: SÓLO si están escritas o acotadas en la imagen, o las dice el cliente, en formato "30 x 20 cm, espesor 6 mm". Si hay un objeto de referencia claro (regla, moneda, mano) puedes estimarlas y entonces medidas_aproximadas = true. Si no hay forma de saberlas, null. Nunca inventes números.
- cantidad: sólo si la dice el cliente o se lee en el plano (ej. "4 piezas"); si no, null.
- acabado: de la lista sólo si se ve claramente (pintada, anodizada); si no, null.
- preguntas: de 0 a 4 preguntas cortas que el taller necesita para cotizar y que la imagen no responde (medidas, grosor, cantidad, tolerancia, si pone el material). Empieza por la más importante.
- confianza: qué tan seguro estás de la lectura.`

export class ErrorFoto extends Error {
  constructor(msg: string, public status = 400) {
    super(msg)
  }
}

export const hayIaFotos = () => !!process.env.ANTHROPIC_API_KEY

let cliente: Anthropic | null = null

/** Limpia lo que regresó la IA (por si algo viene fuera de lo esperado). */
export function normalizarLecturaFoto(d: any): LecturaFoto {
  const txt = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null)
  const proceso = (PROCESOS as readonly string[]).includes(d?.proceso) ? d.proceso : "Otro"
  const acabado = (ACABADOS as readonly string[]).includes(d?.acabado) ? d.acabado : null
  return {
    es_pieza: d?.es_pieza !== false,
    pieza: txt(d?.pieza, 80) || "Pieza a fabricar",
    descripcion: txt(d?.descripcion, 900) || "",
    proceso,
    material: txt(d?.material, 80),
    medidas: txt(d?.medidas, 120),
    medidas_aproximadas: d?.medidas_aproximadas === true,
    cantidad: txt(d?.cantidad, 40),
    acabado,
    preguntas: (Array.isArray(d?.preguntas) ? d.preguntas : []).map((p: unknown) => txt(p, 160)).filter(Boolean).slice(0, 4) as string[],
    confianza: ["alta", "media", "baja"].includes(d?.confianza) ? d.confianza : "baja",
  }
}

export async function leerPiezaDeFoto(datosBase64: string, medio: MedioFoto, contexto?: string): Promise<LecturaFoto> {
  cliente ??= new Anthropic()
  const pedido = contexto?.trim()
    ? `Esto escribió el cliente sobre su pieza (úsalo; manda sobre lo que supongas): """${contexto.trim().slice(0, 800)}"""\n\nLlena la solicitud.`
    : "Llena la solicitud con lo que se ve en la imagen."
  let r: any
  try {
    r = await cliente.beta.messages.create({
      ...modeloIA(IA_MODELO()),
      max_tokens: 4000,
      output_config: { format: { type: "json_schema", schema: ESQUEMA as Record<string, unknown> } },
      system: INSTRUCCIONES,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: medio, data: datosBase64 } },
            { type: "text", text: pedido },
          ],
        },
      ],
    } as any)
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError) throw new ErrorFoto("No pudimos leer esa imagen. Prueba con otra foto (JPG o PNG).")
    if (e instanceof Anthropic.RateLimitError) throw new ErrorFoto("La IA está ocupada. Intenta de nuevo en un minuto.", 503)
    throw new ErrorFoto("La IA no respondió. Intenta de nuevo o llena la solicitud a mano.", 503)
  }
  if (r.stop_reason === "refusal") throw new ErrorFoto("No pudimos leer esta imagen. Prueba con otra.")
  const texto = (r.content || []).flatMap((b: any) => (b.type === "text" ? [b.text] : [])).join("")
  try {
    return normalizarLecturaFoto(JSON.parse(texto))
  } catch {
    throw new ErrorFoto("La lectura llegó incompleta. Intenta de nuevo.", 503)
  }
}

// ── Freno de gasto: por IP y por día (en memoria; se reinicia con el servidor) ──
const porIp = new Map<string, number[]>()
let dia = ""
let usosDia = 0
export function frenoFotos(ip: string, ahora = Date.now()): string | null {
  const hoy = new Date(ahora).toISOString().slice(0, 10)
  if (hoy !== dia) {
    dia = hoy
    usosDia = 0
  }
  const tope = Number(process.env.SOLICITUD_FOTO_TOPE_DIA || 300)
  if (usosDia >= tope) return "Hoy ya se usaron todas las lecturas con IA. Llena la solicitud a mano o intenta mañana."
  const l = (porIp.get(ip) || []).filter((t) => ahora - t < 3600_000)
  if (l.length >= 6) return "Ya leíste varias fotos en la última hora. Intenta en un rato o llena la solicitud a mano."
  l.push(ahora)
  porIp.set(ip, l)
  if (porIp.size > 5000) porIp.clear()
  usosDia++
  return null
}
