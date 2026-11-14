// Expediente digital de un proyecto (backend: packages/api/src/lib/expediente.ts)
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type SucesoExpediente = { fecha: string; tipo: string; quien: string; texto: string }
export type Expediente = {
  folio: string
  etapa: string
  etapa_nombre: string
  creada: string
  trabajo: Record<string, string | null>
  responsables: { cliente: string; taller: { nombre: string; handle: string } | null; plataforma: string }
  propuesta: {
    precio: number
    moneda: string
    dias: number
    fecha_entrega: string | null
    anticipo_pct: number | null
    incluye_envio: boolean
    garantia: string | null
    condiciones: string | null
  } | null
  contrato: { version: number; estado: string; firmado_en: string | null } | null
  entrega: { paqueteria: string | null; guia: string | null }
  archivos: { nombre: string; tamano: number; de: string; fecha: string; huella: string | null; borrado: boolean }[]
  linea: SucesoExpediente[]
  visor: "cliente" | "taller"
  huella: string
  generado: string
}

export async function verExpediente(clave: string): Promise<Expediente | null> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/expedientes/${encodeURIComponent(clave)}`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      cache: "no-store",
    })
    return res.ok ? ((await res.json()) as Expediente) : null
  } catch {
    return null
  }
}
