// Licitaciones 3.0 — Fase 2: resumen de propuestas escrito por IA (Claude).
//
// Explica en español sencillo las diferencias entre propuestas y lo que le
// falta a cada una. NUNCA recomienda un ganador ni inventa datos: sólo usa lo
// que los talleres escribieron (regla "la IA no adjudica").
//
// Requiere ANTHROPIC_API_KEY en el .env de packages/api. Sin llave, la
// comparación sigue funcionando con las reglas de lib/licitacion-propuesta.ts.
// LICITACION_IA=off la apaga.
import Anthropic from "@anthropic-ai/sdk"

import type { PropuestaComparable } from "./licitacion-propuesta"

const MODELO = process.env.LICITACION_IA_MODELO || "claude-opus-5-5"

export const iaDisponible = () => !!process.env.ANTHROPIC_API_KEY && (process.env.LICITACION_IA || "").toLowerCase() !== "off"

let cliente: Anthropic | null = null
const clienteIa = () => (cliente ??= new Anthropic())

const SISTEMA = `Eres el asistente de comparación de cotizaciones de HETNA CNC, un marketplace mexicano de fabricación CNC.
Ayudas a un cliente a entender las propuestas que recibió de talleres para su pieza.
Reglas:
- Escribe en español de México, claro y breve, para alguien que no es experto.
- Usa SOLO los datos que vienen en las propuestas. No inventes precios, capacidades, certificaciones, garantías ni plazos.
- NO elijas ni recomiendes un ganador. La decisión es del cliente. Explica diferencias y puntos a preguntar.
- Señala lo que falta en cada propuesta (garantía, forma de pago, material, procesos, fecha) para que el cliente lo pregunte.
- Si hay monedas distintas, adviértelo.
- Responde en 4 a 8 viñetas cortas, sin encabezados ni tablas.`

/** Resumen corto. Devuelve null si no hay IA o si falla (la página sigue con las reglas). */
export async function resumirPropuestas(
  solicitud: { servicio?: string; material?: string; cantidad?: string },
  propuestas: PropuestaComparable[],
  logger?: { warn?: (m: string) => void }
): Promise<string | null> {
  if (!iaDisponible() || propuestas.length < 2) return null
  const datos = {
    trabajo: { servicio: solicitud.servicio || "", material: solicitud.material || "", cantidad: solicitud.cantidad || "" },
    propuestas: propuestas.map((p, i) => ({
      etiqueta: `Propuesta ${i + 1} (${p.taller})`,
      precio: p.precio,
      moneda: p.moneda || "MXN",
      dias_entrega: p.dias,
      fecha_entrega: p.fecha_entrega || null,
      incluye_envio: p.incluye_envio,
      anticipo_pct: p.anticipo_pct ?? 100,
      materiales: p.materiales || null,
      operaciones: p.operaciones || null,
      condiciones_pago: p.condiciones_pago || null,
      garantia: p.garantia || null,
      observaciones: p.observaciones || null,
      condiciones: p.condiciones || null,
      calificacion_taller: p.calificacion ?? null,
      taller_verificado: !!p.verificado,
      archivos_adjuntos: p.adjuntos || 0,
    })),
  }
  try {
    const r = await clienteIa().beta.messages.create({
      model: MODELO,
      max_tokens: 2000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SISTEMA,
      messages: [{ role: "user", content: `Compara estas propuestas para el cliente:\n${JSON.stringify(datos)}` }],
    } as any)
    if (r.stop_reason === "refusal") return null
    const texto = r.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: any) => b.text as string)
      .join("\n")
      .trim()
    return texto || null
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) logger?.warn?.("[licitacion-ia] límite de uso de la IA; se usa la comparación sin IA")
    else if (e instanceof Anthropic.AuthenticationError) logger?.warn?.("[licitacion-ia] la llave de Claude no es válida")
    else if (e instanceof Anthropic.APIError) logger?.warn?.(`[licitacion-ia] error ${e.status}: ${e.message}`)
    else logger?.warn?.(`[licitacion-ia] ${(e as Error).message}`)
    return null
  }
}
