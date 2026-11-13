"use client"

// Pasa por ImagenSegura: estas direcciones vienen de la base o del navegador,
// y next/image TRUENA con las que no empiezan en "/" o "https://" (una vista
// previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'

import { useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Taller } from "@/lib/hetna/talleres"
import { TIPOS_MAQUINA, nombreTipoMaquina, tieneMaquina, ubicacion } from "@/lib/hetna/talleres"

import type { RedPorEstado } from "@/lib/foro/red"

import MapaTalleres from "./MapaTalleres"

const unicos = (xs: (string | undefined)[]) =>
  Array.from(new Set(xs.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b))

const SELECT =
  "h-11 rounded-xl border border-[#E7E4DC] bg-white px-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"

export default function DirectorioTalleres({
  talleres,
  locale,
  red = {},
}: {
  talleres: Taller[]
  locale: string
  red?: RedPorEstado
}) {
  const [q, setQ] = useState("")
  const [estado, setEstado] = useState("")
  const [servicio, setServicio] = useState("")
  const [material, setMaterial] = useState("")
  // Licitaciones 2.0 / Perfil CNC: buscar por máquina y tamaño de trabajo
  const [maquina, setMaquina] = useState("")
  const [areaMin, setAreaMin] = useState(0)
  const [soloVerificados, setSoloVerificados] = useState(false)
  const [orden, setOrden] = useState<"recomendados" | "calificacion" | "nombre">("recomendados")

  const estados = useMemo(() => unicos(talleres.map((t) => t.perfil.estado)), [talleres])
  const servicios = useMemo(() => unicos(talleres.flatMap((t) => t.perfil.servicios)), [talleres])
  const materiales = useMemo(() => unicos(talleres.flatMap((t) => t.perfil.materiales)), [talleres])
  // Sólo los tipos de máquina que de verdad hay en el directorio
  const tiposPresentes = useMemo(() => new Set(talleres.flatMap((t) => t.perfil.maquinas.map((m) => m.tipo).filter(Boolean))), [talleres])

  const filtrados = useMemo(() => {
    const txt = q.trim().toLowerCase()
    return talleres.filter((t) => {
      const p = t.perfil
      if (estado && p.estado !== estado) return false
      if (servicio && !p.servicios.includes(servicio)) return false
      if (material && !p.materiales.includes(material)) return false
      if ((maquina || areaMin) && !tieneMaquina(t, maquina, areaMin)) return false
      if (soloVerificados && !t.verificado) return false
      if (txt) {
        const pajar = [
          t.nombre, p.ciudad, p.estado, ...p.servicios, ...p.materiales, ...p.capacidades,
          ...p.maquinas.flatMap((m) => [m.nombre, m.marca, m.controlador, nombreTipoMaquina(m.tipo)]),
        ]
          .join(" ")
          .toLowerCase()
        if (!pajar.includes(txt)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (orden === "nombre") return a.nombre.localeCompare(b.nombre, "es")
      const cal = (t: Taller) => (t.perfil.calificacion ?? 0) * Math.min(1, (t.perfil.resenas ?? 0) / 3)
      if (orden === "calificacion") return cal(b) - cal(a)
      // Recomendados: verificados, con reseñas y con perfil completo primero
      const puntos = (t: Taller) =>
        (t.verificado ? 3 : 0) + cal(t) + (t.perfil.maquinas.length ? 1 : 0) + (t.perfil.galeria.length ? 1 : 0) + (t.fundador ? 0.5 : 0)
      return puntos(b) - puntos(a)
    })
  }, [talleres, q, estado, servicio, material, maquina, areaMin, soloVerificados, orden])

  const hayFiltros = q || estado || servicio || material || maquina || areaMin || soloVerificados

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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={maquina} onChange={(e) => setMaquina(e.target.value)} className={SELECT} aria-label="Tipo de máquina">
          <option value="">Cualquier máquina</option>
          {TIPOS_MAQUINA.filter(([v]) => tiposPresentes.has(v)).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={areaMin} onChange={(e) => setAreaMin(Number(e.target.value))} className={SELECT} aria-label="Tamaño de pieza">
          <option value={0}>Cualquier tamaño</option>
          <option value={300}>Piezas de 30 cm o más</option>
          <option value={600}>Piezas de 60 cm o más</option>
          <option value={1200}>Hojas de 1.22 × 2.44 m</option>
          <option value={1500}>1.5 m o más</option>
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} className={SELECT} aria-label="Ordenar">
          <option value="recomendados">Recomendados</option>
          <option value="calificacion">Mejor calificados</option>
          <option value="nombre">Por nombre</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-[#40403A]">
          <input type="checkbox" checked={soloVerificados} onChange={(e) => setSoloVerificados(e.target.checked)} className="accent-[#C2560A]" />
          Sólo verificados
        </label>
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
              setMaquina("")
              setAreaMin(0)
              setSoloVerificados(false)
            }}
            className="ml-3 font-semibold text-[#C2560A] hover:underline"
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
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#142033] text-xl font-bold text-white">
                {t.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <Image src={t.logo} alt={`Logo de ${t.nombre}`} className="h-full w-full object-cover" loading="lazy" width={300} height={300} />
                ) : (
                  t.nombre.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3">
                  <h3 className="truncate text-base font-bold text-[#142033]">
                  {t.nombre}
                  {t.verificado && <span className="ml-1 text-[#1E7B3A]" title="Taller verificado por HETNA" aria-label="Taller verificado">✓</span>}
                </h3>
                  {t.perfil.calificacion !== undefined && t.perfil.calificacion !== null && (
                    <span className="text-sm font-semibold text-[#C2560A]">
                      ★ {t.perfil.calificacion.toFixed(1)}
                      {t.perfil.resenas ? <span className="font-normal text-[#6B675C]"> ({t.perfil.resenas})</span> : null}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#6B675C]">
                  {ubicacion(t.perfil) || "Ubicación por confirmar"}
                  {t.perfil.entrega ? ` · Entrega ${t.perfil.entrega}` : ""}
                </p>
                {t.perfil.maquinas.length > 0 && (
                  <p className="mt-1 truncate text-xs text-[#40403A]">
                    🛠 {t.perfil.maquinas.slice(0, 3).map((m) => m.nombre).join(" · ")}
                    {t.perfil.maquinas.length > 3 ? ` y ${t.perfil.maquinas.length - 3} más` : ""}
                  </p>
                )}
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
                    className="rounded-lg border border-[#142033] px-3 py-1.5 text-sm font-semibold text-[#142033] hover:bg-[#142033] hover:text-white"
                  >
                    Ver taller
                  </LocalizedClientLink>
                  <LocalizedClientLink
                    href={`/cotizar?taller=${t.handle}`}
                    className="rounded-lg bg-[#C2560A] px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110"
                  >
                    Solicitar cotización
                  </LocalizedClientLink>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="order-1 lg:sticky lg:top-24 lg:order-2 lg:self-start">
          <MapaTalleres
            talleres={filtrados}
            red={red}
            locale={locale}
            altura={480}
            onEstado={(e) => {
              // El mapa usa el nombre oficial del estado; el filtro, el que escribió cada taller
              const norm = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
              setEstado(estados.find((x) => norm(x) === norm(e)) || e)
              document.getElementById("directorio")?.scrollIntoView({ behavior: "smooth" })
            }}
          />
        </div>
      </div>
    </div>
  )
}
