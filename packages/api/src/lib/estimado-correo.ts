// Validación de "Mándame este estimado por correo" (api/store/estimado-correo).
// El rango lo calculó el navegador: se acepta sólo dentro de límites sensatos.
import type { NuevoEstimado } from "./estimados"

const corto = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)

export function validarEstimadoCorreo(
  b: Record<string, unknown>
): { ok: true; datos: NuevoEstimado & { email: string; servicio: string; estimado_min: number; estimado_max: number; cantidad: number } } | { ok: false; mensaje: string } {
  if (b.acepta !== true) return { ok: false, mensaje: "Marca la casilla para que te mandemos el estimado." }
  const email = corto(b.email, 160).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, mensaje: "Revisa tu correo." }
  const min = Math.round(Number(b.estimado_min))
  const max = Math.round(Number(b.estimado_max))
  if (!(min > 0) || !(max >= min) || max > min * 4 || max > 5_000_000) return { ok: false, mensaje: "No pudimos leer el estimado. Vuelve a calcularlo." }
  const servicio = corto(b.servicio, 60)
  if (!servicio) return { ok: false, mensaje: "Falta el servicio." }
  const cantidad = Math.max(1, Math.min(1_000_000, Math.round(Number(b.cantidad) || 1)))
  const mm = (v: unknown) => (Number(v) > 0 ? Math.min(100_000, Number(v)) : undefined)
  return {
    ok: true,
    datos: {
      email,
      nombre: corto(b.nombre, 120) || null,
      servicio,
      material: corto(b.material, 120) || null,
      // El cotizador mide en mm; la tabla de estimados guarda cm (como /store/quote-leads)
      ancho: mm(b.ancho_mm) ? Math.round(mm(b.ancho_mm)!) / 10 : undefined,
      largo: mm(b.largo_mm) ? Math.round(mm(b.largo_mm)!) / 10 : undefined,
      cantidad,
      estimado_min: min,
      estimado_max: max,
    },
  }
}
