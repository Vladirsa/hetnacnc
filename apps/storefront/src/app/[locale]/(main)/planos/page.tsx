import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { acomodoPorMaterial, hojasNecesarias, listaCorte, medidasGenerales } from "@/lib/planos/calculo"
import { cajasRuedas, svgArmado } from "@/lib/planos/dibujo"
import { todosLosPlanos } from "@/lib/planos/fuente"
import { CATEGORIAS_PLANO } from "@/lib/planos/modelos"

// Biblioteca de planos HETNA: muebles de taller diseñados por HETNA, con
// lista de corte, acomodo en la hoja, pasos de armado y DXF para router CNC.
const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/planos" },
  title: "Planos de muebles gratis para taller y casa: lista de corte y DXF",
  description:
    "Planos gratis de muebles para taller y casa: banco de trabajo, cajonera, librero, buró, escritorio y más. Con lista de corte, acomodo en la hoja, pasos de armado y DXF para router CNC.",
}

export default async function Planos() {
  const PLANOS = await todosLosPlanos()
  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 lg:px-6">
        <header className="rounded-3xl bg-[#142033] p-7 text-white sm:p-10">
          <p className="m-0 text-[13px] font-bold uppercase tracking-wider text-[#FF9F57]"><TS>Biblioteca de planos HETNA</TS></p>
          <h1 className="font-display mt-2 text-[30px] font-bold leading-tight sm:text-[40px]"><TS>Planos de muebles para tu taller y tu casa</TS></h1>
          <p className="mt-3 max-w-[720px] text-[16px] text-white/85">
            <TS>Diseños de HETNA con vista en 3D, vista explotada, lista de corte, acomodo en hojas de triplay y pasos de armado.
            Bájalos gratis en PDF y en DXF para cortarlos en router CNC, o pide que un taller te los fabrique.</TS>
          </p>
        </header>

        {CATEGORIAS_PLANO.map((cat) => (
          <section key={cat} className="mt-8">
            <h2 className="font-display m-0 text-[22px] font-bold text-[#142033]">{cat === "Taller" ? "Para tu taller" : "Para tu casa"}</h2>
          <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLANOS.filter((pl) => pl.categoria === cat).map((pl) => {
            const m = medidasGenerales(pl)
            const { filas } = listaCorte(pl)
            const hojas = hojasNecesarias(acomodoPorMaterial(filas)).reduce((s, h) => s + h.hojas, 0)
            const piezas = filas.reduce((s, f) => s + f.cantidad, 0)
            return (
              <LocalizedClientLink key={pl.slug} href={`/planos/${pl.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-[#E7E4DC] bg-white hover:border-[#FF6A1A]">
                <div className="flex h-[250px] items-center justify-center bg-[#F6F1E7] p-4 [&_svg]:max-h-full [&_svg]:w-auto" dangerouslySetInnerHTML={{ __html: svgArmado(pl.piezas, pl.nombre, cajasRuedas(pl.piezas, pl.ruedas)) }} />
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <h3 className="m-0 text-[18px] font-bold text-[#142033] group-hover:text-[#B34D07]">{pl.nombre}</h3>
                  <p className="m-0 text-[14px] text-[#40403A]"><TS>{pl.resumen}</TS></p>
                  <p className="m-0 mt-auto pt-2 text-[12.5px] text-[#6B6A63]">
                    {m.ancho} × {m.fondo} × {m.alto} <TS>mm ·</TS> {piezas} <TS>piezas ·</TS> {hojas} {hojas === 1 ? "hoja" : "hojas"} · {pl.nivel} · {pl.horas}
                  </p>
                </div>
              </LocalizedClientLink>
            )
          })}
          </div>
          </section>
        ))}

        <p className="mt-8 text-[13px] text-[#6B6A63]">
          <TS>Medidas en milímetros. Revisa el grosor real de tu triplay antes de cortar: de ese dato dependen las uniones.</TS>
        </p>
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
