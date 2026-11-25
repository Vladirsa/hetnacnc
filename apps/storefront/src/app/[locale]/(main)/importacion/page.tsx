import type { Metadata } from "next"

import { PAISES_LATAM } from "@/components/hetna/latam/paises"
import { QuitarPerfil } from "@/components/hetna/taller/SolicitudDirectorio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { proveedoresImportacion } from "@/lib/hetna/directorio"

// Proveedores de importación (24 nov 2026): fabricantes de China, Taiwán y otros
// países que encontró el buscador y que todavía no venden en HETNA. Sale la lista
// por país (perfiles no reclamados, datos públicos de su sitio) y se les invita a
// vender en México con envío DDP y pago por PayPal (/sell-in-mexico). Se lee en
// vivo de la hoja de prospectos: lo que el buscador encuentra cada noche aparece solo.
export const revalidate = 3600

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/importacion" },
  title: "Proveedores CNC de importación: China, Taiwán y más",
  description:
    "Fabricantes de máquinas CNC, láser, plasma, herramientas y refacciones de China, Taiwán y otros países que pronto venderán en México con envío puerta a puerta e impuestos incluidos.",
}

const BANDERAS: Record<string, string> = {
  China: "🇨🇳", "Taiwán": "🇹🇼", "Turquía": "🇹🇷", Italia: "🇮🇹", Alemania: "🇩🇪", India: "🇮🇳", Corea: "🇰🇷", "Corea del Sur": "🇰🇷",
  "Japón": "🇯🇵", Brasil: "🇧🇷", Venezuela: "🇻🇪", Portugal: "🇵🇹", Francia: "🇫🇷", "Canadá": "🇨🇦",
}
const idPais = (p: string) => p.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]+/g, "-")

export default async function ImportacionPage() {
  const conPagina = PAISES_LATAM.flatMap((p) => [p.nombre, ...(p.en_hoja || [])])
  const grupos = await proveedoresImportacion(conPagina)
  const total = grupos.reduce((n, g) => n + g.empresas.length, 0)

  return (
    <main className="w-full bg-[#FAF9F6]">
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[1100px] px-4 py-12 lg:px-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">🌏 Importación</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">Proveedores CNC de importación</h1>
          <p className="mt-4 max-w-2xl text-white/75">
            Fabricantes de máquinas, láser, plasma, herramientas y refacciones de otros países. Cuando venden en HETNA, sus productos llegan
            puerta a puerta con los impuestos de importación ya incluidos, y pagas protegido dentro de la plataforma.
          </p>
          {total > 0 && (
            <p className="mt-3 text-sm text-[#F2C9A5]">
              Ya ubicamos {total} {total === 1 ? "proveedor" : "proveedores"} en {grupos.length} {grupos.length === 1 ? "país" : "países"}.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {grupos.map((g) => (
              <a key={g.pais} href={`#${idPais(g.pais)}`} className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white no-underline hover:bg-white/20">
                {BANDERAS[g.pais] || "🌎"} {g.pais} · {g.empresas.length}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 py-10 lg:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-4 text-sm text-[#40403A]">
            <p className="font-bold text-[#142033]">¿Buscas una máquina o refacción?</p>
            <p className="mt-1">Estos proveedores todavía no venden en HETNA. Mientras tanto, pide tu cotización y te conseguimos opciones con talleres y proveedores de la red.</p>
            <LocalizedClientLink href="/cotizar" className="mt-2 inline-block font-semibold text-[#C2560A] underline">Pedir cotización →</LocalizedClientLink>
          </div>
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-4 text-sm text-[#40403A]">
            <p className="font-bold text-[#142033]">Is this your company? · ¿Es tu empresa?</p>
            <p className="mt-1">Sell to Mexican machine shops: ship DDP door to door and get paid via PayPal. Free to list, 6% per sale.</p>
            <LocalizedClientLink href="/sell-in-mexico" className="mt-2 inline-block font-semibold text-[#C2560A] underline">Sell in Mexico →</LocalizedClientLink>
          </div>
        </div>

        {!grupos.length && <p className="mt-8 text-[#6B675C]">Todavía no hay proveedores de importación en la lista. El buscador agrega más cada noche.</p>}

        {grupos.map((g) => (
          <div key={g.pais} id={idPais(g.pais)} className="mt-10 scroll-mt-20">
            <h2 className="border-b border-[#E7E4DC] pb-2 text-2xl font-extrabold text-[#142033]">
              {BANDERAS[g.pais] || "🌎"} {g.pais} <span className="text-base font-semibold text-[#6B675C]">· {g.empresas.length}</span>
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.empresas.map((e) => (
                <li key={e.slug} className="rounded-xl border border-[#E7E4DC] bg-white p-3">
                  <p className="font-bold text-[#142033]">{e.empresa}</p>
                  <p className="mt-0.5 text-xs text-[#6B675C]">
                    {e.ciudad ? `${e.ciudad} · ` : ""}
                    <span className="rounded-full bg-[#F1F0EC] px-2 py-0.5">Perfil no reclamado</span>
                  </p>
                  {e.servicios && <p className="mt-2 line-clamp-3 text-sm text-[#40403A]">{e.servicios}</p>}
                  <div className="mt-1 text-[11px]">
                    <QuitarPerfil slug={e.slug} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  )
}
