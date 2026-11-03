// Lista de precios y comisiones de HETNA. Viene del backend
// (GET /store/hetna-tarifas, packages/api/src/lib/tarifas.ts), la misma que
// ve el taller en la portada de su panel, así nunca dicen cosas distintas.
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

type Fila = { concepto: string; precio: string; nota?: string }
type Grupo = { id: string; titulo: string; texto?: string; filas: Fila[] }

async function cargar(): Promise<Grupo[]> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-tarifas`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      next: { revalidate: 600 },
    })
    if (!res.ok) return []
    const r = (await res.json()) as { grupos?: Grupo[] }
    return r.grupos || []
  } catch {
    return []
  }
}

export async function TablaTarifas() {
  const grupos = await cargar()
  if (!grupos.length) {
    return <p>La lista de precios vigente se muestra en tu panel de vendedor, en Mi tablero.</p>
  }
  return (
    <div className="not-prose my-4 flex flex-col gap-5">
      {grupos.map((g) => (
        <section key={g.id} id={`tarifas-${g.id}`} className="overflow-hidden rounded-xl border border-[#E7E4DC]">
          <div className="bg-[#F3F1EA] px-4 py-3">
            <h3 className="m-0 text-[15px] font-bold text-[#142033]">{g.titulo}</h3>
            {g.texto && <p className="m-0 mt-0.5 text-[13px] text-[#5B5A54]">{g.texto}</p>}
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {g.filas.map((f) => (
                <tr key={f.concepto} className="border-t border-[#E7E4DC] align-top">
                  <td className="px-4 py-2.5 font-medium text-[#142033]">
                    {f.concepto}
                    {f.nota && <span className="mt-0.5 block text-[12.5px] font-normal text-[#6B6A63]">{f.nota}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-[#1B1B18]">{f.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="m-0 text-[12.5px] text-[#6B6A63]">Precios en pesos mexicanos, con IVA incluido salvo que se indique otra cosa.</p>
    </div>
  )
}
