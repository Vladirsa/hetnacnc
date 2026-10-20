"use client"

import { useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Taller } from "@/lib/hetna/talleres"
import { ubicacion } from "@/lib/hetna/talleres"

import MapaTalleres from "./MapaTalleres"

const unicos = (xs: (string | undefined)[]) =>
  Array.from(new Set(xs.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b))

const SELECT =
  "h-11 rounded-xl border border-[#E7E4DC] bg-white px-3 text-sm text-[#1B1B1B] outline-none focus:border-[#E8590C]"

export default function DirectorioTalleres({
  talleres,
  locale,
}: {
  talleres: Taller[]
  locale: string
}) {
  const [q, setQ] = useState("")
  const [estado, setEstado] = useState("")
  const [servicio, setServicio] = useState("")
  const [material, setMaterial] = useState("")

  const estados = useMemo(() => unicos(talleres.map((t) => t.perfil.estado)), [talleres])
  const servicios = useMemo(() => unicos(talleres.flatMap((t) => t.perfil.servicios)), [talleres])
  const materiales = useMemo(() => unicos(talleres.flatMap((t) => t.perfil.materiales)), [talleres])

  const filtrados = useMemo(() => {
    const txt = q.trim().toLowerCase()
    return talleres.filter((t) => {
      const p = t.perfil
      if (estado && p.estado !== estado) return false
      if (servicio && !p.servicios.includes(servicio)) return false
      if (material && !p.materiales.includes(material)) return false
      if (txt) {
        const pajar = [t.nombre, p.ciudad, p.estado, ...p.servicios, ...p.materiales, ...p.capacidades]
          .join(" ")
          .toLowerCase()
        if (!pajar.includes(txt)) return false
      }
      return true
    })
  }, [talleres, q, estado, servicio, material])

  const hayFiltros = q || estado || servicio || material

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar taller, ciudad o servicio"
          className={`${SELECT} sm:col-span-2 lg:col-span-1`}
          aria-label="Buscar taller"
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className={SELECT} aria-label="Estado">
          <option value="">Todos los estados</option>
          {estados.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select value={servicio} onChange={(e) => setServicio(e.target.value)} className={SELECT} aria-label="Servicio">
          <option value="">Todos los servicios</option>
          {servicios.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select value={material} onChange={(e) => setMaterial(e.target.value)} className={SELECT} aria-label="Material">
          <option value="">Todos los materiales</option>
          {materiales.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>

      <p className="mb-3 text-sm text-[#6B675C]">
        {filtrados.length} {filtrados.length === 1 ? "taller" : "talleres"}
        {hayFiltros && (
          <button
            onClick={() => {
              setQ("")
              setEstado("")
              setServicio("")
              setMaterial("")
            }}
            className="ml-3 font-semibold text-[#E8590C] hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="order-2 grid content-start gap-4 lg:order-1">
          {filtrados.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#E7E4DC] p-8 text-center text-[#6B675C]">
              No hay talleres con esos filtros.
            </div>
          )}
          {filtrados.map((t) => (
            <article
              key={t.id}
              className="flex gap-4 rounded-2xl border border-[#E7E4DC] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#1B1B1B] text-xl font-bold text-white">
                {t.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logo} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  t.nombre.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3">
                  <h3 className="truncate text-base font-bold text-[#1B1B1B]">{t.nombre}</h3>
                  {t.perfil.calificacion !== undefined && (
                    <span className="text-sm font-semibold text-[#E8590C]">★ {t.perfil.calificacion.toFixed(1)}</span>
                  )}
                </div>
                <p className="text-sm text-[#6B675C]">
                  {ubicacion(t.perfil) || "Ubicación por confirmar"}
                  {t.perfil.entrega ? ` · Entrega ${t.perfil.entrega}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...t.perfil.servicios, ...t.perfil.materiales].slice(0, 5).map((x) => (
                    <span key={x} className="rounded-full bg-[#F3F1EA] px-2.5 py-0.5 text-xs text-[#40403A]">
                      {x}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <LocalizedClientLink
                    href={`/talleres/${t.handle}`}
                    className="rounded-lg border border-[#1B1B1B] px-3 py-1.5 text-sm font-semibold text-[#1B1B1B] hover:bg-[#1B1B1B] hover:text-white"
                  >
                    Ver taller
                  </LocalizedClientLink>
                  <LocalizedClientLink
                    href={`/cotizar?taller=${t.handle}`}
                    className="rounded-lg bg-[#E8590C] px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110"
                  >
                    Solicitar cotización
                  </LocalizedClientLink>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="order-1 lg:sticky lg:top-24 lg:order-2 lg:self-start">
          <MapaTalleres talleres={filtrados} locale={locale} altura={480} />
        </div>
      </div>
    </div>
  )
}
