import type { Metadata } from "next"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

// Liga compartida de HetNa Cloud: un taller comparte un proyecto con su
// cliente o su operador. Se ven las piezas y la última revisión de cada
// archivo (ligas de descarga de 1 hora). Nunca se indexa.

export const metadata: Metadata = {
  title: "Archivos compartidos | HetNa Cloud",
  robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

type Archivo = {
  id: string
  pieza_id: string | null
  nombre: string
  ext: string
  tamano: number
  categoria: string
  revision: number
  estado: string
  fecha: string
  url: string | null
}
type Datos = {
  taller: { nombre: string; handle: string } | null
  proyecto: { nombre: string }
  piezas: { id: string; nombre: string; material: string | null; cantidad: number | null }[]
  archivos: Archivo[]
  vence: string
  solo_liberados: boolean
}

const MEDUSA = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

async function leer(token: string): Promise<Datos | { error: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null
  try {
    const r = await fetch(`${MEDUSA}/store/hetna-cloud/${token}`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      cache: "no-store",
    })
    const d = await r.json().catch(() => ({}))
    if (r.status === 404) return { error: d.message || "Esta liga ya no está disponible." }
    return r.ok ? (d as Datos) : { error: "No pudimos abrir los archivos. Intenta en un momento." }
  } catch {
    return { error: "No pudimos abrir los archivos. Intenta en un momento." }
  }
}

const tamano = (b: number) =>
  b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : b ? `${Math.max(1, Math.round(b / 1024))} KB` : ""

export default async function NubeCompartida({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const d = await leer(token)
  if (!d) notFound()
  if ("error" in d) {
    return (
      <main className="container max-w-[760px] py-16 text-center">
        <h1 className="text-2xl font-bold text-[#142033]">Liga no disponible</h1>
        <p className="mt-2 text-[#40403A]">{d.error}</p>
        <p className="mt-1 text-[#6B675C]">Pide al taller que te comparta una nueva.</p>
      </main>
    )
  }
  const grupos = [...d.piezas.map((p) => ({ ...p, sin: false })), { id: "", nombre: "Archivos del proyecto", material: null, cantidad: null, sin: true }]
    .map((p) => ({ ...p, archivos: d.archivos.filter((a) => (a.pieza_id || "") === p.id) }))
    .filter((g) => !g.sin || g.archivos.length)

  return (
    <main className="container max-w-[860px] py-8 md:py-12">
      <p className="m-0 text-[13px] font-semibold uppercase tracking-wide text-[#C2560A]">HetNa Cloud · archivos compartidos</p>
      <h1 className="m-0 mt-1 text-[26px] font-extrabold text-[#142033]">{d.proyecto.nombre}</h1>
      <p className="m-0 mt-1 text-[14px] text-[#6B675C]">
        {d.taller ? (
          <>
            Compartido por{" "}
            <LocalizedClientLink href={`/talleres/${d.taller.handle}`} className="font-semibold text-[#142033] hover:underline">
              {d.taller.nombre}
            </LocalizedClientLink>
          </>
        ) : (
          "Compartido por un taller de HETNA"
        )}
        {" · "}la liga vence el {new Date(d.vence).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
        {d.solo_liberados ? " · sólo archivos liberados para producción" : ""}
      </p>

      {grupos.map((g) => (
        <section key={g.id || "sin"} className="mt-6 rounded-2xl border border-[#E7E4DC] bg-white p-5">
          <h2 className="m-0 text-[17px] font-bold text-[#142033]">{g.sin ? g.nombre : `Pieza: ${g.nombre}`}</h2>
          {(g.material || g.cantidad) && (
            <p className="m-0 mt-0.5 text-[14px] text-[#6B675C]">{[g.material, g.cantidad ? `${g.cantidad} piezas` : ""].filter(Boolean).join(" · ")}</p>
          )}
          {g.archivos.length ? (
            <ul className="m-0 mt-3 flex list-none flex-col divide-y divide-[#EFECE4] p-0">
              {g.archivos.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0">
                    <strong className="block truncate text-[15px] text-[#1B1B18]">{a.nombre}</strong>
                    <span className="text-[13px] text-[#6B675C]">
                      {[a.categoria, `rev. ${a.revision}`, a.estado, tamano(a.tamano)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {a.url ? (
                    <a href={a.url} className="rounded-xl bg-[#C2560A] px-4 py-2 text-[14px] font-semibold text-white hover:brightness-110" rel="noopener">
                      Descargar
                    </a>
                  ) : (
                    <span className="text-[13px] text-[#A42A2A]">No disponible</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 mt-2 text-[14px] text-[#6B675C]">Sin archivos {d.solo_liberados ? "liberados " : ""}todavía.</p>
          )}
        </section>
      ))}
      <p className="mt-6 text-center text-[13px] text-[#6B675C]">
        Las ligas de descarga duran 15 minutos: si una ya no abre, recarga esta página. ¿Tienes taller?{" "}
        <LocalizedClientLink href="/talleres/unete" className="font-semibold text-[#C2560A]">
          Organiza tus archivos con HetNa Cloud
        </LocalizedClientLink>
        .
      </p>
    </main>
  )
}
