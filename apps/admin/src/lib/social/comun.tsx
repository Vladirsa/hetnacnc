// Social Hub (dashboard): tipos, estilos y llamadas al servidor que comparten
// la página (routes/social/page.tsx) y sus secciones (lib/social/*).
// Se separó de page.tsx porque el archivo pasaba de 170 KB (24 nov 2026).
import type { CSSProperties } from "react"

export type RedInfo = { clave: string; nombre: string; auto: boolean; max: number; imagen?: string }
export type Liga = { codigo: string; red: string; grupo: string | null; clics: number; url: string; eventos: Record<string, number> }
export type Pub = {
  id: string
  origen: string
  titulo: string
  texto_base: string
  textos: Record<string, string>
  redes: string[]
  medios: { url: string }[] | null
  url_destino: string
  estado: string
  programada_para: string | null
  publicada_en: string | null
  resultado: Record<string, { ok: boolean; manual?: boolean; pendiente?: boolean; error?: string; url?: string }> | null
  adaptada_ia: boolean
  created_at: string
  ligas: Liga[]
  mercado?: string | null
  notas?: string | null
  puntajes?: Record<string, { puntaje: number; revisiones: { ok: boolean; texto: string; consejo?: string }[] }>
}
export type Config = { redes: string[]; automatico: Record<string, boolean>; horario: { desde: number; hasta: number }; retraso_min: number; piloto?: { activo: boolean; minimo: number; redes: string[] }; aviso_hora?: number; primer_comentario?: boolean; youtube_auto?: boolean; auto_respuestas?: boolean; video_animado?: boolean; imagen_pro?: boolean; imagen_nueva?: boolean; max_dia?: number; separacion_h?: number; mercados_redes?: string[]; borrar_medios_dias?: number }
export type Datos = { publicaciones: Pub[]; redes: RedInfo[]; config: Config; n8n: boolean; mercados?: { clave: string; nombre: string }[] }

export const C = {
  borde: "var(--border-base, #e5e5e5)",
  fondo: "var(--bg-base, #ffffff)",
  suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)",
  tenue: "var(--fg-subtle, #6b6a63)",
  naranja: "#C2560A",
  rojo: "#b42318",
  verde: "#1E7B3A",
}
export const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
export const boton = (tipo: "primario" | "normal" | "peligro"): CSSProperties => ({
  cursor: "pointer",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 700,
  border: tipo === "normal" ? `1px solid ${C.borde}` : "none",
  background: tipo === "primario" ? C.naranja : tipo === "peligro" ? C.rojo : C.fondo,
  color: tipo === "normal" ? C.texto : "#fff",
})
export const campo: CSSProperties = { width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1px solid ${C.borde}`, padding: 8, fontSize: 14, background: C.fondo, color: C.texto }
export const ORIGEN: Record<string, string> = { manual: "Manual", licitacion: "Licitación", taller: "Taller nuevo", producto: "Producto", foro: "Foro", taller_video: "Video de taller", promociones: "Contenido generado con imagen y video (promociones diarias de producto, blog y herramientas, Oportunidades, Estudio diario y Fechas especiales)" }
export const ESTADO: Record<string, [string, string]> = {
  borrador: ["Borrador", "#8A5A00"],
  programada: ["Programada", "#1a3a5c"],
  publicando: ["Publicando…", "#1a3a5c"],
  publicada: ["Publicada", C.verde],
  parcial: ["Parcial", "#8A5A00"],
  error: ["Error", C.rojo],
  descartada: ["Descartada", C.tenue],
}
export const MSG_SESION = "No se pudo verificar tu sesión. Cierra sesión en el dashboard, vuelve a entrar y recarga."

export const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
export async function api<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(`/admin/hetna-social${ruta}`, {
    credentials: "include",
    ...(cuerpo === undefined
      ? { headers: cabeceras() }
      : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }),
  }).catch(() => null)
  if (!r) throw new Error("No se pudo conectar con el servidor.")
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d
}
export async function subirImagen(archivo: File): Promise<string> {
  const fd = new FormData()
  fd.append("files", archivo)
  const r = await fetch("/admin/uploads", { method: "POST", credentials: "include", headers: cabeceras(), body: fd })
  const d = (await r.json().catch(() => ({}))) as { files?: { url: string }[]; message?: string }
  if (!r.ok || !d.files?.[0]?.url) throw new Error(d.message || "No se pudo subir la imagen.")
  return d.files[0].url
}
export const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")
export const aLocal = (s: string | null) => {
  if (!s) return ""
  const d = new Date(s)
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 16)
}
export const copiar = (t: string) => navigator.clipboard?.writeText(t).catch(() => {})

export const nombreRed = (r: string) => ({ facebook: "Facebook", instagram: "Instagram" } as Record<string, string>)[r] || r
