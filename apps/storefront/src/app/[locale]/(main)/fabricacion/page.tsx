import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { PREGUNTAS_FABRICACION } from "@/components/hetna/servicios/ServicioCategoria"
import { TarjetaTrabajo } from "@/components/hetna/trabajos/TarjetaTrabajo"
import { listarTalleres, ubicacion } from "@/lib/hetna/talleres"
import { trabajosAbiertos } from "@/lib/trabajos/datos"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Fabricación CNC en México: cotiza tu pieza con talleres",
  description:
    "Corte láser, plasma, router, maquinado, torno, impresión 3D y diseño con talleres CNC de todo México. Precio al instante o propuestas de talleres, y pago dentro de HETNA.",
}

// La página para quien quiere que le FABRIQUEN algo. Junta lo que antes
// estaba regado en cuatro lugares (la categoría Servicios, /cotizar, las
// calculadoras y el tablero de trabajos) y le habla al cliente en sus
// palabras: qué quiere hacer, no cómo se llama el proceso por dentro.
//
// Cada proceso tiene un solo botón, "Cotizar", que hace lo correcto sin que el
// cliente tenga que saberlo: si el precio sale de las medidas (láser, router,
// plasma, impresión 3D) abre la calculadora; si depende de tolerancias y
// montajes (maquinado, torno, 5 ejes) abre el formulario y los talleres
// mandan propuestas. La palabra "licitación" no aparece.

type Proceso = {
  titulo: string
  icono: string
  sirve: string
  materiales: string
  ejemplo: string
  // Si existe, "Cotizar" abre la calculadora; si no, el formulario de propuestas.
  calculadora?: string
  servicio: string
  categoria: string
}

const PROCESOS: Proceso[] = [
  {
    titulo: "Corte y grabado láser",
    icono: "🔦",
    sirve: "Cortes finos y grabados en materiales delgados.",
    materiales: "MDF, madera, acrílico, cuero, tela",
    ejemplo: "Letreros, cajas, invitaciones, llaveros, piezas de maqueta",
    calculadora: "/cotizar/corte-laser",
    servicio: "Corte láser",
    categoria: "corte-laser",
  },
  {
    titulo: "Router CNC",
    icono: "🪚",
    sirve: "Cortar y tallar tableros grandes y gruesos.",
    materiales: "MDF, triplay, madera sólida, acrílico, aluminio",
    ejemplo: "Muebles, celosías, letreros 3D, moldes, piezas de exhibidor",
    calculadora: "/cotizar/router-cnc",
    servicio: "Corte CNC",
    categoria: "router-cnc",
  },
  {
    titulo: "Corte plasma",
    icono: "🔥",
    sirve: "Cortar lámina y placa de metal rápido y a buen precio.",
    materiales: "Acero, acero inoxidable, aluminio",
    ejemplo: "Bases, soportes, rejas, letreros de metal, piezas de herrería",
    calculadora: "/cotizar/corte-plasma",
    servicio: "Corte plasma",
    categoria: "corte-plasma",
  },
  {
    titulo: "Impresión 3D",
    icono: "🧊",
    sirve: "Prototipos y piezas plásticas sin molde, desde una pieza.",
    materiales: "PLA, PETG, ABS, TPU flexible, resina",
    ejemplo: "Prototipos, carcasas, refacciones, maquetas, figuras",
    calculadora: "/cotizar/impresion-3d",
    servicio: "Impresión 3D",
    categoria: "impresion-3d",
  },
  {
    titulo: "Maquinado CNC (fresado)",
    icono: "⚙️",
    sirve: "Piezas de metal o plástico con medidas exactas.",
    materiales: "Aluminio, acero, latón, nylon, delrin",
    ejemplo: "Refacciones, placas, bridas, moldes, piezas de máquina",
    servicio: "Maquinado",
    categoria: "maquinado-cnc",
  },
  {
    titulo: "Torno CNC",
    icono: "🔩",
    sirve: "Piezas redondas: ejes, bujes, roscas.",
    materiales: "Acero, aluminio, latón, nylon",
    ejemplo: "Flechas, bujes, pernos, poleas, adaptadores",
    servicio: "Maquinado",
    categoria: "torneado-cnc",
  },
  {
    titulo: "Maquinado 4 y 5 ejes",
    icono: "🌀",
    sirve: "Piezas complejas que no salen en una sola cara.",
    materiales: "Aluminio, acero, madera, resinas",
    ejemplo: "Moldes, impulsores, esculturas, piezas de 5 caras",
    servicio: "Maquinado",
    categoria: "maquinado-4-y-5-ejes",
  },
  {
    titulo: "Diseño y archivos",
    icono: "✏️",
    sirve: "Si no tienes archivo: de tu idea, foto o boceto a un archivo listo para fabricar.",
    materiales: "DXF, SVG, STL, STEP, G-code",
    ejemplo: "Vectorizar un logo, modelar una pieza, programar el CAM",
    servicio: "Diseño CAD/CAM",
    categoria: "diseno-2d-3d",
  },
  {
    titulo: "Producción por lotes",
    icono: "🏭",
    sirve: "Cuando necesitas cientos o miles de piezas, o cada mes.",
    materiales: "Corte, maquinado, acabados y armado",
    ejemplo: "Maquila para tu marca, pedidos recurrentes",
    servicio: "Corte CNC",
    categoria: "maquila",
  },
]

