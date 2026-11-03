// /servicios/aprendizaje-cnc: la Academia HETNA, estilo Udemy/Domestika.
// Los talleres suben sus cursos (gratis o de pago) desde su panel; HETNA cobra
// una comisión (10%, ver Términos para vendedores) sólo cuando se vende uno. Los videos viven en el YouTube (oculto) o
// Vimeo del taller, así que la Academia no le cuesta nada a HETNA.
import Image from "next/image"
import type { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Course } from "@/lib/data/courses"
import { getProductPrice } from "@/lib/helpers/get-product-price"
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
  "Graba tus clases (YouTube oculto o Vimeo) o prepara tu libro en PDF.",
  "En tu panel de taller entra a Cursos o a Libros y PDF y llena la ficha.",
  "Elige si es gratis o pon tu precio. HETNA lo promociona en la tienda, Facebook e Instagram.",
  "Cobras cada venta en tu saldo. HETNA sólo se queda con el 10%.",
]

const QUE_PUBLICAR = [
  { icono: "aprender", t: "Cursos en video", d: "Router, láser, plasma, torno, Fusion 360, G-code. Con temario, lecciones de muestra y alumnos inscritos.", href: "/seller/courses", boton: "Publicar un curso" },
  { icono: "cotizador", t: "Libros y PDF", d: "Manuales de tu máquina, guías de parámetros, libros de diseño o plantillas. Entrega automática al comprador.", href: "/seller/libros", boton: "Publicar un libro" },
  { icono: "ia", t: "Guías gratis", d: "Un curso o un PDF gratis te trae alumnos que después te compran o te mandan trabajos.", href: "/seller/libros", boton: "Regalar una guía" },
]

const BENEFICIOS = [
  ["90%", "de cada venta es para ti"],
  ["$0", "por publicar, sin mensualidad"],
  ["24/7", "vendes mientras trabajas"],
  ["Toda", "la comunidad CNC de México"],
]

type Producto = HttpTypes.StoreProduct

