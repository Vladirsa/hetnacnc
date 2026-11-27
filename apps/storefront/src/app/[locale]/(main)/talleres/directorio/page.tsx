import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ESTADOS_MX, NOMBRE_TIPO, type TipoDirectorio, directorioMexico } from "@/lib/hetna/directorio"
import { listarTalleres } from "@/lib/hetna/talleres"
import { estadosIndexables, rutaEstado } from "@/lib/seo/estados"

// Directorio de empresas CNC de México que aún NO tienen cuenta en HETNA
// (perfiles no reclamados, ver lib/hetna/directorio.ts). Siempre separado de los
// talleres de HETNA y explicando qué significa cada cosa.

export const revalidate = 3600

const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/talleres/directorio" },
  title: "Directorio de talleres y proveedores CNC en México",
  description:
    "Talleres de maquinado, corte láser, router y plasma CNC, proveedores e instructores de todo México. Pide cotización y recibe propuestas de la red HETNA.",
}

const TIPOS: TipoDirectorio[] = ["taller", "proveedor", "instructor"]
const CHIP = "rounded-full px-3 py-1 text-sm"
// 26 nov 2026: la lista completa (~880 empresas) pesaba 900 KB de HTML y tardaba en
// responder al toque (Lighthouse 83). Por páginas de 60; todos los perfiles siguen
// en el mapa del sitio (sitemaps/talleres.xml) y en las ligas de página.
const POR_PAGINA = 60

