// /servicios/aprendizaje-cnc: la Academia HETNA, estilo Udemy/Domestika.
// Los talleres suben sus cursos (gratis o de pago) desde su panel; HETNA cobra
// una comisión (10%, ver Términos para vendedores) sólo cuando se vende uno. Los videos viven en el YouTube (oculto) o
// Vimeo del taller, así que la Academia no le cuesta nada a HETNA.
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Course } from "@/lib/data/courses"
import type { LearningArticle } from "@/lib/data/learning-articles"

import { ServicioIcono } from "../ServicioIcono"
import { ArticuloAprendizajeCard, FranjaAyuda } from "../ServicioPagina"
import { CatalogoCursos } from "./CatalogoCursos"

const PASOS_ALUMNO = [
  { t: "Elige tu curso", d: "Filtra por nivel o busca el tema. Muchos son gratis y los de pago tienen lecciones de muestra." },
  { t: "Inscríbete", d: "Los gratis con un clic. Los de pago con Mercado Pago, tarjeta o PayPal; quedas inscrito al pagar." },
  { t: "Aprende a tu ritmo", d: "Entra cuando quieras desde tu cuenta, en el celular o la computadora, sin fecha de vencimiento." },
]

const PASOS_TALLER = [
  "Graba tus clases y súbelas a tu YouTube (como “oculto”) o a Vimeo.",
  "En tu panel de taller, entra a Cursos: título, temario y pega el enlace de cada lección.",
  "Elige si es gratis o pon tu precio. HETNA lo promociona en la tienda, Facebook e Instagram.",
  "Cobras cada venta en tu saldo, disponible al momento.",
]

