// Arma los modelos 3D paramétricos fuera del hilo principal (25 nov 2026): con
// manifold en la página, el navegador se trababa más de un segundo al abrir un
// modelo (Lighthouse: 1.1 s de bloqueo) y al mover los deslizadores.
import { construirMalla, modeloPorId } from "@/lib/generador/modelos3d"

export type PedidoModelo = { id: number; modelo: string; valores: Record<string, number> }

self.onmessage = async (e: MessageEvent<PedidoModelo>) => {
  const { id, modelo, valores } = e.data
  try {
    const m = modeloPorId(modelo)
    if (!m) throw new Error("modelo desconocido")
    self.postMessage({ id, malla: await construirMalla(m, valores) })
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
