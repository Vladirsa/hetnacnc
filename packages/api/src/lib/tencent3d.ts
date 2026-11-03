// Tencent HY 3D Global (Hunyuan 3D) por API: imagen (o varias vistas) → modelo
// 3D con textura (GLB/OBJ) o sólo geometría. Lo usa la "Imagen a 3D" de HETNA.
//
// Llaves en .env.production: TENCENT_SECRET_ID / TENCENT_SECRET_KEY (usuario
// de CAM con sólo QcloudHunYuanFullAccess) y TENCENT_REGION (ap-singapore).
// La dirección del servicio cambió entre versiones de su documentación, así
// que se puede fijar con TENCENT_3D_ENDPOINT="host|servicio|versión"; sin eso
// se usa la de la documentación internacional (hunyuan, 2023-09-01).
//
// Firma TC3-HMAC-SHA256 hecha a mano (sin el SDK de Tencent).
import { createHash, createHmac } from "crypto"

export type Endpoint = { host: string; servicio: string; version: string }

export const ENDPOINTS: Endpoint[] = [
  { host: "hunyuan.intl.tencentcloudapi.com", servicio: "hunyuan", version: "2023-09-01" },
  { host: "ai3d.intl.tencentcloudapi.com", servicio: "ai3d", version: "2025-05-13" },
]

export function endpointConfigurado(): Endpoint {
  const crudo = process.env.TENCENT_3D_ENDPOINT
  if (crudo) {
    const [host, servicio, version] = crudo.split("|").map((s) => s.trim())
    if (host && servicio && version) return { host, servicio, version }
  }
  return ENDPOINTS[0]
}

export const tencentListo = () => !!(process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY)

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")
const hmac = (k: Buffer | string, s: string) => createHmac("sha256", k).update(s).digest()

export class ErrorTencent extends Error {
  constructor(public codigo: string, mensaje: string, public requestId?: string) {
    super(mensaje)
  }
}

/** Llama una acción de la API de Tencent Cloud y regresa `Response`. */
export async function llamar<T = any>(accion: string, cuerpo: Record<string, unknown>, ep = endpointConfigurado()): Promise<T> {
  const id = process.env.TENCENT_SECRET_ID
  const llave = process.env.TENCENT_SECRET_KEY
  if (!id || !llave) throw new ErrorTencent("SinLlaves", "Faltan TENCENT_SECRET_ID y TENCENT_SECRET_KEY")
  const region = process.env.TENCENT_REGION || "ap-singapore"

  const payload = JSON.stringify(cuerpo)
  const ts = Math.floor(Date.now() / 1000)
  const fecha = new Date(ts * 1000).toISOString().slice(0, 10)
  const tipo = "application/json; charset=utf-8"

  const canonica = [
    "POST",
    "/",
    "",
    `content-type:${tipo}\nhost:${ep.host}\nx-tc-action:${accion.toLowerCase()}\n`,
    "content-type;host;x-tc-action",
    sha256(payload),
  ].join("\n")
  const alcance = `${fecha}/${ep.servicio}/tc3_request`
  const aFirmar = ["TC3-HMAC-SHA256", String(ts), alcance, sha256(canonica)].join("\n")
  const kFecha = hmac(`TC3${llave}`, fecha)
  const kServicio = hmac(kFecha, ep.servicio)
  const kFirma = hmac(kServicio, "tc3_request")
  const firma = createHmac("sha256", kFirma).update(aFirmar).digest("hex")

  const res = await fetch(`https://${ep.host}/`, {
    method: "POST",
    headers: {
      Authorization: `TC3-HMAC-SHA256 Credential=${id}/${alcance}, SignedHeaders=content-type;host;x-tc-action, Signature=${firma}`,
      "Content-Type": tipo,
      Host: ep.host,
      "X-TC-Action": accion,
      "X-TC-Timestamp": String(ts),
      "X-TC-Version": ep.version,
      "X-TC-Region": region,
    },
    body: payload,
  })
  const j = (await res.json().catch(() => ({}))) as { Response?: any }
  const r = j.Response || {}
  if (r.Error) throw new ErrorTencent(r.Error.Code || "Error", r.Error.Message || "Error de Tencent", r.RequestId)
  if (!res.ok) throw new ErrorTencent(`HTTP${res.status}`, `Tencent respondió ${res.status}`)
  return r as T
}

