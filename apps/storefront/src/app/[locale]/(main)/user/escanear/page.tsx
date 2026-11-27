import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { NuevaSolicitudEscanear } from "@/components/hetna/escanear/NuevaSolicitudEscanear"
import { misSolicitudesEscanear } from "@/lib/escanear/acciones"
import { fechaSegura } from "@/lib/helpers/fecha-segura"

// Escanear (Fase 1, uso interno): piezas reales rotas o sin plano que se
// escanean, se rediseñan, se aprueban con un render y se mandan a fabricar.
// No sale en el menú ni en buscadores mientras no se abra al público.
export const dynamic = "force-dynamic"
const metadataEs: Metadata = { title: "Escanear · Mis piezas", robots: { index: false, follow: false } }

const FECHA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" })

export default async function EscanearPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const r = await misSolicitudesEscanear()
  if (!r.ok && r.noAutenticado) {
    return (
      <main className="container">
        <div className="mx-auto max-w-[460px] py-16 text-center">
          <h1 className="text-[24px] font-bold text-[#1B1B18]"><TS>Entra a tu cuenta</TS></h1>
          <LocalizedClientLink href="/login" className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white">
            <TS>Iniciar sesión</TS>
          </LocalizedClientLink>
        </div>
      </main>
    )
  }
  const datos = r.ok ? r.datos : { puede_pedir: false, aviso: "", solicitudes: [] }
  return (
    <main className="container">
      <div className="mx-auto max-w-[900px] py-10">
        <p className="m-0 text-[12px] font-bold uppercase tracking-[.2em] text-[#C2560A]"><TS>Escanear</TS></p>
        <h1 className="m-0 mt-1 text-[30px] font-bold leading-tight text-[#0E2A5C]"><TS>Ingeniería inversa desde una pieza real</TS></h1>
        <p className="mt-2 max-w-[700px] text-[15.5px] leading-relaxed text-[#40403A]">
          <TS>Una pieza se rompió, se perdió o ya no tiene plano: se escanea en 3D, se rediseña completando lo que falta, apruebas el render y se fabrica en impresión 3D o CNC. También sirve para moldes.</TS>
        </p>
        {datos.aviso && <p className="mt-3 rounded-[10px] border border-[#F2D9C4] bg-[#FFF8F1] px-4 py-3 text-[13.5px] leading-relaxed text-[#6B4A2B]"><TS>{datos.aviso}</TS></p>}
        {!r.ok && <p className="mt-4 rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[14px] text-[#9B1C1C]"><TS>{r.mensaje}</TS></p>}

        {datos.solicitudes.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[19px] font-bold text-[#1B1B18]"><TS>Mis piezas</TS></h2>
            <ul className="mt-3 flex flex-col gap-2 p-0">
              {datos.solicitudes.map((s) => (
                <li key={s.id} className="list-none">
                  <LocalizedClientLink href={`/user/escanear/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#E7E4DC] bg-white px-4 py-3 hover:border-[#C2560A]">
                    <span>
                      <span className="text-[12px] font-bold text-[#6B6A63]"><TS>{s.folio_texto}</TS></span>
                      <span className="ml-2 text-[15.5px] font-semibold text-[#1B1B18]"><TS>{s.titulo}</TS></span>
                    </span>
                    <span className="flex items-center gap-3 text-[13px]">
                      <span className={`rounded-full px-2.5 py-1 font-semibold ${s.estado === "render_listo" ? "bg-[#FFF1E5] text-[#B34D07]" : s.estado === "terminada" ? "bg-[#E7F6EE] text-[#0F7A4A]" : "bg-[#EEF1F6] text-[#0E2A5C]"}`}><TS>{s.nombre_estado}</TS></span>
                      <span className="text-[#6B6A63]">{fechaSegura(FECHA, s.creado)}</span>
                    </span>
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          {datos.puede_pedir ? (
            <NuevaSolicitudEscanear locale={locale} />
          ) : (
            <p className="rounded-[12px] border border-[#E7E4DC] bg-white px-4 py-4 text-[15px] text-[#40403A]">
              <TS>Escanear todavía no está abierto al público. Si necesitas reponer una pieza rota o sin plano,</TS> <LocalizedClientLink href="/cotizar" className="font-semibold text-[#B34D07] underline"><TS>pide una cotización</TS></LocalizedClientLink> <TS>y cuéntanos el caso.</TS>
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
