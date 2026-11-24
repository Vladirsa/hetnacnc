import type { Metadata } from "next"
import { notFound } from "next/navigation"

import DescargaPlano from "@/components/hetna/planos/DescargaPlano"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { acomodoPorMaterial, dxfPlano, hojasNecesarias, listaCorte, medidasGenerales } from "@/lib/planos/calculo"
import { cajasRuedas, piezasPorPaso, svgArmado, svgExplotado, svgHoja, svgPaso } from "@/lib/planos/dibujo"
import { MATERIALES_PLANO, PLANOS, planoPorSlug, type PiezaPlano } from "@/lib/planos/modelos"

export function generateStaticParams() {
  return PLANOS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const pl = planoPorSlug(slug)
  if (!pl) return {}
  return {
    alternates: { canonical: `https://hetnacnc.com/mx/planos/${pl.slug}` },
    title: `Plano gratis: ${pl.nombre} (lista de corte y DXF)`,
    description: `${pl.resumen} Plano con lista de corte, acomodo en la hoja, pasos de armado y DXF para router CNC.`,
  }
}

const Titulo = ({ n, children }: { n: string; children: React.ReactNode }) => (
  <h2 className="m-0 flex items-center gap-2 text-[15px] font-extrabold uppercase tracking-wide text-[#FF9F57]">
    <span className="rounded bg-[#FF6A1A] px-1.5 text-[12px] text-white">{n}</span>
    {children}
  </h2>
)