// ---------------------------------------------------------------------
// Imagen a 3D (versión Profesional)
// ---------------------------------------------------------------------

export type Vista = "left" | "right" | "back" | "top" | "bottom" | "left_front" | "right_front"

export type PedidoModelo = {
  imagenUrl?: string // la vista de frente
  imagenBase64?: string
  vistas?: { vista: Vista; url: string }[] // vistas extra (imágenes múltiples)
  modelo?: "3.0" | "3.1"
  tipo?: "Normal" | "Geometry" | "LowPoly" // Normal = con textura; Geometry = modelo blanco
  caras?: number // 40 000 a 1 500 000
  pbr?: boolean // materiales PBR (metal/rugosidad), sólo con textura
}

export async function enviarModelo(p: PedidoModelo, ep?: Endpoint): Promise<string> {
  const cuerpo: Record<string, unknown> = {}
  if (p.imagenUrl) cuerpo.ImageUrl = p.imagenUrl
  if (p.imagenBase64) cuerpo.ImageBase64 = p.imagenBase64
  if (p.vistas?.length) cuerpo.MultiViewImages = p.vistas.map((v) => ({ ViewType: v.vista, ViewImageUrl: v.url }))
  if (p.modelo) cuerpo.Model = p.modelo
  if (p.tipo) cuerpo.GenerateType = p.tipo
  if (p.caras) cuerpo.FaceCount = Math.max(40000, Math.min(1500000, Math.round(p.caras)))
  if (p.pbr !== undefined && p.tipo !== "Geometry") cuerpo.EnablePBR = p.pbr
  const r = await llamar<{ JobId?: string }>("SubmitHunyuanTo3DProJob", cuerpo, ep)
  if (!r.JobId) throw new ErrorTencent("SinJobId", "Tencent no regresó el número de trabajo")
  return r.JobId
}

export type ArchivoModelo = { tipo: string; url: string; vistaPrevia?: string }
export type EstadoModelo = { estado: "WAIT" | "RUN" | "FAIL" | "DONE" | string; archivos: ArchivoModelo[]; error?: string }

export async function consultarModelo(jobId: string, ep?: Endpoint): Promise<EstadoModelo> {
  const r = await llamar<{ Status?: string; ErrorCode?: string; ErrorMessage?: string; ResultFile3Ds?: any[] }>(
    "QueryHunyuanTo3DProJob",
    { JobId: jobId },
    ep
  )
  return {
    estado: r.Status || "WAIT",
    archivos: (r.ResultFile3Ds || []).map((f) => ({ tipo: String(f.Type || "").toUpperCase(), url: f.Url, vistaPrevia: f.PreviewImageUrl })),
    error: r.ErrorCode || r.ErrorMessage ? `${r.ErrorCode || ""} ${r.ErrorMessage || ""}`.trim() : undefined,
  }
}

/**
 * Qué dirección del servicio acepta las llaves, sin gastar créditos: consulta
 * un trabajo que no existe. "No existe" = firma y permiso bien; "AuthFailure"
 * o "UnsupportedOperation" = esa dirección no es.
 */
export async function detectarEndpoint(): Promise<{ ep: Endpoint; respuesta: string }[]> {
  const out: { ep: Endpoint; respuesta: string }[] = []
  for (const ep of ENDPOINTS) {
    try {
      await consultarModelo("0000000000000000000", ep)
      out.push({ ep, respuesta: "OK (respondió sin error)" })
    } catch (e) {
      const t = e as ErrorTencent
      out.push({ ep, respuesta: `${t.codigo || "?"}: ${String(t.message).slice(0, 160)}` })
    }
  }
  return out
}
