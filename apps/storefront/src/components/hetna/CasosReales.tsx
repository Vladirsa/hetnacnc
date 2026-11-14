// "Trabajos reales" (auditoría de mejoras del 14 nov 2026, tarea 5): piezas
// terminadas que HETNA carga desde el admin, con permiso del cliente. Si no
// hay ninguna publicada, la sección no se dibuja: nunca casos de ejemplo
// presentados como reales.
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

type Caso = {
  id: string
  titulo: string
  foto_url: string
  ciudad?: string | null
  material?: string | null
  tipo_trabajo?: string | null
  tiempo_entrega?: string | null
}

async function casos(): Promise<Caso[]> {
  try {
    const r = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-casos`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      next: { revalidate: 300 },
    })
    if (!r.ok) return []
    return ((await r.json()) as { casos?: Caso[] }).casos ?? []
  } catch {
    return []
  }
}

export default async function CasosReales({ titulo = "Trabajos reales", compacto = false }: { titulo?: string; compacto?: boolean }) {
  const lista = await casos()
  if (!lista.length) return null
  return (
    <section className={compacto ? "my-8" : "px-4 py-10 lg:px-16"} data-testid="casos-reales">
      <h2 className="font-display m-0 text-[22px] font-bold text-[#142033]">{titulo}</h2>
      <p className="m-0 mt-1 text-[14px] text-[#6B675C]">Piezas fabricadas con talleres de HETNA, publicadas con permiso del cliente.</p>
      <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 lg:grid-cols-4">
        {lista.slice(0, compacto ? 4 : 8).map((c) => (
          <li key={c.id} className="overflow-hidden rounded-[14px] border border-[#E7E4DC] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.foto_url} alt={c.titulo} width={400} height={300} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
            <div className="p-3">
              <p className="m-0 text-[14px] font-bold text-[#142033]">{c.titulo}</p>
              <p className="m-0 mt-1 text-[12.5px] leading-snug text-[#6B675C]">
                {[c.tipo_trabajo, c.material, c.ciudad].filter(Boolean).join(" · ")}
                {c.tiempo_entrega ? <><br />Entregado en {c.tiempo_entrega}</> : null}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