export default async function DirectorioPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; tipo?: string; pagina?: string }>
}) {
  const { estado = "", tipo = "", pagina = "1" } = await searchParams
  const [todas, talleres, porEstado] = await Promise.all([directorioMexico(), listarTalleres().catch(() => []), estadosIndexables()])
  const estadoSel = ESTADOS_MX.includes(estado) ? estado : ""
  const tipoSel = (TIPOS as string[]).includes(tipo) ? (tipo as TipoDirectorio) : ""
  const lista = todas
    .filter((e) => (!estadoSel || e.zona === estadoSel) && (!tipoSel || e.tipo === tipoSel))
    .sort((a, b) => (a.zona || "zzz").localeCompare(b.zona || "zzz") || a.empresa.localeCompare(b.empresa))
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const paginaSel = Math.min(paginas, Math.max(1, Math.floor(Number(pagina)) || 1))
  const visibles = lista.slice((paginaSel - 1) * POR_PAGINA, paginaSel * POR_PAGINA)
  const estados = ESTADOS_MX.filter((e) => todas.some((x) => x.zona === e))
  const enHetna = estadoSel ? talleres.filter((t) => t.perfil.estado === estadoSel).length : talleres.length
  const liga = (q: { estado?: string; tipo?: string; pagina?: number }) => {
    const p = new URLSearchParams()
    if (q.estado) p.set("estado", q.estado)
    if (q.tipo) p.set("tipo", q.tipo)
    if (q.pagina && q.pagina > 1) p.set("pagina", String(q.pagina))
    const s = p.toString()
    return `/talleres/directorio${s ? `?${s}` : ""}`
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-8">
      <nav className="mb-4 text-sm text-[#6B675C]">
        <LocalizedClientLink href="/talleres" className="hover:text-[#C2560A]"><TS>Talleres</TS></LocalizedClientLink> <TS>› Directorio</TS>
      </nav>
      <h1 className="text-3xl font-extrabold text-[#142033] sm:text-4xl">
        <TS>Directorio CNC de México</TS><TS>{estadoSel ? `: ${estadoSel}` : ""}</TS>
      </h1>
      <p className="mt-2 max-w-3xl text-[#40403A]">
        <TS>Empresas de maquinado, corte y fabricación CNC, proveedores e instructores que todavía no forman parte de HETNA.
        Los datos son públicos y vienen del sitio web de cada empresa.</TS>
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#E7E4DC] bg-white p-4 text-sm text-[#40403A]">
          <p className="font-bold text-[#142033]"><TS>¿Buscas quién te fabrique?</TS></p>
          <p className="mt-1">
            <TS>Al pedir cotización desde un perfil, tu solicitud llega a la red de talleres HETNA</TS><TS>{enHetna ? ` (${enHetna} ${estadoSel ? "en " + estadoSel : "registrados"})` : ""}</TS> <TS>y
            además invitamos a esa empresa a responderte. Tus datos de contacto no se comparten y pagas dentro de HETNA.</TS>
          </p>
        </div>
        <div className="rounded-2xl border-2 border-[#C2560A] bg-[#FDEEE1] p-4 text-sm text-[#40403A]">
          <p className="font-bold text-[#142033]"><TS>¿Tu empresa aparece aquí?</TS></p>
          <p className="mt-1"><TS>Reclama tu perfil gratis para recibir las solicitudes de clientes, cotizar y vender en HETNA.</TS></p>
          <LocalizedClientLink href="/talleres/unete" className="mt-2 inline-block font-semibold text-[#C2560A] underline">
            <TS>Reclamar mi perfil →</TS>
          </LocalizedClientLink>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <LocalizedClientLink href={liga({ estado: estadoSel })} className={`${CHIP} ${!tipoSel ? "bg-[#142033] text-white" : "bg-[#F3F1EA] text-[#40403A]"}`}>
          <TS>Todos</TS>
        </LocalizedClientLink>
        {TIPOS.map((t) => (
          <LocalizedClientLink
            key={t}
            href={liga({ estado: estadoSel, tipo: t })}
            className={`${CHIP} ${tipoSel === t ? "bg-[#142033] text-white" : "bg-[#F3F1EA] text-[#40403A]"}`}
          >
            <TS>{NOMBRE_TIPO[t]}</TS>
          </LocalizedClientLink>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <LocalizedClientLink href={liga({ tipo: tipoSel })} className={`${CHIP} ${!estadoSel ? "bg-[#C2560A] text-white" : "bg-white text-[#40403A] border border-[#E7E4DC]"}`}>
          <TS>Todo México</TS>
        </LocalizedClientLink>
        {estados.map((e) => (
          <LocalizedClientLink
            key={e}
            href={liga({ estado: e, tipo: tipoSel })}
            className={`${CHIP} ${estadoSel === e ? "bg-[#C2560A] text-white" : "bg-white text-[#40403A] border border-[#E7E4DC]"}`}
          >
            <TS>{e}</TS>
          </LocalizedClientLink>
        ))}
      </div>

      {estadoSel && porEstado.some((x) => x.ciudad.estado === estadoSel) && (
        <p className="mt-4 text-sm">
          <LocalizedClientLink
            href={rutaEstado(porEstado.find((x) => x.ciudad.estado === estadoSel)!.ciudad)}
            className="font-semibold text-[#C2560A] underline"
          >
            <TS>Ver la página de talleres CNC en</TS> <TS>{estadoSel}</TS> <TS>con servicios y preguntas frecuentes →</TS>
          </LocalizedClientLink>
        </p>
      )}
      {!estadoSel && porEstado.length > 0 && (
        <nav aria-label="Talleres CNC por estado" className="mt-6">
          <p className="text-sm font-semibold text-[#142033]"><TS>Talleres CNC por estado</TS></p>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {porEstado.map((x) => (
              <li key={x.ciudad.slug}>
                <LocalizedClientLink href={rutaEstado(x.ciudad)} className="text-[#C2560A] hover:underline">
                  <TS>Talleres CNC en</TS> <TS>{x.ciudad.estado}</TS>
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p className="mt-6 text-sm text-[#6B675C]">
        <TS>{lista.length}</TS> <TS>{lista.length === 1 ? "empresa" : "empresas"}</TS>
        <TS>{paginas > 1 ? ` · página ${paginaSel} de ${paginas}` : ""}</TS>
      </p>
      {lista.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-[#E7E4DC] bg-white p-6 text-[#40403A]">
          <TS>No hay empresas con este filtro.</TS><TS>{" "}</TS>
          <LocalizedClientLink href="/talleres" className="font-semibold text-[#C2560A] underline">
            <TS>Ver los talleres de HETNA</TS>
          </LocalizedClientLink>
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {visibles.map((e) => (
            <li key={e.slug} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <LocalizedClientLink href={`/talleres/directorio/${e.slug}`} className="font-bold text-[#142033] hover:text-[#C2560A]">
                <TS>{e.empresa}</TS>
              </LocalizedClientLink>
              <p className="mt-0.5 text-[13px] text-[#6B675C]">
                <TS>{NOMBRE_TIPO[e.tipo]}</TS>
                <TS>{e.ciudad || e.estado ? ` · ${[e.ciudad, e.estado].filter(Boolean).join(", ")}` : ""}</TS>
              </p>
              {e.servicios && <p className="mt-2 line-clamp-2 text-sm text-[#40403A]"><TS>{e.servicios}</TS></p>}
              <span className="mt-2 inline-block rounded-full bg-[#F3F1EA] px-2 py-0.5 text-[11px] font-semibold text-[#6B675C]">
                <TS>Perfil no reclamado</TS>
              </span>
            </li>
          ))}
        </ul>
      )}

      {paginas > 1 && (
        <nav aria-label="Páginas del directorio" className="mt-6 flex flex-wrap items-center gap-2 text-sm">
          {paginaSel > 1 && (
            <LocalizedClientLink href={liga({ estado: estadoSel, tipo: tipoSel, pagina: paginaSel - 1 })} rel="prev" className={`${CHIP} border border-[#E7E4DC] bg-white text-[#40403A]`}>
              <TS>← Anterior</TS>
            </LocalizedClientLink>
          )}
          {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
            <LocalizedClientLink
              key={n}
              href={liga({ estado: estadoSel, tipo: tipoSel, pagina: n })}
              aria-current={n === paginaSel ? "page" : undefined}
              className={`${CHIP} ${n === paginaSel ? "bg-[#142033] text-white" : "border border-[#E7E4DC] bg-white text-[#40403A]"}`}
            >
              {n}
            </LocalizedClientLink>
          ))}
          {paginaSel < paginas && (
            <LocalizedClientLink href={liga({ estado: estadoSel, tipo: tipoSel, pagina: paginaSel + 1 })} rel="next" className={`${CHIP} border border-[#E7E4DC] bg-white text-[#40403A]`}>
              <TS>Siguiente →</TS>
            </LocalizedClientLink>
          )}
        </nav>
      )}
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
