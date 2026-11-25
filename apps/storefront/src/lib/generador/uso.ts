// Uso de las herramientas del Estudio para el tablero semanal (qué herramienta
// trae visitas, descargas, cotizaciones y fabricación). Las acciones avisan con
// un evento del navegador y ContarUsoHerramienta (en la página de la
// herramienta) lo cuenta; así ninguna herramienta tiene que saber del tablero.
export const EVENTOS_USO = ["vista", "descarga", "cotizar", "fabricar", "correo", "cam"] as const
export type EventoUso = (typeof EVENTOS_USO)[number]
export const EVENTO_USO = "hetna-uso-herramienta"

/** Avisa que pasó algo en la herramienta abierta (no hace nada fuera del navegador). */
export function avisarUso(evento: EventoUso) {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_USO, { detail: evento }))
  } catch {
    // es una estadística: nunca rompe la herramienta
  }
}