const TarjetaLibro = ({ p }: { p: Producto }) => {
  const meta = (p.metadata || {}) as Record<string, unknown>
  const gratis = meta.archivo_gratis === true
  const precio = gratis ? null : getProductPrice({ product: p }).cheapestPrice?.calculated_price
  return (
    <LocalizedClientLink href={`/products/${p.handle}`} className="group flex flex-col gap-2">
      <span className="relative block aspect-[3/4] overflow-hidden rounded-[10px] border border-[#E7E4DC] bg-[#F3F1EA] shadow-[0_10px_24px_-14px_rgba(20,32,51,0.5)] transition group-hover:-translate-y-1">
        {p.thumbnail ? (
          <Image src={p.thumbnail} alt={p.title} fill sizes="(min-width: 1024px) 200px, 45vw" className="object-cover" />
        ) : (
          <span className="grid h-full place-items-center text-[13px] font-bold text-[#6B6A63]">PDF</span>
        )}
        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${gratis ? "bg-[#19B374] text-white" : "bg-[#142033] text-white"}`}>
          {gratis ? "Gratis" : "PDF"}
        </span>
      </span>
      <span className="line-clamp-2 text-[14px] font-bold leading-snug text-[#1B1B18] group-hover:text-[#B34D07]">{p.title}</span>
      {p.subtitle && <span className="line-clamp-1 text-[12.5px] text-[#6B6A63]">{p.subtitle}</span>}
      <span className="text-[14px] font-extrabold text-[#1B1B18]">{gratis ? "Descarga gratis" : precio || ""}</span>
    </LocalizedClientLink>
  )
}

export function Academia({ cursos, articulos, libros = [] }: { cursos: Course[]; articulos?: LearningArticle[]; libros?: Producto[] }) {
  const gratis =
    cursos.filter((c) => !c.precio || c.precio.gratis).length +
    libros.filter((l) => (l.metadata as Record<string, unknown> | null)?.archivo_gratis === true).length

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
        <div
          className="relative overflow-hidden rounded-[22px] bg-[#0D1015] text-white"
          style={{
            backgroundImage:
              "radial-gradient(circle at 10% 0%, rgba(240,122,26,0.22), transparent 45%), radial-gradient(circle at 95% 100%, rgba(255,197,61,0.14), transparent 40%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "100% 100%, 100% 100%, 22px 22px",
          }}
        >
          <div className="relative grid gap-8 p-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:p-12">
            <div className="flex flex-col gap-4">
              <span className="self-start rounded-full bg-[#F07A1A]/20 px-3 py-1 text-[12px] font-extrabold uppercase tracking-wide text-[#F59A4A]">
                Academia HETNA · cursos y libros CNC
              </span>
              <h1 className="m-0 font-display text-[32px] font-extrabold leading-[1.05] lg:text-[52px]">
                Aprende CNC con los talleres que lo hacen todos los días
              </h1>
              <p className="m-0 max-w-[640px] text-[16px] leading-relaxed text-white/70 lg:text-[17px]">
                Cursos en video y libros en PDF de router, láser, plasma, torno, Fusion 360 y G-code. En español, prácticos y
                muchos gratis.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <a href="#cursos" className="rounded-[12px] bg-[#F07A1A] px-6 py-3.5 text-[15px] font-extrabold text-white hover:brightness-110">
                  Ver cursos
                </a>
                <a href="#libros" className="rounded-[12px] border border-white/25 px-6 py-3.5 text-[15px] font-bold text-white hover:bg-white/10">
                  Libros y PDF
                </a>
              </div>
              {cursos.length + libros.length > 0 && (
                <dl className="m-0 grid max-w-[520px] grid-cols-3 gap-3 pt-3">
                  {[
                    [cursos.length, cursos.length === 1 ? "curso" : "cursos"],
                    [libros.length, libros.length === 1 ? "libro" : "libros"],
                    [gratis, "gratis"],
                  ].map(([n, t]) => (
                    <div key={String(t)} className="rounded-[12px] border border-white/10 bg-white/[0.05] px-3 py-2">
                      <dt className="sr-only">{t}</dt>
                      <dd className="m-0 text-[22px] font-extrabold leading-none">{n}</dd>
                      <span className="text-[12px] text-white/60">{t}</span>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <a
              href="#ensena"
              className="group relative flex flex-col justify-between gap-4 overflow-hidden rounded-[18px] bg-gradient-to-br from-[#F07A1A] to-[#C2410C] p-6 shadow-2xl transition hover:-translate-y-1"
            >
              <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
              <span className="relative">
                <span className="text-[12px] font-extrabold uppercase tracking-wide text-white/85">¿Tienes un taller o sabes enseñar?</span>
                <span className="mt-2 block font-display text-[26px] font-extrabold leading-tight lg:text-[30px]">
                  Gana dinero con lo que sabes
                </span>
                <span className="mt-2 block text-[14.5px] leading-relaxed text-white/90">
                  Publica tus cursos y tus libros en PDF gratis. Te quedas con el 90% de cada venta y te promocionamos en toda la
                  comunidad CNC.
                </span>
              </span>
              <span className="relative grid grid-cols-2 gap-2">
                {BENEFICIOS.slice(0, 2).map(([n, t]) => (
                  <span key={t} className="rounded-[12px] bg-black/15 px-3 py-2">
                    <span className="block text-[22px] font-extrabold leading-none">{n}</span>
                    <span className="text-[12px] text-white/85">{t}</span>
                  </span>
                ))}
              </span>
              <span className="relative self-start rounded-[10px] bg-white px-5 py-3 text-[14.5px] font-extrabold text-[#C2410C] group-hover:bg-[#FFF3E8]">
                Quiero enseñar en HETNA →
              </span>
            </a>
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

        <section id="libros" className="flex flex-col gap-4 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">Libros, manuales y guías en PDF</h2>
              <p className="m-0 mt-1 text-[14.5px] text-[#6B6A63]">Descárgalos al momento y quedan guardados en tu cuenta.</p>
            </div>
            <a href="/seller/libros" className="text-[14px] font-semibold text-[#B34D07] hover:underline">
              Publicar mi libro →
            </a>
          </div>
          {libros.length ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
              {libros.map((p) => (
                <TarjetaLibro key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col justify-between gap-4 rounded-[16px] border border-dashed border-[#C2560A]/50 bg-[#FFF8F1] p-6 sm:flex-row sm:items-center">
              <div>
                <h3 className="m-0 font-display text-[19px] font-bold text-[#1B1B18]">Sé el primero en publicar un libro</h3>
                <p className="m-0 mt-1 max-w-[560px] text-[14.5px] text-[#6B6A63]">
                  ¿Tienes un manual, una guía de parámetros o un libro de diseño CNC? Véndelo aquí o regálalo para atraer clientes.
                </p>
              </div>
              <a href="/seller/libros" className="shrink-0 self-start rounded-[10px] bg-[#C2560A] px-5 py-3 text-[14.5px] font-semibold text-white hover:bg-[#A84A08] sm:self-auto">
                Publicar mi libro
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

        <section id="ensena" className="scroll-mt-24 overflow-hidden rounded-[22px] bg-[#142033] text-white">
          <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:p-10">
            <div>
              <span className="text-[12px] font-extrabold uppercase tracking-wide text-[#FFC53D]">Para talleres e instructores</span>
              <h2 className="m-0 mt-2 font-display text-[30px] font-extrabold leading-tight lg:text-[40px]">Enseña en HETNA y gana</h2>
              <p className="m-0 mt-3 max-w-[560px] text-[15.5px] leading-relaxed text-white/75">
                Lo que sabes de CNC vale. Convierte tu experiencia en cursos y libros que se venden solos, y gana alumnos que
                después se vuelven clientes de tu taller.
              </p>
              <dl className="m-0 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {BENEFICIOS.map(([n, t]) => (
                  <div key={t} className="rounded-[12px] border border-white/10 bg-white/[0.05] px-3 py-2.5">
                    <dt className="text-[22px] font-extrabold leading-none text-[#FFC53D]">{n}</dt>
                    <dd className="m-0 mt-1 text-[12px] leading-snug text-white/70">{t}</dd>
                  </div>
                ))}
              </dl>
              <ol className="m-0 mt-7 flex list-none flex-col gap-3 p-0">
                {PASOS_TALLER.map((t, i) => (
                  <li key={t} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-white/90">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F07A1A] text-[13px] font-bold">{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col gap-3">
              {QUE_PUBLICAR.map((q) => (
                <a key={q.t} href={q.href} className="group flex gap-4 rounded-[16px] bg-white p-5 text-[#1B1B18] transition hover:-translate-y-0.5">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-[#FDEEE1] text-[#C2560A]">
                    <ServicioIcono nombre={q.icono} size={26} />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[17px] font-bold">{q.t}</span>
                    <span className="mt-1 text-[13.5px] leading-relaxed text-[#4A4943]">{q.d}</span>
                    <span className="mt-2 text-[13.5px] font-bold text-[#C2560A] group-hover:underline">{q.boton} →</span>
                  </span>
                </a>
              ))}
              <p className="m-0 text-[13px] text-white/60">
                ¿Todavía no tienes cuenta de taller?{" "}
                <LocalizedClientLink href="/talleres/unete" className="font-semibold text-[#FFC53D] hover:underline">
                  Regístrate gratis
                </LocalizedClientLink>{" "}
                y en minutos publicas.
              </p>
            </div>
          </div>
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