const cotizarHref = (p: Proceso) => p.calculadora || `/cotizar?servicio=${encodeURIComponent(p.servicio)}`

export default async function FabricacionPage() {
  const [{ trabajos, total }, talleresTodos] = await Promise.all([
    trabajosAbiertos({ limit: 6 }),
    listarTalleres().catch(() => []),
  ])
  const talleres = [...talleresTodos].sort((a, b) => Number(b.verificado) - Number(a.verificado)).slice(0, 6)

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 lg:px-8">
      {/* 1. Qué es, en una frase */}
      <header className="overflow-hidden rounded-3xl bg-[#142033] p-6 text-white sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Fabricación</p>
        <h1 className="mt-1 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
          Te fabricamos tu pieza
        </h1>
        <p className="mt-3 max-w-2xl text-white/80 sm:text-lg">
          Cotiza gratis con talleres CNC de todo México. Si es sencillo ves el precio al instante; si no,
          los talleres te mandan propuestas, comparas y eliges. Pagas dentro de HETNA.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#procesos" className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110">
            Cotizar mi pieza
          </a>
          <a href="#como-funciona" className="rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10">
            ¿Cómo funciona?
          </a>
        </div>
      </header>

      {/* 2. Qué necesitas hacer */}
      <section id="procesos" className="mt-10 scroll-mt-24">
        <h2 className="text-2xl font-extrabold text-[#142033]">¿Qué necesitas hacer?</h2>
        <p className="mt-1 text-[#6B675C]">
          Elige el proceso. Si no sabes cuál, no pasa nada:{" "}
          <LocalizedClientLink href="/cotizar" className="font-semibold text-[#C2560A]">
            describe tu pieza
          </LocalizedClientLink>{" "}
          y los talleres te dicen cómo hacerla.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROCESOS.map((p) => (
            <article key={p.titulo} className="flex flex-col rounded-2xl border border-[#E7E4DC] bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-extrabold text-[#142033]">
                  <span className="mr-1.5">{p.icono}</span>
                  {p.titulo}
                </h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    p.calculadora ? "bg-[#EEF6EE] text-[#1F5A2B]" : "bg-[#FFF1E6] text-[#B34D07]"
                  }`}
                >
                  {p.calculadora ? "Precio al instante" : "Propuestas de talleres"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#2B2A26]">{p.sirve}</p>
              <p className="mt-2 text-xs text-[#6B675C]">
                <strong className="text-[#44433D]">Materiales:</strong> {p.materiales}
              </p>
              <p className="mt-1 text-xs text-[#6B675C]">
                <strong className="text-[#44433D]">Por ejemplo:</strong> {p.ejemplo}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
                <LocalizedClientLink
                  href={cotizarHref(p)}
                  className="rounded-xl bg-[#C2560A] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  Cotizar
                </LocalizedClientLink>
                <LocalizedClientLink href={`/categories/${p.categoria}`} className="text-sm font-semibold text-[#142033] hover:text-[#C2560A]">
                  Ver talleres →
                </LocalizedClientLink>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 3. Cómo funciona */}
      <section id="como-funciona" className="mt-12 scroll-mt-24">
        <h2 className="text-2xl font-extrabold text-[#142033]">¿Cómo funciona?</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Cotiza", "Con las medidas ves el precio al instante, o describes tu pieza y sube tu archivo si lo tienes. Es gratis."],
            ["2", "Compara", "Los talleres te mandan precio y tiempo de entrega durante 7 días. Nunca ven tu nombre ni tu teléfono."],
            ["3", "Elige y paga", "Pagas dentro de HETNA con Mercado Pago, sin tratar dinero por fuera, y el taller fabrica."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFF1E6] font-extrabold text-[#C2560A]">{n}</span>
              <span>
                <span className="block font-bold text-[#142033]">{t}</span>
                <span className="text-sm text-[#6B675C]">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. Lo que otros están cotizando */}
      {trabajos.length > 0 && (
        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-extrabold text-[#142033]">Lo que otros clientes están cotizando</h2>
            <LocalizedClientLink href="/trabajos" className="text-sm font-semibold text-[#C2560A]">
              Ver los {total} →
            </LocalizedClientLink>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trabajos.map((t) => (
              <TarjetaTrabajo key={t.folio} trabajo={t} />
            ))}
          </div>
        </section>
      )}

      {/* 5. Con quién */}
      {talleres.length > 0 && (
        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-extrabold text-[#142033]">Talleres de la red</h2>
            <LocalizedClientLink href="/talleres" className="text-sm font-semibold text-[#C2560A]">
              Ver todos →
            </LocalizedClientLink>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {talleres.map((t) => (
              <LocalizedClientLink
                key={t.id}
                href={`/talleres/${t.handle}`}
                className="flex items-center gap-3 rounded-xl border border-[#E7E4DC] bg-white p-3 transition hover:shadow-md"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#142033] text-sm font-extrabold text-white">
                  {t.nombre.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-bold text-[#142033]">{t.nombre}</span>
                    {t.verificado && <span title="Verificado por HETNA" className="text-xs font-bold text-[#1F5A2B]">✓</span>}
                  </span>
                  <span className="block truncate text-xs text-[#6B675C]">{ubicacion(t.perfil) || "México"}</span>
                </span>
              </LocalizedClientLink>
            ))}
          </div>
        </section>
      )}

      {/* 6. Preguntas frecuentes */}
      <section className="mt-12 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
        <h2 className="mb-2 text-xl font-extrabold text-[#142033]">Preguntas frecuentes</h2>
        {PREGUNTAS_FABRICACION.map((q) => (
          <details key={q.p} className="border-t border-[#E7E4DC] py-3 first:border-t-0">
            <summary className="cursor-pointer font-semibold text-[#142033]">{q.p}</summary>
            <p className="mt-2 text-sm text-[#44433D]">{q.r}</p>
          </details>
        ))}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: PREGUNTAS_FABRICACION.map((q) => ({
                "@type": "Question",
                name: q.p,
                acceptedAnswer: { "@type": "Answer", text: q.r },
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      </section>

      {/* 7. Para talleres */}
      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#FBFAF6] p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-extrabold text-[#142033]">¿Tienes taller?</h2>
          <p className="text-sm text-[#44433D]">
            {total > 0
              ? `Hay ${total === 1 ? "1 trabajo" : `${total} trabajos`} esperando precio. Regístrate gratis y manda tu propuesta.`
              : "Regístrate gratis y te avisamos de cada trabajo nuevo de tu servicio."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LocalizedClientLink href="/trabajos" className="rounded-xl border-2 border-[#C2560A] px-4 py-2 text-sm font-semibold text-[#C2560A]">
            Ver trabajos abiertos
          </LocalizedClientLink>
          <a href="/seller" className="rounded-xl bg-[#142033] px-4 py-2 text-sm font-semibold text-white">
            Registrar mi taller
          </a>
        </div>
      </section>
    </main>
  )
}