export default async function PlanoPagina({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pl = planoPorSlug(slug)
  if (!pl) notFound()

  const m = medidasGenerales(pl)
  const { filas } = listaCorte(pl)
  const acs = acomodoPorMaterial(filas)
  const hojas = hojasNecesarias(acs)
  const pasos = piezasPorPaso(pl.piezas, pl.pasos)
  const ruedas = cajasRuedas(pl.piezas, pl.ruedas)
  const previas: Set<PiezaPlano>[] = []
  pasos.reduce((acum, s) => { previas.push(new Set(acum)); s.forEach((q) => acum.add(q)); return acum }, new Set<PiezaPlano>())
  const dxfs = dxfPlano(acs)
  const caja = "rounded-2xl border border-white/10 bg-[#1B2A42] p-4"

  return (
    <main className="w-full bg-[#FAF9F6]">
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm } body * { visibility: hidden } #lamina, #lamina * { visibility: visible } #lamina { position: absolute; inset: 0; } }`}</style>
      <div className="mx-auto w-full max-w-[1180px] px-4 py-6 lg:px-6">
        <div className="mb-4 flex flex-wrap gap-1.5 text-[13px] text-[#6B6A63] print:hidden">
          <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
          <span>/</span>
          <LocalizedClientLink href="/planos" className="hover:text-[#B34D07]">Planos</LocalizedClientLink>
          <span>/</span>
          <span className="font-medium text-[#1B1B18]">{pl.nombre}</span>
        </div>

        <article id="lamina" className="overflow-hidden rounded-3xl bg-[#142033] p-5 text-white sm:p-8" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-4">
            <div>
              <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-[#FF9F57]">Plano HETNA CNC · hetnacnc.com/planos</p>
              <h1 className="font-display m-0 mt-1 text-[28px] font-bold leading-tight sm:text-[36px]">{pl.nombre}</h1>
              <p className="m-0 mt-1 max-w-[680px] text-[14px] text-white/80">{pl.descripcion}</p>
            </div>
            <p className="m-0 text-[13px] text-white/75">
              {m.ancho} × {m.fondo} × {m.alto} mm · {pl.nivel} · {pl.horas}
              {pl.juego ? ` · se cortan ${pl.juego.cantidad} ${pl.juego.nombre}` : ""}
            </p>
          </header>

          <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={`${caja} bg-[#F6F1E7]`}>
              <Titulo n="1">Mueble armado</Titulo>
              <div className="mt-2 rounded-xl bg-[#FAF9F6] p-2" dangerouslySetInnerHTML={{ __html: svgArmado(pl.piezas, `${pl.nombre} armado`, ruedas) }} />
            </div>
            <div className={caja}>
              <Titulo n="2">Vista explotada</Titulo>
              <div className="mt-2 rounded-xl bg-[#FAF9F6] p-2" dangerouslySetInnerHTML={{ __html: svgExplotado(pl.piezas, `${pl.nombre} explotado`) }} />
            </div>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className={caja}>
              <Titulo n="3">Lista de corte</Titulo>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-[12.5px]">
                  <thead className="text-[#FF9F57]">
                    <tr><th className="py-1 pr-2">Pieza</th><th className="pr-2">Descripción</th><th className="pr-2">Cant.</th><th className="pr-2">Largo</th><th className="pr-2">Ancho</th><th className="pr-2">Esp.</th></tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.letra} className="border-t border-white/10">
                        <td className="py-1 pr-2 font-extrabold">{f.letra}</td>
                        <td className="pr-2 text-white/85">{f.nombre}</td>
                        <td className="pr-2">{f.cantidad}</td>
                        <td className="pr-2">{f.largo}</td>
                        <td className="pr-2">{f.ancho}</td>
                        <td className="pr-2">{f.grosor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="m-0 mt-2 text-[11.5px] text-white/60">Medidas en mm. Material: {[...new Set(filas.map((f) => MATERIALES_PLANO[f.material].nombre))].join(", ")}.</p>
            </div>
            <div className={caja}>
              <Titulo n="4">Acomodo en la hoja</Titulo>
              <p className="m-0 mt-1 text-[12.5px] text-white/75">{hojas.map((h) => `${h.hojas} ${h.hojas === 1 ? "hoja" : "hojas"} de ${h.nombre}`).join(" · ")} (2440 × 1220 mm)</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {acs.flatMap((a) => a.acomodo.hojas.map((h, i) => (
                  <figure key={`${a.material}-${i}`} className="m-0 rounded-xl bg-[#FAF9F6] p-1.5">
                    <div dangerouslySetInnerHTML={{ __html: svgHoja(h, `${a.nombre} hoja ${i + 1}`) }} />
                    <figcaption className="text-center text-[11px] text-[#6B6A63]">{a.nombre} · hoja {i + 1}</figcaption>
                  </figure>
                )))}
              </div>
            </div>
          </section>

          <section className={`${caja} mt-4`}>
            <Titulo n="5">Pasos de armado</Titulo>
            <ol className="m-0 mt-3 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 lg:grid-cols-5">
              {pl.pasos.map((ps, i) => (
                <li key={ps.titulo} className="rounded-xl bg-[#FAF9F6] p-2 text-[#142033]">
                  <div dangerouslySetInnerHTML={{ __html: svgPaso(pl.piezas, previas[i], pasos[i], `Paso ${i + 1}: ${ps.titulo}`) }} />
                  <p className="m-0 mt-1 text-[13px] font-bold">{i + 1}. {ps.titulo}</p>
                  <p className="m-0 text-[12px] text-[#40403A]">{ps.nota}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className={caja}>
              <Titulo n="6">Herrajes</Titulo>
              <ul className="m-0 mt-2 list-disc pl-5 text-[13px] text-white/85">{pl.herrajes.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
            <div className={caja}>
              <Titulo n="7">Herramientas</Titulo>
              <ul className="m-0 mt-2 list-disc pl-5 text-[13px] text-white/85">{pl.herramientas.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
            <div className={caja}>
              <Titulo n="8">Notas</Titulo>
              <ul className="m-0 mt-2 list-disc pl-5 text-[13px] text-white/85">
                {pl.notas.map((h) => <li key={h}>{h}</li>)}
                <li>Revisa el grosor real de tu triplay antes de cortar.</li>
              </ul>
            </div>
          </section>
        </article>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 print:hidden">
          <DescargaPlano slug={pl.slug} nombre={pl.nombre} dxfs={dxfs} />
          <div className="flex flex-col gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-5">
            <p className="m-0 text-[16px] font-bold text-[#142033]">¿No tienes router o prefieres que te lo corten?</p>
            <p className="m-0 text-[14px] text-[#40403A]">Un taller de HETNA te corta las piezas o te entrega el mueble armado. Pide propuestas con el plano: es gratis.</p>
            <LocalizedClientLink href="/cotizar" className="inline-flex w-fit items-center rounded-[12px] bg-[#142033] px-5 py-3 text-[15px] font-bold text-white">
              Pedir que me lo fabriquen
            </LocalizedClientLink>
            <LocalizedClientLink href="/planos" className="text-[14px] font-semibold text-[#B34D07]">Ver más planos →</LocalizedClientLink>
          </div>
        </section>
      </div>
    </main>
  )
}
