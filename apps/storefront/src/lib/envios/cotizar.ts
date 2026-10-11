"use server"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type OpcionEnvio = { paqueteria: string; servicio: string; dias: number | null; precio: number }
export type ResultadoEnvio =
  | { ok: true; opciones: OpcionEnvio[]; volumetrico: number; peso_cobrado?: number; aviso?: string }
  | { ok: false; mensaje: string }

export async function cotizarEnvio(d: {
  cp_origen: string
  cp_destino: string
  peso: string
  largo: string
  ancho: string
  alto: string
}): Promise<ResultadoEnvio> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/envios/cotizar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
      },
      body: JSON.stringify(d),
      cache: "no-store",
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, mensaje: body.message || "No pudimos cotizar. Intenta de nuevo." }
    return { ok: true, opciones: body.opciones || [], volumetrico: body.volumetrico, peso_cobrado: body.peso_cobrado, aviso: body.message }
  } catch {
    return { ok: false, mensaje: "No pudimos cotizar. Intenta de nuevo." }
  }
}
