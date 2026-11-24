// Calcula la celosía desde imagen fuera del hilo principal: la página no se
// traba mientras el cliente mueve esquinas o cambia medidas.
import { type OpcionesCelosiaImagen, grisSuave, hacerCelosiaImagen } from "@/lib/generador/celosiaImagen"
import type { Imagen } from "@/lib/generador/trazado"

export type PedidoCelosia = { id: number; imagen?: Imagen; opciones: OpcionesCelosiaImagen }

let imagen: Imagen | null = null
let gris: Uint8Array | null = null

self.onmessage = (e: MessageEvent<PedidoCelosia>) => {
  const { id, opciones } = e.data
  try {
    if (e.data.imagen) {
      imagen = e.data.imagen
      gris = grisSuave(imagen)
    }
    if (!imagen || !gris) throw new Error("sin imagen")
    self.postMessage({ id, resultado: hacerCelosiaImagen(imagen, opciones, gris) })
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
