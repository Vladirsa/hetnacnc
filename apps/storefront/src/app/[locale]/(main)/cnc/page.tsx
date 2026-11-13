// /mx/cnc — índice de las guías CNC (lib/seo/guias.ts). Une las guías entre sí
// y con los cotizadores, herramientas y categorías.
import type { Metadata } from "next"

import { JsonLd } from "@/components/hetna/JsonLd"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { migas } from "@/lib/hetna/schema"
import { CIUDADES, GUIAS } from "@/lib/seo/guias"

const SITIO = "https://hetnacnc.com"

export const metadata: Metadata = {
  title: "Guías CNC: router, láser, maquinado, CAM y DXF",
  description: "Guías prácticas para fabricar con CNC en México: router, corte láser de MDF, maquinado de aluminio, CAM de 5 ejes y archivos DXF. Con talleres y cotizador.",
  alternates: { canonical: `${SITIO}/mx/cnc` },
}

export default function GuiasCnc() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-6 lg:px-6">
      <JsonLd
        datos={[
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Guías CNC de HETNA",
            itemListElement: GUIAS.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.h1, url: `${SITIO}/mx/cnc/${g.slug}` })),
          },
          migas([{ nombre: "Inicio", ruta: `${SITIO}/mx` }, { nombre: "Guías CNC" }]),
        ]}
      />
      <h1 className="text-3xl font-extrabold text-[#142033] sm:text-4xl">Guías CNC</h1>
      <p className="mt-2 max-w-2xl text-[#40403A]">
        Lo que necesitas saber para fabricar con CNC en México: qué pedir, qué archivo mandar y con quién. Cada guía te lleva al
        cotizador y a los talleres de la red.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {GUIAS.map((g) => (
          <LocalizedClientLink key={g.slug} href={`/cnc/${g.slug}`} className="rounded-2xl border border-[#E7E4DC] bg-white p-5 transition hover:shadow-md">
            <h2 className="text-lg font-extrabold text-[#142033]">{g.h1}</h2>
            <p className="mt-1 text-sm text-[#6B675C]">{g.descripcion}</p>
          </LocalizedClientLink>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="text-xl font-extrabold text-[#142033]">Corte láser de MDF por ciudad</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {CIUDADES.map((c) => (
            <li key={c.slug}>
              <LocalizedClientLink href={`/cnc/corte-laser-mdf/${c.slug}`} className="inline-block rounded-full border border-[#E7E4DC] px-3 py-1 text-sm text-[#142033] hover:border-[#C2560A]">
                {c.nombre}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
