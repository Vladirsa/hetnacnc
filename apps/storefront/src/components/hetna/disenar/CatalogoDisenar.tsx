"use client"

import { useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ServicioIcono } from "@/components/hetna/ServicioIcono"
import { PROCESOS, type Proceso, SECCIONES, type TarjetaDiseno } from "@/lib/hetna/disenar-catalogo"

// Catálogo del inicio de Diseñar: buscador, filtros por máquina y secciones de
// tarjetas de color. Entre la segunda y la tercera sección va la franja del
// escaneo 3D (servicio de pago), que se pasa como `franja`.

const TEXTO: Record<Proceso, string> = { laser: "#B34D07", router: "#0F7A4A", "3d": "#0369A1", papel: "#5B21B6" }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

const Tarjeta = ({ t }: { t: TarjetaDiseno }) => (
  <LocalizedClientLink
    href={t.href}
    className="group flex flex-col overflow-hidden rounded-[14px] border bg-white transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(20,32,51,0.12)]"
    style={{ borderColor: t.color }}
  >
    <span className="grid h-[104px] place-items-center text-white" style={{ background: t.color, color: t.color === "#FFC53D" ? "#142033" : "#fff" }}>
      <ServicioIcono nombre={t.icono} size={46} />
    </span>
    <span className="flex flex-1 flex-col p-3.5">
      <span className="text-[15px] font-bold leading-tight text-[#1B1B18] group-hover:text-[#B34D07]">{t.nombre}</span>
      <span className="mt-1 flex-1 text-[13px] leading-snug text-[#4A4943]">{t.texto}</span>
      <span
        className={`mt-3 self-start rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
          t.acceso === "gratis" ? "bg-[#E7F5EC] text-[#1E7B3A]" : "bg-[#FFF3D6] text-[#8A5A00]"
        }`}
      >
        {t.acceso === "gratis" ? "Gratis" : "Vista previa gratis · con créditos"}
      </span>
    </span>
  </LocalizedClientLink>
)

export const CatalogoDisenar = ({ franja }: { franja: React.ReactNode }) => {
  const [q, setQ] = useState("")
  const [proceso, setProceso] = useState<Proceso | "">("")

  const secciones = useMemo(() => {
    const nq = norm(q.trim())
    return SECCIONES.map((s) => ({
      ...s,
      tarjetas: s.tarjetas.filter(
        (t) => (!proceso || t.para.includes(proceso)) && (!nq || norm(`${t.nombre} ${t.texto} ${t.claves || ""} ${s.titulo}`).includes(nq))
      ),
    })).filter((s) => s.tarjetas.length)
  }, [q, proceso])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex flex-1 items-center gap-3">
          <span className="shrink-0 text-[15px] font-bold text-[#1B1B18]">¿Qué quieres hacer hoy?</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="caja con bisagra, letrero, pirámide, llavero…"
            className="h-11 w-full rounded-xl border border-[#E7E4DC] bg-white px-4 text-[15px] text-[#1B1B18] outline-none focus:border-[#C2560A]"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {PROCESOS.map((p) => {
            const activo = proceso === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProceso(activo ? "" : p.id)}
                className="rounded-full border px-3.5 py-1.5 text-[13.5px] font-bold transition"
                style={activo ? { background: p.color, borderColor: p.color, color: "#fff" } : { background: `${p.color}1A`, borderColor: `${p.color}66`, color: TEXTO[p.id] }}
              >
                {p.nombre}
              </button>
            )
          })}
        </div>
      </div>

      {!secciones.length && (
        <p className="rounded-xl bg-white px-4 py-6 text-center text-[14px] text-[#6B6A63]">
          No encontramos una herramienta con eso. Prueba con «caja», «letrero», «empaque» o «escanear», o{" "}
          <LocalizedClientLink href="/cotizar" className="font-semibold text-[#B34D07] hover:underline">pide que te lo diseñen</LocalizedClientLink>.
        </p>
      )}

      {secciones.map((s, i) => (
        <div key={s.id} className="contents">
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-[22px] font-extrabold text-[#1B1B18]">
                {s.titulo} <span className="ml-1 text-[13.5px] font-normal text-[#6B6A63]">{s.subtitulo}</span>
              </h2>
              {s.ver && (
                <LocalizedClientLink href={s.ver.href} className="text-[14px] font-bold text-[#C2560A] hover:underline">
                  {s.ver.texto} →
                </LocalizedClientLink>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
              {s.tarjetas.map((t) => (
                <Tarjeta key={t.href} t={t} />
              ))}
            </div>
          </section>
          {i === 1 && franja}
        </div>
      ))}
      {secciones.length > 0 && secciones.length < 2 && franja}
    </div>
  )
}
