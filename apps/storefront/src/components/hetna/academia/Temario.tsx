"use client"

// Temario con reproductor: las lecciones abiertas (vista previa o inscrito)
// se ven aquí mismo; las cerradas muestran un candado.
import { useState } from "react"

import type { AccesoCurso, CourseSection } from "@/lib/data/courses"
import { duracionTexto } from "./formato"

export function Temario({ secciones, acceso }: { secciones: CourseSection[]; acceso: AccesoCurso | null }) {
  const porId = new Map((acceso?.lecciones || []).map((l) => [l.id, l]))
  const primera = acceso?.lecciones.find((l) => l.abierta && l.embed_url)
  const [actual, setActual] = useState<string | null>(primera?.id ?? null)
  const video = actual ? porId.get(actual)?.embed_url : null
  const titulo = secciones.flatMap((s) => s.lessons).find((l) => l.id === actual)?.title

  return (
    <section id="temario" className="flex flex-col gap-4 scroll-mt-24">
      {video && (
        <div className="flex flex-col gap-2">
          <div className="relative w-full aspect-video bg-black rounded-[14px] overflow-hidden">
            <iframe
              key={video}
              src={video}
              title={titulo || "Lección"}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          {titulo && <p className="m-0 text-[15px] font-semibold text-[#1B1B18]">{titulo}</p>}
        </div>
      )}

      <h2 className="font-display text-[20px] font-bold m-0 text-[#1B1B18]">Contenido del curso</h2>
      <div className="flex flex-col gap-3">
        {secciones.map((seccion, i) => (
          <div key={seccion.id} className="bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden">
            <div className="px-4 py-3 bg-[#FAF9F6] border-b border-[#E7E4DC] flex justify-between gap-3">
              <h3 className="m-0 text-[14.5px] font-bold text-[#1B1B18]">
                {i + 1}. {seccion.title}
              </h3>
              <span className="text-[12.5px] text-[#9A978C] shrink-0">{seccion.lessons.length} lecciones</span>
            </div>
            <ul className="m-0 p-0 list-none">
              {seccion.lessons.map((l) => {
                const a = porId.get(l.id)
                const puede = !!a?.abierta && !!a?.embed_url
                const activa = actual === l.id
                return (
                  <li key={l.id} className="border-b border-[#F0EEE7] last:border-b-0">
                    <button
                      type="button"
                      disabled={!puede}
                      onClick={() => {
                        setActual(l.id)
                        document.getElementById("temario")?.scrollIntoView({ behavior: "smooth" })
                      }}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 text-[13.5px] ${
                        activa ? "bg-[#FDEEE1]" : puede ? "hover:bg-[#FAF9F6]" : ""
                      } ${puede ? "text-[#1B1B18] cursor-pointer" : "text-[#6B6A63] cursor-default"}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span aria-hidden="true" className={puede ? "text-[#C2560A]" : "text-[#B8B4A8]"}>
                          {puede ? "▶" : "🔒"}
                        </span>
                        {l.title}
                      </span>
                      <span className="flex items-center gap-2 shrink-0 text-[#9A978C]">
                        {l.is_preview && !acceso?.inscrito && (
                          <span className="text-[11px] font-bold uppercase tracking-wide bg-[#FDEEE1] text-[#C2560A] px-2 py-0.5 rounded-full">
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
