// "Cuánto te queda de cada venta": la comparación que prometen los correos de
// prospección (scripts/prospectos). La comisión de HETNA se lee de la lista de
// precios del backend (GET /store/hetna-tarifas, packages/api/src/lib/tarifas.ts)
// para que nunca diga algo distinto a los Términos para vendedores. Si no se
// puede leer, la sección no se muestra (no se inventa la cifra).
import { TS } from "@/i18n/TS"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const VENTA = 10000

type Fila = { concepto: string; precio: string; nota?: string }
type Grupo = { id: string; filas: Fila[] }

const pct = (s?: string) => {
  const m = String(s || "").match(/([\d.]+)\s*%/)
  return m ? Number(m[1]) : null
}

async function comisiones(): Promise<{ general: number; maquinas: number | null } | null> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-tarifas`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      next: { revalidate: 600 },
    })
    if (!res.ok) return null
    const { grupos = [] } = (await res.json()) as { grupos?: Grupo[] }
    const ventas = grupos.find((g) => g.id === "ventas")
    const general = pct(ventas?.filas.find((f) => /todo lo dem/i.test(f.concepto))?.precio)
    const maquinas = pct(ventas?.filas.find((f) => /m[aá]quinas/i.test(f.concepto))?.precio)
    return general === null ? null : { general, maquinas }
  } catch {
    return null
  }
}

const pesos = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)

export async function ComparativaComisiones() {
  const c = await comisiones()
  if (!c) return null
  const filas: { quien: string; regla: string; cobro: string; hetna?: boolean }[] = [
    { quien: "Mercado Libre", regla: "Publicación Premium: 12.5% a 20.5% según la categoría", cobro: `${pesos(VENTA * 0.125)} – ${pesos(VENTA * 0.205)}` },
    { quien: "Amazon", regla: "8% a 20% por venta + $600 al mes del plan profesional", cobro: `${pesos(VENTA * 0.08 + 600)} – ${pesos(VENTA * 0.2 + 600)}` },
    {
      quien: "HETNA CNC",
      regla: `${c.general}% por venta${c.maquinas !== null ? ` (${c.maquinas}% en máquinas CNC)` : ""}. Publicar es gratis.`,
      cobro: pesos((VENTA * c.general) / 100),
      hetna: true,
    },
  ]
  return (
    <section className="mt-12" id="comisiones">
      <h2 className="text-2xl font-extrabold text-[#142033] sm:text-3xl"><TS>Cuánto te queda de cada venta</TS></h2>
      <p className="mt-1 text-[#6B675C]"><TS>Ejemplo con una venta de</TS> {pesos(VENTA)} <TS>MXN.</TS></p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E4DC] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F3F1EA] text-[#142033]">
            <tr>
              <th className="px-4 py-3 font-bold"><TS>Dónde vendes</TS></th>
              <th className="hidden px-4 py-3 font-bold sm:table-cell"><TS>Cómo cobra</TS></th>
              <th className="px-4 py-3 text-right font-bold"><TS>Te cobra aprox.</TS></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.quien} className={`border-t border-[#E7E4DC] align-top ${f.hetna ? "bg-[#FFF4EA]" : ""}`}>
                <td className="px-4 py-3 font-semibold text-[#142033]">
                  <TS>{f.quien}</TS>
                  <span className="mt-0.5 block text-[12.5px] font-normal text-[#6B675C] sm:hidden"><TS>{f.regla}</TS></span>
                </td>
                <td className="hidden px-4 py-3 text-[#4A4740] sm:table-cell"><TS>{f.regla}</TS></td>
                <td className={`whitespace-nowrap px-4 py-3 text-right font-bold ${f.hetna ? "text-[#C2560A]" : "text-[#1B1B18]"}`}><TS>{f.cobro}</TS></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 space-y-1 text-[13px] text-[#6B675C]">
        <li>
          <TS>• Vendes con el nombre de tu taller y</TS> <b><TS>emites tu factura (CFDI) directamente a tu cliente</TS></b>.
        </li>
        <li>
          <TS>• Las solicitudes de fabricación (licitaciones) que ganes no pagan comisión.</TS><TS>{" "}</TS>
          <LocalizedClientLink href="/terminos-vendedores" className="font-semibold text-[#C2560A] underline">
            <TS>Ver todas las tarifas</TS>
          </LocalizedClientLink>
        </li>
        <li><TS>• Comisiones de Mercado Libre y Amazon: referencias publicadas por cada plataforma; varían por categoría y pueden cambiar.</TS></li>
      </ul>
    </section>
  )
}
