// "Ejemplo de cotización" en la página Cotizar (auditoría de mejoras, tarea 6).
// Lo carga HETNA desde el admin (Trabajos reales › Ejemplo de cotización) con
// datos reales anonimizados. Si no hay ninguno cargado, no se muestra nada.
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

type Ejemplo = { pieza: string; material?: string; cantidad?: string; precio: string; tiempo: string; propuestas?: string }

async function leer(): Promise<Ejemplo | null> {
  try {
    const r = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-ajustes/ejemplo-cotizacion`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      next: { revalidate: 300 },
    })
    if (!r.ok) return null
    return ((await r.json()) as { valor?: Ejemplo | null }).valor ?? null
  } catch {
    return null
  }
}

export default async function EjemploCotizacion() {
  const e = await leer()
  if (!e) return null
  const filas: [string, string | undefined][] = [
    ["Pieza", e.pieza],
    ["Material", e.material],
    ["Cantidad", e.cantidad],
    ["Propuestas recibidas", e.propuestas],
    ["Rango de precio", e.precio],
    ["Tiempo de entrega", e.tiempo],
  ]
  return (
    <section className="rounded-2xl border border-[#E7E4DC] bg-white p-5" data-testid="ejemplo-cotizacion">
      <p className="m-0 text-xs font-bold uppercase tracking-[.2em] text-[#C2560A]">Ejemplo real</p>
      <p className="m-0 mt-1 font-bold text-[#142033]">Así se ve una cotización respondida</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {filas
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[#6B675C]">{k}</dt>
              <dd className="m-0 font-semibold text-[#142033]">{v}</dd>
            </div>
          ))}
      </dl>
      <p className="m-0 mt-3 text-xs text-[#8A887F]">Datos de un trabajo real, sin datos del cliente.</p>
    </section>
  )
}
