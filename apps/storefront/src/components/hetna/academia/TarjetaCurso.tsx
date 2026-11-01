// Tarjeta de curso estilo Udemy/Domestika: portada, taller, duración y precio.
import { ImagenSegura as Image } from "@/components/hetna/ImagenSegura"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Course } from "@/lib/data/courses"

import { ServicioIcono } from "../ServicioIcono"
import { NIVEL, duracionTexto, precioTexto } from "./formato"

export function TarjetaCurso({ c }: { c: Course }) {
  const gratis = !c.precio || c.precio.gratis
  const duracion = duracionTexto(c.duracion_segundos)
  const lecciones = c.lecciones ?? (c.sections || []).reduce((t, s) => t + s.lessons.length, 0)
  return (
    <LocalizedClientLink
      href={`/aprendizaje-cnc/cursos/${c.slug}`}
      className="group bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden flex flex-col hover:border-[#C2560A] hover:shadow-[0_8px_24px_rgba(27,27,24,0.08)] transition"
    >
      <div className="relative">
        {c.thumbnail_url ? (
          <Image src={c.thumbnail_url} alt={c.title} className="w-full aspect-video object-cover" width={480} height={270} />
        ) : (
          <div className="w-full aspect-video bg-[#142033] text-white flex items-center justify-center">
            <ServicioIcono nombre="aprender" size={40} />
          </div>
        )}
        <span
          className={`absolute top-2.5 left-2.5 text-[11.5px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
            gratis ? "bg-[#1F7A4D] text-white" : "bg-white text-[#1B1B18]"
          }`}
        >
          {gratis ? "Gratis" : NIVEL[c.level] || c.level}
        </span>
        {(c.vistas_previas ?? 0) > 0 && !gratis && (
          <span className="absolute bottom-2.5 left-2.5 text-[11px] font-semibold bg-black/70 text-white px-2 py-0.5 rounded-full">
            ▶ Vista previa gratis
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <h3 className="font-display text-[16px] leading-snug font-bold m-0 text-[#1B1B18] line-clamp-2">{c.title}</h3>
        {c.taller?.nombre && <p className="m-0 text-[12.5px] text-[#6B6A63] line-clamp-1">Por {c.taller.nombre}</p>}
        <p className="m-0 text-[12.5px] text-[#9A978C]">
          {[lecciones ? `${lecciones} lecciones` : null, duracion, gratis ? NIVEL[c.level] : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {(c.alumnos ?? 0) > 0 && (
          <p className="m-0 text-[12.5px] text-[#6B6A63]">
            {c.alumnos} {c.alumnos === 1 ? "alumno" : "alumnos"}
          </p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className={`text-[17px] font-bold ${gratis ? "text-[#1F7A4D]" : "text-[#1B1B18]"}`}>{precioTexto(c)}</span>
          <span className="text-[13px] font-semibold text-[#B34D07] group-hover:underline">Ver curso</span>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
