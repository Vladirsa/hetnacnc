// Aviso «De importación» en la ficha (decisión del 24 nov 2026): el proveedor
// vende desde otro país, envía puerta a puerta con impuestos pagados (DDP) y el
// cliente lo sabe ANTES de comprar: de dónde viene, cuánto tarda y que no paga
// nada extra al recibir. Sólo sale si el vendedor lo marcó en su perfil.
import { entregaImportacion, tallerPorHandle } from "@/lib/hetna/talleres"

export async function AvisoImportacion({ handle, compacto = false }: { handle?: string | null; compacto?: boolean }) {
  if (!handle) return null
  const t = await tallerPorHandle(handle).catch(() => null)
  const imp = t?.perfil.importacion
  if (!imp) return null
  if (compacto) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FB] px-2 py-0.5 text-[11px] font-bold uppercase text-[#1a3a5c]" title={`Se envía desde ${imp.pais}`}>
        🌏 Importación
      </span>
    )
  }
  return (
    <div className="mb-3 rounded-xl border border-[#C9D6EE] bg-[#EEF2FB] p-3 text-[14px] text-[#1a3a5c]" data-testid="aviso-importacion">
      <p className="m-0 font-bold">🌏 Producto de importación · se envía desde {imp.pais}</p>
      <ul className="m-0 mt-1 list-none p-0 leading-relaxed">
        <li>📦 Puerta a puerta con paquetería internacional: {entregaImportacion(imp)}.</li>
        <li>✅ Impuestos de importación incluidos en el precio: no pagas nada extra al recibir.</li>
        <li>🛡️ Pagas dentro de HETNA: si no llega o llega dañado, te devolvemos tu dinero.</li>
      </ul>
    </div>
  )
}
