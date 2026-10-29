"use client"

import { useEffect, useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Taller } from "@/lib/hetna/talleres"

// Lista "talleres cerca de ti" junto al formulario de /cotizar. Se ordena por
// cercanía con lo que el cliente escribe en el formulario (código postal →
// municipio y estado, que llegan por el evento "hetna:ubicacion"). Mientras no
// hay ubicación, muestra los talleres que hacen ese proceso.
//
// La cercanía es por municipio y estado, no por kilómetros: los perfiles de
// taller guardan municipio, estado y código postal, no coordenadas.

type Ubicacion = { cp: string; municipio: string; estado: string }

const norm = (v?: string) => (v || "").trim().toLowerCase()

const ETIQUETA_OFRECE: Record<string, string> = {
  diseno: "Diseño incluido",
  entrega_local: "Entrega local",
  envio: "Envío a todo México",
}

// `query`: los parámetros actuales de /cotizar (pieza, material, archivo…) para
// que al elegir un taller la solicitud siga prellenada.
export const TalleresCerca = ({ talleres, proceso, query }: { talleres: Taller[]; proceso?: string; query: string }) => {
  const cotizarCon = (handle: string) => `/cotizar?taller=${encodeURIComponent(handle)}${query ? `&${query}` : ""}`
  const [u, setU] = useState<Ubicacion | null>(null)

  useEffect(() => {
    const f = (e: Event) => setU((e as CustomEvent<Ubicacion>).detail)
    window.addEventListener("hetna:ubicacion", f)
    return () => window.removeEventListener("hetna:ubicacion", f)
  }, [])

  const lista = useMemo(() => {
    const hacen = talleres.filter((t) => !proceso || !t.perfil.servicios.length || t.perfil.servicios.includes(proceso))
    const nivel = (t: Taller) => {
      if (!u) return 3
      if (norm(t.perfil.cp) === norm(u.cp) && u.cp) return 0
      if (norm(t.perfil.ciudad) === norm(u.municipio) && u.municipio) return 0
      if (norm(t.perfil.estado) === norm(u.estado) && u.estado) return 1
      return t.perfil.ofrece.includes("envio") ? 2 : 3
    }
    return hacen
      .map((t) => ({ t, n: nivel(t) }))
      .sort((a, b) => a.n - b.n || Number(b.t.verificado) - Number(a.t.verificado) || (b.t.perfil.calificacion || 0) - (a.t.perfil.calificacion || 0))
      .slice(0, 5)
  }, [talleres, proceso, u])

  if (!lista.length) return null

  const etiqueta = (n: number) =>
    n === 0 ? ["En tu municipio", "bg-[#FF6A1A] text-white"] : n === 1 ? ["En tu estado", "bg-[#FFC53D] text-[#142033]"] : null

  return (
    <div className="rounded-2xl border-2 border-[#FFD5B8] bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#B34D07]">Talleres cerca de ti</p>
      <p className="mt-1 text-[13px] text-[#6B675C]">
        {u ? `Para ${u.municipio}, ${u.estado}. Elige uno y le llega tu solicitud primero.` : "Escribe tu código postal en el formulario y los ordenamos por cercanía."}
      </p>
      <ul className="mt-3 grid gap-2.5">
        {lista.map(({ t, n }) => {
          const e = etiqueta(n)
          return (
            <li key={t.id} className="rounded-xl border border-[#E7E4DC] p-3">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#142033] text-[13px] font-extrabold text-[#FFC53D]">
                  {t.nombre.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-[#142033]">{t.nombre}</p>
                  <p className="text-[12px] text-[#6B675C]">
                    {[t.perfil.ciudad, t.perfil.estado].filter(Boolean).join(", ")}
                    {t.perfil.calificacion ? ` · ★ ${t.perfil.calificacion.toFixed(1)}` : ""}
                    {t.perfil.entrega ? ` · ${t.perfil.entrega}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {e && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${e[1]}`}>{e[0]}</span>}
                    {t.perfil.ofrece.map((o) => ETIQUETA_OFRECE[o] && (
                      <span key={o} className="rounded-full bg-[#EEE7FB] px-2 py-0.5 text-[11px] font-bold text-[#6D28D9]">{ETIQUETA_OFRECE[o]}</span>
                    ))}
                    {t.verificado && <span className="rounded-full bg-[#D9F6E8] px-2 py-0.5 text-[11px] font-bold text-[#0F7A4A]">Verificado</span>}
                  </div>
                </div>
              </div>
              <LocalizedClientLink
                href={cotizarCon(t.handle)}
                className="mt-2.5 block rounded-[10px] border-2 border-[#142033] px-3 py-2 text-center text-[13px] font-bold text-[#142033] hover:bg-[#142033] hover:text-white"
              >
                Cotizar con este taller
              </LocalizedClientLink>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
