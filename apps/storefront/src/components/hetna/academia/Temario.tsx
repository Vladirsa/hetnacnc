"use client"

// Temario con reproductor: las lecciones abiertas (vista previa o inscrito)
// se ven aquí mismo; las cerradas muestran un candado. El alumno inscrito
// marca cada lección como vista; con todas vistas obtiene su certificado.
import { useMemo, useState, useTransition } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { type AccesoCurso, type CourseSection, marcarLeccionVista } from "@/lib/data/courses"
import { duracionTexto } from "./formato"

export function Temario({
  secciones,
  acceso,
  slug,
}: {
  secciones: CourseSection[]
  acceso: AccesoCurso | null
  slug?: string
}) {
  const porId = new Map((acceso?.lecciones || []).map((l) => [l.id, l]))
  const orden = useMemo(() => secciones.flatMap((s) => s.lessons), [secciones])
  const [vistas, setVistas] = useState<Set<string>>(
    () => new Set((acceso?.lecciones || []).filter((l) => l.completada).map((l) => l.id))
  )
  const primeraPendiente = acceso?.lecciones.find((l) => l.abierta && l.embed_url && !l.completada)
  const primera = primeraPendiente || acceso?.lecciones.find((l) => l.abierta && l.embed_url)
  const [actual, setActual] = useState<string | null>(primera?.id ?? null)
  const [error, setError] = useState("")
  const [guardando, guardar] = useTransition()

  const video = actual ? porId.get(actual)?.embed_url : null
  const titulo = orden.find((l) => l.id === actual)?.title
  const inscrito = !!acceso?.inscrito
  const total = orden.length
  const hechas = orden.filter((l) => vistas.has(l.id)).length
  const terminado = inscrito && total > 0 && hechas === total
  const pct = total ? Math.round((hechas / total) * 100) : 0

  const marcar = (id: string, hecha: boolean, avanzar = false) => {
    if (!slug || !inscrito) return
    setError("")
    const antes = new Set(vistas)
    const nuevo = new Set(vistas)
    if (hecha) nuevo.add(id)
    else nuevo.delete(id)
    setVistas(nuevo)
    if (avanzar) {
      const i = orden.findIndex((l) => l.id === id)
      const sig = orden.slice(i + 1).find((l) => porId.get(l.id)?.abierta && porId.get(l.id)?.embed_url)
      if (sig) setActual(sig.id)
    }
    guardar(async () => {
      const r = await marcarLeccionVista(slug, id, hecha)
      if (!r.ok) {
        setVistas(antes)
        setError(r.mensaje || "No se pudo guardar tu avance.")
      }
    })
  }

  return (
    <section id="temario" className="flex flex-col gap-4 scroll-mt-24">
      {inscrito && total > 0 && (
        <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-[14px] font-bold text-[#1B1B18]">
              Tu avance: {hechas} de {total} {total === 1 ? "lección" : "lecciones"}
            </p>
            <span className="text-[13px] font-semibold text-[#C2560A]">{pct}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#F1EEE7]">
            <div className="h-full rounded-full bg-[#C2560A] transition-all" style={{ width: `${pct}%` }} />
          </div>
          {terminado && slug && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-[#E6F4EC] px-3 py-2.5">
              <span className="text-[14px] font-semibold text-[#16794F]">¡Terminaste el curso! Ya tienes tu certificado.</span>
              <LocalizedClientLink
                href={`/aprendizaje-cnc/cursos/${slug}/certificado`}
                className="rounded-[8px] bg-[#16794F] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#12623F]"
              >
                Ver mi certificado
              </LocalizedClientLink>
            </div>
          )}
          {error && <p className="m-0 mt-2 text-[13px] text-[#8A1C1C]">{error}</p>}
        </div>
      )}

      {video && (
        <div className="flex flex-col gap-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-[14px] bg-black">
            <iframe
              key={video}
              src={video}
              title={titulo || "Lección"}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {titulo && <p className="m-0 text-[15px] font-semibold text-[#1B1B18]">{titulo}</p>}
            {inscrito && actual && (
              <button
                type="button"
                disabled={guardando}
                onClick={() => marcar(actual, !vistas.has(actual), !vistas.has(actual))}
                className={`rounded-[8px] px-4 py-2 text-[13.5px] font-semibold ${
                  vistas.has(actual)
                    ? "border border-[#E7E4DC] bg-white text-[#1B1B18] hover:border-[#C2560A]"
                    : "bg-[#C2560A] text-white hover:bg-[#A84A08]"
                }`}
              >
                {vistas.has(actual) ? "✓ Vista (desmarcar)" : "Marcar como vista y seguir →"}
              </button>
            )}
          </div>
        </div>
      )}

      <h2 className="m-0 font-display text-[20px] font-bold text-[#1B1B18]">Contenido del curso</h2>
      <div className="flex flex-col gap-3">
        {secciones.map((seccion, i) => (
          <div key={seccion.id} className="overflow-hidden rounded-[14px] border border-[#E7E4DC] bg-white">
            <div className="flex justify-between gap-3 border-b border-[#E7E4DC] bg-[#FAF9F6] px-4 py-3">
              <h3 className="m-0 text-[14.5px] font-bold text-[#1B1B18]">
                {i + 1}. {seccion.title}
              </h3>
              <span className="shrink-0 text-[12.5px] text-[#9A978C]">{seccion.lessons.length} lecciones</span>
            </div>
            <ul className="m-0 list-none p-0">
              {seccion.lessons.map((l) => {
                const a = porId.get(l.id)
                const puede = !!a?.abierta && !!a?.embed_url
                const activa = actual === l.id
                const vista = vistas.has(l.id)
                return (
                  <li key={l.id} className="border-b border-[#F0EEE7] last:border-b-0">
                    <button
                      type="button"
                      disabled={!puede}
                      onClick={() => {
                        setActual(l.id)
                        document.getElementById("temario")?.scrollIntoView({ behavior: "smooth" })
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13.5px] ${
                        activa ? "bg-[#FDEEE1]" : puede ? "hover:bg-[#FAF9F6]" : ""
                      } ${puede ? "cursor-pointer text-[#1B1B18]" : "cursor-default text-[#6B6A63]"}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span aria-hidden="true" className={vista ? "text-[#16794F]" : puede ? "text-[#C2560A]" : "text-[#B8B4A8]"}>
                          {vista ? "✓" : puede ? "▶" : "🔒"}
                        </span>
                        <span className={vista ? "text-[#6B6A63]" : ""}>{l.title}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[#9A978C]">
                        {l.is_preview && !inscrito && (
                          <span className="rounded-full bg-[#FDEEE1] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#C2560A]">
                            Vista previa
                          </span>
                        )}
                        {duracionTexto(l.duration_seconds)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
