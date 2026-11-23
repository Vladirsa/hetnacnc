import type { Metadata } from "next"

import { PAISES_LATAM, rutaPais } from "@/components/hetna/latam/paises"
import { QuitarPerfil } from "@/components/hetna/taller/SolicitudDirectorio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { NOMBRE_TIPO, directorioPorPais, mismoPais } from "@/lib/hetna/directorio"

// Todas las empresas CNC que ha encontrado el buscador de HETNA, de todos los
// países, para que se vea el tamaño de la red. Se lee en vivo de la hoja de
// prospectos (caché de 1 h): lo que el buscador agrega cada noche aparece solo.
// Sólo datos públicos de empresa; cada una marcada como perfil no reclamado.
export const revalidate = 3600

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/talleres/mundo" },
  title: "Talleres CNC por país: la red de HETNA en el mundo",
  description:
    "Talleres de maquinado, corte láser, router y plasma, proveedores e instructores CNC de México, Latinoamérica, Estados Unidos, Europa y Asia que encontramos para la red de HETNA.",
}

const BANDERAS: Record<string, string> = {
  "méxico": "🇲🇽", brasil: "🇧🇷", china: "🇨🇳", "taiwán": "🇹🇼", "turquía": "🇹🇷", italia: "🇮🇹", alemania: "🇩🇪", india: "🇮🇳",
  "corea del sur": "🇰🇷", corea: "🇰🇷", "japón": "🇯🇵", portugal: "🇵🇹", francia: "🇫🇷", "canadá": "🇨🇦", venezuela: "🇻🇪",
  honduras: "🇭🇳", nicaragua: "🇳🇮", "panamá": "🇵🇦", cuba: "🇨🇺", "puerto rico": "🇵🇷",
}
const idPais = (p: string) => p.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]+/g, "-")

export default async function TalleresMundoPage() {
  const grupos = await directorioPorPais()
  const total = grupos.reduce((n, g) => n + g.empresas.length, 0)
  const talleres = grupos.reduce((n, g) => n + g.empresas.filter((e) => e.tipo === "taller").length, 0)
  const info = (pais: string) => {
    const p = PAISES_LATAM.find((x) => mismoPais(x.nombre, pais) || (x.en_hoja || []).some((h) => mismoPais(h, pais)))
    if (mismoPais(pais, "México")) return { bandera: "🇲🇽", ruta: "/mx/talleres/directorio" }
    return { bandera: p?.bandera || BANDERAS[pais.toLowerCase()] || "🌎", ruta: p ? rutaPais(p.clave) : "" }
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-8">
      <nav className="mb-4 text-sm text-[#6B675C]">
        <LocalizedClientLink href="/talleres" className="hover:text-[#C2560A]">Talleres</LocalizedClientLink> › En el mundo
      </nav>
      <h1 className="text-3xl font-extrabold text-[#142033] sm:text-4xl">Talleres CNC por país</h1>
      <p className="mt-2 max-w-3xl text-[#40403A]">
        Ya ubicamos <b>{total.toLocaleString("es-MX")}</b> empresas CNC en <b>{grupos.length}</b> países ({talleres.toLocaleString("es-MX")} talleres
        de maquinado y corte, más proveedores e instructores). Nuestro buscador encuentra más cada noche y aparecen aquí solas. Son perfiles no
        reclamados: los datos son públicos y vienen del sitio web de cada empresa.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {grupos.map((g) => (
          <a key={g.pais} href={`#${idPais(g.pais)}`} className="rounded-full border border-[#E7E4DC] bg-white px-3 py-1.5 text-sm text-[#142033] hover:border-[#C2560A]">
            {info(g.pais).bandera} {g.pais} · <b>{g.empresas.length}</b>
          </a>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-[#E7E4DC] bg-white p-4 text-sm text-[#40403A]">
        <b className="text-[#142033]">¿Tu empresa aparece aquí?</b> Reclama tu perfil gratis:{" "}
        <LocalizedClientLink href="/talleres/unete" className="font-semibold text-[#C2560A] underline">en México</LocalizedClientLink> o{" "}
        <LocalizedClientLink href="/latinoamerica" className="font-semibold text-[#C2560A] underline">en tu país, como taller fundador</LocalizedClientLink>.
        Si no quieres aparecer, usa «Quitar este perfil».
      </div>

      {grupos.map((g) => {
        const { bandera, ruta } = info(g.pais)
        return (
          <section key={g.pais} id={idPais(g.pais)} className="mt-10 scroll-mt-20">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E7E4DC] pb-2">
              <h2 className="text-2xl font-extrabold text-[#142033]">
                {bandera} {g.pais} <span className="text-base font-semibold text-[#6B675C]">· {g.empresas.length} {g.empresas.length === 1 ? "empresa" : "empresas"}</span>
              </h2>
              {ruta && (
                <a href={ruta} className="text-sm font-semibold text-[#C2560A] underline">
                  {mismoPais(g.pais, "México") ? "Ver por estado →" : `HETNA en ${g.pais} →`}
                </a>
              )}
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.empresas.map((e) => (
                <li key={e.slug} className="rounded-xl border border-[#E7E4DC] bg-white p-3">
                  {mismoPais(g.pais, "México") ? (
                    <LocalizedClientLink href={`/talleres/directorio/${e.slug}`} className="font-bold text-[#142033] hover:text-[#C2560A]">
                      {e.empresa}
                    </LocalizedClientLink>
                  ) : (
                    <p className="font-bold text-[#142033]">{e.empresa}</p>
                  )}
                  <p className="mt-0.5 text-xs text-[#6B675C]">
                    {NOMBRE_TIPO[e.tipo]}
                    {e.ciudad ? ` · ${e.ciudad}` : e.estado ? ` · ${e.estado}` : ""}
                  </p>
                  {!mismoPais(g.pais, "México") && (
                    <div className="mt-1 text-[11px]">
                      <QuitarPerfil slug={e.slug} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </main>
  )
}
