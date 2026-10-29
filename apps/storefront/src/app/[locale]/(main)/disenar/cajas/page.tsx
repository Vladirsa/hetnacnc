import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { BloquePublicidad } from "@/components/hetna/disenar/BloquePublicidad"
import { DESTACADOS, TEXTO_GRUPOS, listarCajas } from "@/lib/hetna/cajas"

// Catálogo de cajas de madera y acrílico (motor Boxes.py, ver infra/cajas).
// Cada tarjeta abre /disenar/cajas/<Id> dentro del espacio Diseñar y escanear.
const SITIO = "https://hetnacnc.com"

export const metadata: Metadata = {
  title: "Generador de cajas para láser y router CNC gratis: bisagras, cajones, divisores y más de 170 diseños",
  description:
    "Más de 170 cajas y objetos paramétricos gratis para corte láser y router CNC: cajas con juntas de dedo, con bisagra, con tapa corrediza, cajoneras, organizadores, estantes, soportes de pared, engranajes y lámparas. Pones las medidas y descargas DXF, SVG, PDF o LightBurn.",
  alternates: {
    canonical: `${SITIO}/mx/disenar/cajas`,
    languages: { "es-MX": `${SITIO}/mx/disenar/cajas`, "en-US": `${SITIO}/us/disenar/cajas` },
  },
}

export const revalidate = 3600

export default async function CatalogoCajas() {
  const { grupos, generadores } = await listarCajas()
  const porGrupo = new Map(grupos.map((g) => [g.id, generadores.filter((x) => x.grupo === g.id)]))
  const destacados = DESTACADOS.map((id) => generadores.find((g) => g.id === id)).filter(Boolean) as typeof generadores

  const Tarjeta = ({ g, color }: { g: (typeof generadores)[number]; color: string }) => (
    <LocalizedClientLink
      href={`/disenar/cajas/${g.id}`}
      className="group flex flex-col overflow-hidden rounded-[16px] border-2 border-[#E7E4DC] bg-white hover:border-[#FF6A1A] hover:shadow-[0_8px_24px_rgba(255,106,26,0.14)]"
    >
      <div className="relative h-[130px] overflow-hidden" style={{ background: color }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/cajas/miniatura/${g.id}`} alt="" loading="lazy" className="h-full w-full object-cover mix-blend-luminosity opacity-90 group-hover:mix-blend-normal group-hover:opacity-100" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <span className="text-[15px] font-bold text-[#141A26] group-hover:text-[#B34D07]">{g.nombre}</span>
        <span className="flex-1 text-[12.5px] leading-snug text-[#6B6A63]">{g.descripcion}</span>
        <span className="mt-2 self-start rounded-full bg-[#D9F6E8] px-2 py-0.5 text-[11px] font-bold text-[#0F7A4A]">Gratis</span>
      </div>
    </LocalizedClientLink>
  )

  return (
    <div className="px-4 lg:px-8 pt-6 pb-14">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-[#FF6A1A] px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-white">Gratis · sin instalar · sin cuenta</span>
          <h1 className="mt-2 text-[28px] lg:text-[36px] font-bold leading-[1.08] text-[#142033]">Cajas de madera y acrílico para láser y router</h1>
          <p className="mt-2 max-w-[720px] text-[15.5px] leading-relaxed text-[#4A4943]">
            {generadores.length > 0 ? `${generadores.length} diseños` : "Más de 170 diseños"} que se ajustan a tus medidas y al espesor de tu material: pones los números, ves la pieza y
            descargas DXF, SVG, PDF o el archivo para LightBurn. Si no tienes máquina, un taller cercano te la corta.
          </p>
        </div>
      </div>

      {generadores.length === 0 ? (
        <div className="mt-8 rounded-[16px] border-2 border-dashed border-[#FFD5B8] bg-white p-8 text-center">
          <p className="text-[17px] font-bold text-[#142033]">El generador de cajas se está preparando</p>
          <p className="mt-1 text-[14px] text-[#6B6A63]">Mientras tanto puedes usar la <LocalizedClientLink href="/disenar/caja-con-juntas" className="font-semibold text-[#B34D07]">caja con juntas de dedo</LocalizedClientLink>.</p>
        </div>
      ) : (
        <>
          <nav aria-label="Grupos" className="mt-5 flex flex-wrap gap-2">
            {grupos.map((g) => (
              <a key={g.id} href={`#${g.id}`} className="inline-flex items-center gap-2 rounded-full border-2 border-[#E7E4DC] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#141A26] hover:border-[#FF6A1A]">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TEXTO_GRUPOS[g.id]?.color || "#FF6A1A" }} />
                {g.nombre} <span className="font-normal text-[#6B6A63]">{porGrupo.get(g.id)?.length}</span>
              </a>
            ))}
          </nav>

          {destacados.length > 0 && (
            <section className="mt-8">
              <h2 className="text-[22px] font-bold text-[#142033]">Los más usados</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                {destacados.map((g) => <Tarjeta key={g.id} g={g} color={TEXTO_GRUPOS[g.grupo]?.color || "#FF6A1A"} />)}
              </div>
            </section>
          )}

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="flex flex-col gap-10">
              {grupos.map((g) => {
                const lista = porGrupo.get(g.id) || []
                if (!lista.length) return null
                const t = TEXTO_GRUPOS[g.id]
                return (
                  <section key={g.id} id={g.id} className="scroll-mt-24">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-9 w-9 shrink-0 rounded-[10px]" style={{ background: t?.color || "#FF6A1A" }} />
                      <div>
                        <h2 className="text-[22px] font-bold leading-tight text-[#142033]">{g.nombre}</h2>
                        {t && <p className="mt-0.5 text-[14px] text-[#4A4943]">{t.texto}</p>}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
                      {lista.map((x) => <Tarjeta key={x.id} g={x} color={t?.color || "#FF6A1A"} />)}
                    </div>
                  </section>
                )
              })}
            </div>
            <aside className="flex flex-col gap-4">
              <BloquePublicidad />
            </aside>
          </div>

          <p className="mt-12 text-[12.5px] text-[#6B6A63]">
            Motor de cajas basado en{" "}
            <a href="https://github.com/florianfesti/boxes" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#B34D07] hover:underline">Boxes.py</a>{" "}
            (licencia GPL-3.0), un proyecto libre de Florian Festi y colaboradores. HETNA lo ofrece sin cambios como servicio;
            la interfaz, las traducciones y la conexión con talleres son de HETNA.
          </p>
        </>
      )}
    </div>
  )
}
