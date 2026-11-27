// Bloques de la ficha universal (lib/hetna/tipo-producto.ts) que van debajo
// de la zona de compra: especificaciones, qué incluye / qué no incluye, y
// entrega con garantía. Cada bloque se oculta completo si no tiene datos.
import { TS } from "@/i18n/TS"
import { especificaciones, incluyeDe, tipoProducto } from "@/lib/hetna/tipo-producto"

type Producto = Parameters<typeof especificaciones>[0]

export const EspecificacionesFicha = ({ product }: { product: Producto }) => {
  const filas = especificaciones(product)
  if (!filas.length) return null
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#E7E4DC] bg-white" data-testid="ficha-especificaciones">
      <h2 className="m-0 border-b border-[#E7E4DC] px-4 py-3 text-[16px] font-bold text-[#142033]"><TS>Especificaciones</TS></h2>
      <table className="w-full border-collapse text-[14px]">
        <tbody>
          {filas.map(([k, v], i) => (
            <tr key={k} className={i % 2 ? "bg-white" : "bg-[#FAF9F6]"}>
              <th scope="row" className="w-[38%] px-4 py-2.5 text-left align-top font-semibold text-[#4A4943]">
                <TS>{k}</TS>
              </th>
              <td className="px-4 py-2.5 align-top text-[#1B1B18]"><TS>{v}</TS></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export const IncluyeFicha = ({ product }: { product: Producto }) => {
  const { incluye, noIncluye } = incluyeDe(product)
  if (!incluye.length && !noIncluye.length) return null
  return (
    <section className="grid gap-3 sm:grid-cols-2" data-testid="ficha-incluye">
      {incluye.length > 0 && (
        <div className="rounded-[14px] border border-[#CFE8D7] bg-[#F3FAF5] p-4">
          <h2 className="m-0 mb-2 text-[15px] font-bold text-[#17633A]"><TS>Qué incluye</TS></h2>
          <ul className="m-0 list-none space-y-1.5 p-0">
            {incluye.map((t) => (
              <li key={t} className="flex gap-2 text-[14px] text-[#2E2D29]">
                <span aria-hidden="true" className="font-bold text-[#17803F]">✓</span>
                <TS>{t}</TS>
              </li>
            ))}
          </ul>
        </div>
      )}
      {noIncluye.length > 0 && (
        <div className="rounded-[14px] border border-[#F2D3CF] bg-[#FDF5F4] p-4">
          <h2 className="m-0 mb-2 text-[15px] font-bold text-[#9B3225]"><TS>Qué no incluye</TS></h2>
          <ul className="m-0 list-none space-y-1.5 p-0">
            {noIncluye.map((t) => (
              <li key={t} className="flex gap-2 text-[14px] text-[#2E2D29]">
                <span aria-hidden="true" className="font-bold text-[#9B3225]">✕</span>
                <TS>{t}</TS>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** Entrega y garantía de los productos físicos. La licencia de los digitales
 *  y el plazo de los servicios ya tienen su propio bloque. */
export const EntregaGarantia = ({ product }: { product: Producto }) => {
  const tipo = tipoProducto(product)
  if (tipo === "digital" || tipo === "servicio") return null
  const m = (product.metadata || {}) as Record<string, unknown>
  const t = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const produccion = t(m.tiempo_produccion)
  const entrega = t(m.entrega)
  const garantia = t(m.garantia)
  if (!produccion && !entrega && !garantia) return null
  return (
    <section className="grid gap-3 sm:grid-cols-2" data-testid="ficha-entrega-garantia">
      {(produccion || entrega) && (
        <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
          <h2 className="m-0 mb-2 text-[15px] font-bold text-[#142033]"><TS>🚚 Entrega</TS></h2>
          {produccion && (
            <p className="m-0 text-[14px] text-[#2E2D29]">
              <strong><TS>Tiempo de producción:</TS></strong> <TS>{produccion}</TS>
            </p>
          )}
          {entrega && <p className="m-0 mt-1 text-[14px] text-[#2E2D29]"><TS>{entrega}</TS></p>}
          <p className="m-0 mt-1 text-[13px] text-[#6B6A63]"><TS>El costo y los días del envío los ves con tu dirección, antes de pagar.</TS></p>
        </div>
      )}
      {garantia && (
        <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
          <h2 className="m-0 mb-2 text-[15px] font-bold text-[#142033]"><TS>🛡️ Garantía</TS></h2>
          <p className="m-0 text-[14px] text-[#2E2D29]"><TS>{garantia}</TS></p>
        </div>
      )}
    </section>
  )
}