export function Academia({ cursos, articulos }: { cursos: Course[]; articulos?: LearningArticle[] }) {
  const gratis = cursos.filter((c) => !c.precio || c.precio.gratis).length
  const talleres = new Set(cursos.map((c) => c.taller?.id).filter(Boolean)).size

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios" className="hover:text-[#B34D07]">Servicios</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Academia CNC</span>
      </div>

      <section className="px-4 lg:px-16 py-5 lg:py-7">
        <div className="relative bg-[#142033] text-white rounded-[18px] overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.10]"
            style={{
              backgroundImage:
                "linear-gradient(#C9D2E0 1px, transparent 1px), linear-gradient(90deg, #C9D2E0 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
            aria-hidden="true"
          />
          <div className="relative p-6 lg:p-10 flex flex-col gap-4 max-w-[760px]">
            <span className="self-start text-[12px] font-bold tracking-wide uppercase bg-[#C2560A] px-3 py-1 rounded-full">
              Academia HETNA
            </span>
            <h1 className="font-display text-[30px] lg:text-[44px] leading-[1.08] font-bold m-0">
              Aprende CNC con los talleres que lo hacen todos los días
            </h1>
            <p className="m-0 text-[15.5px] lg:text-[17px] text-[#C9D2E0] leading-relaxed">
              Router, láser, plasma, torno, Fusion 360 y G-code. Cursos prácticos en español, muchos gratis, impartidos
              por talleres de México.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <a href="#cursos" className="inline-flex items-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[14.5px]">
                Ver cursos
              </a>
              <a href="#ensena" className="inline-flex items-center border border-[#3A4A63] hover:border-white text-white font-semibold px-5 py-3 rounded-[10px] text-[14.5px]">
                Enseña en HETNA
              </a>
            </div>
            {cursos.length > 0 && (
              <dl className="m-0 pt-3 grid grid-cols-3 gap-3 max-w-[460px]">
                {[
                  [cursos.length, cursos.length === 1 ? "curso" : "cursos"],
                  [gratis, gratis === 1 ? "gratis" : "gratis"],
                  [talleres, talleres === 1 ? "taller" : "talleres"],
                ].map(([n, t]) => (
                  <div key={String(t)} className="bg-white/5 border border-white/15 rounded-[12px] px-3 py-2">
                    <dt className="sr-only">{t}</dt>
                    <dd className="m-0 text-[22px] font-bold leading-none">{n}</dd>
                    <span className="text-[12px] text-[#C9D2E0]">{t}</span>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </section>

      <div className="px-4 lg:px-16 pb-12 flex flex-col gap-12">
        <section id="cursos" className="flex flex-col gap-4 scroll-mt-24">
          <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">Cursos</h2>
          {cursos.length ? (
            <CatalogoCursos cursos={cursos} />
          ) : (
            <div className="bg-white border border-[#E7E4DC] rounded-[16px] p-6 lg:p-8 flex flex-col sm:flex-row gap-5 sm:items-center justify-between">
              <div className="flex gap-4 items-start">
                <span className="w-12 h-12 rounded-[12px] bg-[#FDEEE1] text-[#C2560A] flex items-center justify-center shrink-0">
                  <ServicioIcono nombre="aprender" size={26} />
                </span>
                <div>
                  <h3 className="m-0 font-display text-[19px] font-bold text-[#1B1B18]">Los primeros cursos vienen en camino</h3>
                  <p className="m-0 mt-1 text-[14.5px] text-[#6B6A63] max-w-[560px]">
                    Mientras tanto, aprende gratis con las guías de abajo y pregunta en el Foro CNC. ¿Tienes un taller?
                    Sé de los primeros en publicar tu curso.
                  </p>
                </div>
              </div>
              <a href="#ensena" className="shrink-0 self-start sm:self-auto bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[14.5px]">
                Publicar mi curso
              </a>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-[22px] font-bold m-0 text-[#1B1B18]">Cómo funciona</h2>
          <ol className="m-0 p-0 list-none grid grid-cols-1 md:grid-cols-3 gap-4">
            {PASOS_ALUMNO.map((p, i) => (
              <li key={p.t} className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-2">
                <span className="w-8 h-8 rounded-full bg-[#142033] text-white text-[14px] font-bold flex items-center justify-center">{i + 1}</span>
                <h3 className="m-0 text-[16px] font-bold text-[#1B1B18]">{p.t}</h3>
                <p className="m-0 text-[14px] text-[#6B6A63] leading-relaxed">{p.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="ensena" className="scroll-mt-24 bg-white border border-[#E7E4DC] rounded-[18px] overflow-hidden grid lg:grid-cols-[1fr_1.2fr]">
          <div className="bg-[#C2560A] text-white p-6 lg:p-10 flex flex-col gap-3 justify-center">
            <span className="text-[12px] font-bold uppercase tracking-wide opacity-90">Para talleres e instructores</span>
            <h2 className="m-0 font-display text-[28px] lg:text-[34px] leading-tight font-bold">Enseña en HETNA y gana</h2>
            <p className="m-0 text-[15px] text-white/90 leading-relaxed">
              Publicar es gratis. Si lo ofreces gratis ganas alumnos y clientes para tu taller; si lo cobras, cada venta
              llega a tu saldo.
            </p>
            <LocalizedClientLink href="/talleres/unete" className="self-start mt-2 bg-white text-[#B34D07] hover:bg-[#FDEEE1] font-semibold px-5 py-3 rounded-[10px] text-[14.5px]">
              Quiero publicar un curso
            </LocalizedClientLink>
          </div>
          <ol className="m-0 p-6 lg:p-10 list-none flex flex-col gap-4">
            {PASOS_TALLER.map((t, i) => (
              <li key={t} className="flex gap-3 items-start text-[14.5px] text-[#1B1B18] leading-relaxed">
                <span className="w-7 h-7 shrink-0 rounded-full bg-[#FDEEE1] text-[#C2560A] text-[13px] font-bold flex items-center justify-center">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </section>

        <LocalizedClientLink
          href="/foro-cnc"
          className="group bg-white border border-[#E7E4DC] hover:border-[#C2560A] rounded-[16px] p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
        >
          <div className="flex gap-4 items-start">
            <span className="w-12 h-12 rounded-[12px] bg-[#FDEEE1] text-[#C2560A] flex items-center justify-center shrink-0">
              <ServicioIcono nombre="aprender" size={26} />
            </span>
            <div>
              <h2 className="font-display text-[20px] font-bold m-0 text-[#1B1B18]">¿Una duda? Foro CNC México</h2>
              <p className="m-0 mt-1 text-[14.5px] text-[#6B6A63] leading-relaxed max-w-[620px]">
                Pregunta a talleres y profesionales, comparte tus trabajos y videos. Gratis.
              </p>
            </div>
          </div>
          <span className="shrink-0 self-start sm:self-auto bg-[#C2560A] group-hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[14.5px]">
            Entrar al foro
          </span>
        </LocalizedClientLink>

        {articulos && articulos.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-[22px] font-bold m-0 text-[#1B1B18]">Guías gratis</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {articulos.map((a) => (
                <ArticuloAprendizajeCard key={a.id} a={a} />
              ))}
            </div>
          </section>
        )}

        <FranjaAyuda />
      </div>
    </main>
  )
}
