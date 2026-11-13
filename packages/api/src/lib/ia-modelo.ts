// Modelo de IA para todo el sistema (redes, Fábrica, agente de WhatsApp, campañas…).
// Por defecto el más barato (Claude Haiku 5.5: unas 40 veces más barato que Opus).
// Para cambiarlo sin tocar código: IA_MODELO=claude-sonnet-5-5 (o claude-opus-5-5)
// en el .env del backend.
export const IA_MODELO = () => (process.env.IA_MODELO || "claude-haiku-5-5").trim()

/** `model` (y, en los modelos que lo aceptan, el respaldo del servidor si el modelo declina). */
export function modeloIA(): Record<string, any> {
  const model = IA_MODELO()
  // Haiku no tiene respaldo en el servidor: se manda sólo el modelo
  if (/haiku/i.test(model)) return { model }
  return { model, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }
}
