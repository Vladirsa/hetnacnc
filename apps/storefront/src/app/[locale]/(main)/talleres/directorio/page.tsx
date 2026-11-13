import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ESTADOS_MX, NOMBRE_TIPO, type TipoDirectorio, directorioMexico } from "@/lib/hetna/directorio"
import { listarTalleres } from "@/lib/hetna/talleres"

// Directorio de empresas CNC de México que aún NO tienen cuenta en HETNA
// (perfiles no reclamados, ver lib/hetna/directorio.ts). Siempre separado de los
// talleres de HETNA y explicando qué significa cada cosa.

export const revalidate = 3600

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/talleres/directorio" },
  title: "Directorio de talleres y proveedores CNC en México",
  description:
    "Talleres de maquinado, corte láser, router y plasma CNC, proveedores e instructores de todo México. Pide cotización y recibe propuestas de la red HETNA.",
}

const TIPOS: TipoDirectorio[] = ["taller", "proveedor", "instructor"]
const CHIP = "rounded-full px-3 py-1 text-sm"

export default async function DirectorioPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; tipo?: string }>
}) {
  const { estado = "", tipo = "" } = await searchParams
  const [todas, talleres] = await Promise.all([directorioMexico(), listarTalleres().catch(() => [])])
  const estadoSel = ESTADOS_MX.includes(estado) ? estado : ""
  const tipoSel = (TIPOS as string[]).includes(tipo) ? (tipo as TipoDirectorio) : ""
  const lista = todas
    .filter((e) => (!estadoSel || e.estado === estadoSel) && (!tipoSel || e.tipo === tipoSel))
    .sort((a, b) => (a.estado || "zzz").localeCompare(b.estado || "zzz") || a.empresa.localeCompare(b.empresa))
  const estados = ESTADOS_MX.filter((e) => todas.some((x) => x.estado === e))
  const enHetna = estadoSel ? talleres.filter((t) => t.perfil.estado === estadoSel).length : talleres.length
  const liga = (q: { estado?: string; tipo?: string }) => {
    const p = new URLSearchParams()
    if (q.estado) p.set("estado", q.estado)
    if (q.tipo) p.set("tipo", q.tipo)
    const s = p.toString()
    return `/talleres/directorio${s ? `?${s}` : ""}`
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-8">
      <nav className="mb-4 text-sm text-[#6B675C]">
        <LocalizedClientLink href="/talleres" className="hover:text-[#C2560A]">Talleres</LocalizedClientLink> › Directorio
      </nav>
      <h1 className="text-3xl font-extrabold text-[#142033] sm:text-4xl">
        Directorio CNC de México{estadoSel ? `: ${estadoSel}` : ""}
      </h1>
      <p className="mt-2 max-w-3xl text-[#40403A]">
        Empresas de maquinado, corte y fabricación CNC, proveedores e instructores que todavía no forman parte de HETNA.
        Los datos son públicos y vienen del sitio web de cada empresa.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#E7E4DC] bg-white p-4 text-sm text-[#40403A]">
          <p className="font-bold text-[#142033]">¿Buscas quién te fabrique?</p>
          <p className="mt-1">
            Al pedir cotización desde un perfil, tu solicitud llega a la red de talleres HETNA{enHetna ? ` (${enHetna} ${estadoSel ? "en " + estadoSel : "registrados"})` : ""} y
            además invitamos a esa empresa a responderte. Tus datos de contacto no se comparten y pagas dentro de HETNA.
          </p>
        </div>
        <div className="rounded-2xl border-2 border-[#C2560A] bg-[#FDEEE1] p-4 text-sm text-[#40403A]">
          <p className="font-bold text-[#142033]">¿Tu empresa aparece aquí?</p>
          <p className="mt-1">Reclama tu perfil gratis para recibir las solicitudes de clientes, cotizar y vender en HETNA.</p>
          <LocalizedClientLink href="/talleres/unete" className="mt-2 inline-block font-semibold text-[#C2560A] underline">
            Reclamar mi perfil →
          </LocalizedClientLink>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <LocalizedClientLink href={liga({ estado: estadoSel })} className={`${CHIP} ${!tipoSel ? "bg-[#142033] text-white" : "bg-[#F3F1EA] text-[#40403A]"}`}>
          Todos
        </LocalizedClientLink>
        {TIPOS.map((t) => (
          <LocalizedClientLink
            key={t}
            href={liga({ estado: estadoSel, tipo: t })}
            className={`${CHIP} ${tipoSel === t ? "bg-[#142033] text-white" : "bg-[#F3F1EA] text-[#40403A]"}`}
          >
            {NOMBRE_TIPO[t]}
          </LocalizedClientLink>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <LocalizedClientLink href={liga({ tipo: tipoSel })} className={`${CHIP} ${!estadoSel ? "bg-[#C2560A] text-white" : "bg-white text-[#40403A] border border-[#E7E4DC]"}`}>
          Todo México
        </LocalizedClientLink>
        {estados.map((e) => (
          <LocalizedClientLink
            key={e}
            href={liga({ estado: e, tipo: tipoSel })}
            className={`${CHIP} ${estadoSel === e ? "bg-[#C2560A] text-white" : "bg-white text-[#40403A] border border-[#E7E4DC]"}`}
          >
            {e}
          </LocalizedClientLink>
        ))}
      </div>

      <p className="mt-6 text-sm text-[#6B675C]">
        {lista.length} {lista.length === 1 ? "empresa" : "empresas"}
      </p>
      {lista.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-[#E7E4DC] bg-white p-6 text-[#40403A]">
          No hay empresas con este filtro.{" "}
          <LocalizedClientLink href="/talleres" className="font-semibold text-[#C2560A] underline">
            Ver los talleres de HETNA
          </LocalizedClientLink>
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {lista.map((e) => (
            <li key={e.slug} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <LocalizedClientLink href={`/talleres/directorio/${e.slug}`} className="font-bold text-[#142033] hover:text-[#C2560A]">
                {e.empresa}
              </LocalizedClientLink>
              <p className="mt-0.5 text-[13px] text-[#6B675C]">
                {NOMBRE_TIPO[e.tipo]}
                {e.ciudad || e.estado ? ` · ${[e.ciudad, e.estado].filter(Boolean).join(", ")}` : ""}
              </p>
              {e.servicios && <p className="mt-2 line-clamp-2 text-sm text-[#40403A]">{e.servicios}</p>}
              <span className="mt-2 inline-block rounded-full bg-[#F3F1EA] px-2 py-0.5 text-[11px] font-semibold text-[#6B675C]">
                Perfil no reclamado
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
