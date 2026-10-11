import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

import { ServicioIcono } from "./ServicioIcono"
import {
  SERVICIOS_PRINCIPALES,
  Servicio,
  buscarServicio,
  subServicios,
} from "./servicios-datos"
import type { LearningArticle } from "@/lib/data/learning-articles"
import type { Course } from "@/lib/data/courses"

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
export const enlaceWhatsApp = (mensaje: string) =>
  `https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

const IconoWhatsApp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" />
  </svg>
)

// Franja final para personas que no saben que servicio elegir
export const FranjaAyuda = () => (
  <section className="bg-[#142033] text-white rounded-[16px] px-6 py-8 lg:px-10 flex flex-col md:flex-row md:items-center gap-5 justify-between">
    <div>
      <h2 className="font-display text-[22px] font-bold m-0">¿No sabes qué servicio necesitas?</h2>
      <p className="m-0 mt-1 text-[#C9D2E0] text-[14.5px]">
        Cuéntanos tu proyecto y te decimos cómo hacerlo.
      </p>
    </div>
    <a
      href={enlaceWhatsApp("Hola HETNA CNC, quiero platicar sobre mi proyecto.")}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1FB457] text-[#0F1826] font-semibold px-5 py-3 rounded-[10px] text-[14.5px]"
    >
      <IconoWhatsApp />
      Escríbenos
    </a>
  </section>
)

// Tarjeta de servicio (indice y sub-servicios)
export const TarjetaServicio = ({ s }: { s: Servicio }) => (
  <LocalizedClientLink
    href={`/servicios/${s.slug}`}
    className="group bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-3 hover:border-[#C2560A] hover:shadow-[0_8px_24px_rgba(27,27,24,0.08)] transition"
  >
    <div className="flex items-center justify-between">
      <span className="w-11 h-11 rounded-[10px] bg-[#FDEEE1] text-[#C2560A] flex items-center justify-center">
        <ServicioIcono nombre={s.icono} size={24} />
      </span>
      <span className="text-[12px] font-bold text-[#9A978C]">{s.numero}</span>
    </div>
    <h3 className="font-display text-[18px] font-bold m-0 text-[#1B1B18]">{s.nombre}</h3>
    <p className="m-0 text-[14px] text-[#6B6A63] leading-relaxed">{s.resumen}</p>
    {subServicios(s.slug).length > 0 && (
      <ul className="m-0 p-0 list-none flex flex-col gap-1">
        {subServicios(s.slug).map((h) => (
          <li key={h.slug} className="text-[13px] text-[#1B1B18] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C2560A]" />
            {h.nombre}
          </li>
        ))}
      </ul>
    )}
    <span className="mt-auto pt-1 text-[13.5px] font-semibold text-[#B34D07] group-hover:underline">
      Ver servicio
    </span>
  </LocalizedClientLink>
)

export const ServiciosIndice = () => (
  <main className="w-full bg-[#FAF9F6] px-4 lg:px-16 py-8 lg:py-12 flex flex-col gap-8">
    <div>
      <h1 className="font-display text-[28px] lg:text-[36px] font-bold m-0 text-[#1B1B18]">
        Nuestros servicios
      </h1>
      <p className="m-0 mt-2 text-[15.5px] text-[#6B6A63] max-w-[620px]">
        Diseño, maquinado, aprendizaje y herramientas para tu taller CNC.
      </p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {SERVICIOS_PRINCIPALES.map((s) => (
        <TarjetaServicio key={s.slug} s={s} />
      ))}
    </div>
    <FranjaAyuda />
  </main>
)

export const ArticuloAprendizajeCard = ({ a }: { a: LearningArticle }) => (
  <LocalizedClientLink
    href={`/aprendizaje-cnc/${a.slug}`}
    className="group bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden flex flex-col hover:border-[#C2560A] hover:shadow-[0_8px_24px_rgba(27,27,24,0.08)] transition"
  >
    {a.cover_image_url && (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={a.cover_image_url} alt={a.title} className="w-full aspect-video object-cover" />
    )}
    <div className="p-4 flex flex-col gap-2">
      <h3 className="font-display text-[16px] font-bold m-0 text-[#1B1B18] line-clamp-2">
        {a.title}
      </h3>
      <p className="m-0 text-[13.5px] text-[#6B6A63] leading-relaxed line-clamp-2">{a.excerpt}</p>
      <span className="mt-1 text-[13px] font-semibold text-[#B34D07] group-hover:underline">
        Leer más
      </span>
    </div>
  </LocalizedClientLink>
)

const NIVEL_ETIQUETA: Record<Course["level"], string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
}

export const CursoCard = ({ c }: { c: Course }) => {
  const totalLecciones = (c.sections || []).reduce((acc, sec) => acc + sec.lessons.length, 0)
  return (
    <LocalizedClientLink
      href={`/aprendizaje-cnc/cursos/${c.slug}`}
      className="group bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden flex flex-col hover:border-[#C2560A] hover:shadow-[0_8px_24px_rgba(27,27,24,0.08)] transition"
    >
      {c.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.thumbnail_url} alt={c.title} className="w-full aspect-video object-cover" />
      ) : (
        <div className="w-full aspect-video bg-[#142033] flex items-center justify-center">
          <ServicioIcono nombre="aprender" size={36} />
        </div>
      )}
      <div className="p-4 flex flex-col gap-2">
        <span className="self-start text-[11px] font-bold uppercase tracking-wide bg-[#FDEEE1] text-[#C2560A] px-2.5 py-1 rounded-full">
          {NIVEL_ETIQUETA[c.level] || c.level}
        </span>
        <h3 className="font-display text-[16px] font-bold m-0 text-[#1B1B18] line-clamp-2">
          {c.title}
        </h3>
        {c.description && (
          <p className="m-0 text-[13.5px] text-[#6B6A63] leading-relaxed line-clamp-2">{c.description}</p>
        )}
        {totalLecciones > 0 && (
          <span className="text-[12.5px] text-[#9A978C]">{totalLecciones} lecciones</span>
        )}
        <span className="mt-1 text-[13px] font-semibold text-[#B34D07] group-hover:underline">
          Ver curso
        </span>
      </div>
    </LocalizedClientLink>
  )
}

export const ServicioPagina = ({
  s,
  articulos,
  cursos,
}: {
  s: Servicio
  articulos?: LearningArticle[]
  cursos?: Course[]
}) => {
  const padre = s.padre ? buscarServicio(s.padre) : undefined
  const hijos = subServicios(s.slug)

  return (
    <main className="w-full bg-[#FAF9F6]">
      {/* Migas */}
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios" className="hover:text-[#B34D07]">Servicios</LocalizedClientLink>
        {padre && (
          <>
            <span>/</span>
            <LocalizedClientLink href={`/servicios/${padre.slug}`} className="hover:text-[#B34D07]">
              {padre.nombre}
            </LocalizedClientLink>
          </>
        )}
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">{s.nombre}</span>
      </div>

      {/* Portada del servicio */}
      <section className="px-4 lg:px-16 pt-5 pb-8">
        <div className="bg-[#142033] text-white rounded-[18px] overflow-hidden grid lg:grid-cols-[1.4fr_1fr]">
          <div className="p-6 lg:p-10 flex flex-col gap-4">
            <span className="self-start text-[12px] font-bold tracking-wide uppercase bg-[#C2560A] px-3 py-1 rounded-full">
              {s.nombre}
            </span>
            <h1 className="font-display text-[30px] lg:text-[42px] leading-[1.1] font-bold m-0">
              {s.titulo}
            </h1>
            <p className="m-0 text-[15.5px] lg:text-[17px] text-[#C9D2E0] max-w-[560px] leading-relaxed">
              {s.subtitulo}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={enlaceWhatsApp(s.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[14.5px]"
              >
                <IconoWhatsApp />
                {s.boton}
              </a>
              <a
                href="#como-funciona"
                className="inline-flex items-center border border-[#3A4A63] hover:border-white text-white font-semibold px-5 py-3 rounded-[10px] text-[14.5px]"
              >
                Cómo funciona
              </a>
            </div>
          </div>
          <div className="relative hidden lg:flex items-center justify-center bg-[#0F1826] p-10">
            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "linear-gradient(#C9D2E0 1px, transparent 1px), linear-gradient(90deg, #C9D2E0 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            <div className="relative flex flex-col items-center gap-5">
              <span className="w-28 h-28 rounded-[24px] bg-[#C2560A] text-white flex items-center justify-center shadow-[0_12px_40px_rgba(194,86,10,0.45)]">
                <ServicioIcono nombre={s.icono} size={60} />
              </span>
              <div className="flex flex-wrap justify-center gap-2 max-w-[260px]">
                {s.formatos.map((f) => (
                  <span key={f} className="text-[12px] font-semibold bg-white/10 border border-white/20 px-2.5 py-1 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 lg:px-16 pb-12 flex flex-col gap-10">
        {s.proximo && (
          <div className="bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <span className="self-start text-[11.5px] font-bold uppercase tracking-wide bg-[#F2A65A] text-[#3A2206] px-2.5 py-1 rounded-full">
              En desarrollo
            </span>
            <p className="m-0 text-[14px] text-[#5A3A12]">
              <span>{s.proximo}</span> <span>Mientras tanto, te atendemos por WhatsApp.</span>
            </p>
          </div>
        )}

        {s.slug === "aprendizaje-cnc" && (
          <LocalizedClientLink
            href="/foro-cnc"
            className="group bg-white border border-[#E7E4DC] hover:border-[#C2560A] rounded-[16px] p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
          >
            <div className="flex gap-4 items-start">
              <span className="w-12 h-12 rounded-[12px] bg-[#FDEEE1] text-[#C2560A] flex items-center justify-center shrink-0">
                <ServicioIcono nombre="aprender" size={26} />
              </span>
              <div>
                <h2 className="font-display text-[20px] font-bold m-0 text-[#1B1B18]">Foro CNC México</h2>
                <p className="m-0 mt-1 text-[14.5px] text-[#6B6A63] leading-relaxed max-w-[620px]">
                  Pregunta a talleres y profesionales, comparte tus trabajos y videos, y date a conocer con tu perfil. Gratis.
                </p>
              </div>
            </div>
            <span className="shrink-0 self-start sm:self-auto bg-[#C2560A] group-hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[14.5px]">
              Entrar al foro
            </span>
          </LocalizedClientLink>
        )}

        {s.slug === "aprendizaje-cnc" && cursos && cursos.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-[22px] font-bold m-0 text-[#1B1B18]">
              Cursos de la Academia
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cursos.map((c) => (
                <CursoCard key={c.id} c={c} />
              ))}
            </div>
          </section>
        )}

        {s.slug === "aprendizaje-cnc" && articulos && articulos.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-[22px] font-bold m-0 text-[#1B1B18]">
              Guías y artículos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {articulos.map((a) => (
                <ArticuloAprendizajeCard key={a.id} a={a} />
              ))}
            </div>
          </section>
        )}

        {hijos.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-[22px] font-bold m-0 text-[#1B1B18]">
              {s.slug === "laboratorio-cam" ? "Servicios de este laboratorio" : "Herramientas y servicios"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {hijos.map((h) => (
                <TarjetaServicio key={h.slug} s={h} />
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-[22px] font-bold m-0 text-[#1B1B18]">Qué incluye</h2>
          <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 gap-3">
            {s.incluye.map((x) => (
              <li
                key={x}
                className="bg-white border border-[#E7E4DC] rounded-[12px] px-4 py-3.5 flex gap-3 items-start text-[14.5px] text-[#1B1B18]"
              >
                <span className="text-[#16794F] mt-0.5 shrink-0">
                  <Check />
                </span>
                {x}
              </li>
            ))}
          </ul>
        </section>

        <section id="como-funciona" className="flex flex-col gap-4 scroll-mt-24">
          <h2 className="font-display text-[22px] font-bold m-0 text-[#1B1B18]">Cómo funciona</h2>
          <ol className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {s.pasos.map((p, i) => (
              <li key={p.titulo} className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-2">
                <span className="w-8 h-8 rounded-full bg-[#142033] text-white text-[14px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <h3 className="m-0 text-[15.5px] font-bold text-[#1B1B18]">{p.titulo}</h3>
                <p className="m-0 text-[13.5px] text-[#6B6A63] leading-relaxed">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lg:hidden flex flex-col gap-3">
          <h2 className="font-display text-[18px] font-bold m-0 text-[#1B1B18]">Formatos</h2>
          <div className="flex flex-wrap gap-2">
            {s.formatos.map((f) => (
              <span key={f} className="text-[12.5px] font-semibold bg-white border border-[#E7E4DC] px-3 py-1 rounded-full">
                {f}
              </span>
            ))}
          </div>
        </section>

        <FranjaAyuda />
      </div>
    </main>
  )
}
