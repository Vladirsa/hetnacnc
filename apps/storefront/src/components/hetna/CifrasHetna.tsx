// Prueba social con cifras REALES (talleres, estados y servicios), sacadas de
// los talleres publicados. Sólo se dibuja cuando ya hay suficientes talleres
// para que la cifra ayude (CIFRAS_MINIMO_TALLERES, 10 por omisión): un "3
// talleres" en la portada espanta más de lo que convence.
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarTalleres } from "@/lib/hetna/talleres"

export async function CifrasHetna() {
  const talleres = await listarTalleres().catch(() => [])
  const minimo = Number(process.env.CIFRAS_MINIMO_TALLERES) || 10
  if (talleres.length < minimo) return null

  const estados = new Set(talleres.map((t) => t.perfil?.estado?.trim()).filter(Boolean)).size
  const servicios = new Set(talleres.flatMap((t) => t.perfil?.servicios || [])).size
  const verificados = talleres.filter((t) => t.verificado).length

  const cifras = [
    { n: talleres.length, t: "talleres CNC en la red" },
    ...(estados > 1 ? [{ n: estados, t: estados === 1 ? "estado" : "estados de México" }] : []),
    ...(servicios > 1 ? [{ n: servicios, t: "tipos de servicio" }] : []),
    ...(verificados > 0 ? [{ n: verificados, t: verificados === 1 ? "taller verificado" : "talleres verificados" }] : []),
  ]

  return (
    <section className="mx-4 lg:mx-16 mb-12 bg-white border border-[#E7E4DC] rounded-[20px] px-6 py-7 lg:px-10 flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
      <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 gap-5 flex-1">
        {cifras.map((c) => (
          <div key={c.t}>
            <dd className="m-0 font-display text-[30px] lg:text-[36px] font-bold text-[#C2560A] leading-none">{c.n}</dd>
            <dt className="mt-1 text-[13.5px] text-[#4A4943]">{c.t}</dt>
          </div>
        ))}
      </dl>
      <LocalizedClientLink
        href="/talleres"
        className="shrink-0 self-start lg:self-auto bg-[#142033] hover:bg-black text-white font-semibold px-5 py-3 rounded-[10px] text-[14.5px]"
      >
        Ver talleres
      </LocalizedClientLink>
    </section>
  )
}
