import type { Metadata } from "next"
import Image from "next/image"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { PREGUNTAS_FABRICACION } from "@/components/hetna/servicios/ServicioCategoria"
import { TarjetaTrabajo } from "@/components/hetna/trabajos/TarjetaTrabajo"
import { NECESIDADES } from "@/lib/fabricacion/opciones"
import { listarTalleres, ubicacion } from "@/lib/hetna/talleres"
import { trabajosAbiertos } from "@/lib/trabajos/datos"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Fabricación CNC en México: solicita tu trabajo y cotiza con talleres",
  description:
    "Corte, grabado, maquila, diseño CAD, prototipos y producción por volumen con talleres CNC de todo México. Sube tu archivo o descríbelo y recibe cotizaciones. Pago seguro y envíos a todo el país.",
}

// La página para quien quiere que le FABRIQUEN algo. Ordenada como piensa el
// cliente: qué necesita (no cómo se llama el proceso), cómo se pide, qué tiene
// que mandar, cuánto tarda y qué pasa después. Todo botón lleva al mismo
// formulario (/cotizar), ya con la necesidad o el proceso elegidos, o a la
// calculadora cuando el precio sale de las medidas.
//
// Los tiempos son rangos típicos que HETNA pidió publicar; el plazo real lo
// pone cada taller en su propuesta, y la página lo dice.

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
const ligaWhatsapp = (texto: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`
const pedir = (necesidad?: string, servicio?: string) => {
  const q = new URLSearchParams()
  if (necesidad) q.set("necesidad", necesidad)
  if (servicio) q.set("servicio", servicio)
  const s = q.toString()
  return `/cotizar${s ? `?${s}` : ""}`
}

type Servicio = {
  titulo: string
  que: string
  para: string
  incluye: string
  necesitas: string
  tiempo: string
  necesidad: string
  servicio?: string
  calculadora?: { href: string; texto: string }
}

const SERVICIOS: Servicio[] = [
  {
    titulo: "Corte CNC",
    que: "Cortamos tus piezas a la medida en láser, router o plasma, según el material y el grosor.",
    para: "Carpinterías, herrerías, marcas, arquitectos y quien tenga un diseño listo.",
    incluye: "Revisión del archivo, el corte y la entrega o el envío.",
    necesitas: "Archivo DXF, SVG o AI (o medidas claras), material, grosor y cantidad.",
    tiempo: "3 a 7 días por lote",
    necesidad: "Cortar piezas",
    servicio: "Corte CNC",
    calculadora: { href: "/cotizar/corte-laser", texto: "Precio al instante" },
  },
  {
    titulo: "Grabado CNC",
    que: "Grabado láser o fresado de logotipos, textos, números de serie y decoraciones.",
    para: "Negocios, regalos corporativos, señalética e identificación de piezas.",
    incluye: "Ajuste del diseño al material y el grabado.",
    necesitas: "Tu logo o texto (vector de preferencia), material y medidas del área a grabar.",
    tiempo: "2 a 5 días",
    necesidad: "Grabar o marcar",
    servicio: "Grabado",
  },
  {
    titulo: "Maquila de piezas",
    que: "Un taller fabrica tus piezas con tu diseño, para que tú vendas o armes.",
    para: "Marcas y fabricantes que no tienen máquina o ya no les alcanza la suya.",
    incluye: "Fabricación, control de medidas y entrega por lote.",
    necesitas: "Plano o muestra, material, tolerancias y volumen aproximado.",
    tiempo: "Según volumen",
    necesidad: "Producción por volumen",
    servicio: "Maquinado",
  },
  {
    titulo: "Diseño industrial y CAD",
    que: "De tu idea, foto o boceto a un archivo listo para fabricar (2D o 3D).",
    para: "Quien no tiene plano, o tiene uno que no sirve para máquina.",
    incluye: "Modelado o vectorizado, archivo de fabricación y ajustes contigo.",
    necesitas: "Una descripción con medidas, para qué sirve y fotos o bocetos si tienes.",
    tiempo: "2 a 5 días",
    necesidad: "Diseño",
    servicio: "Diseño CAD/CAM",
  },
  {
    titulo: "Prototipado rápido",
    que: "Una o pocas piezas para probar forma, tamaño o funcionamiento antes de producir.",
    para: "Emprendedores, ingenieros y estudiantes que validan una idea.",
    incluye: "Fabricación en impresión 3D, láser o maquinado, lo que convenga más.",
    necesitas: "Archivo STL/STEP o boceto con medidas, y qué tiene que aguantar la pieza.",
    tiempo: "2 a 5 días",
    necesidad: "Prototipo",
    servicio: "Impresión 3D",
    calculadora: { href: "/cotizar/impresion-3d", texto: "Precio 3D al instante" },
  },
  {
    titulo: "Producción por volumen",
    que: "Cientos o miles de piezas, o pedidos que se repiten cada mes.",
    para: "Empresas con demanda constante que necesitan un proveedor confiable.",
    incluye: "Precio por volumen, calendario de entregas y el mismo resultado en cada lote.",
    necesitas: "Plano, material, volumen por pedido y frecuencia.",
    tiempo: "Según el proyecto",
    necesidad: "Producción por volumen",
  },
  {
    titulo: "Piezas personalizadas",
    que: "Una pieza hecha para ti: refacciones, regalos, letreros, muebles, accesorios.",
    para: "Particulares y negocios que buscan algo que no venden hecho.",
    incluye: "Te ayudan a definir material y medidas, fabrican y te la mandan.",
    necesitas: "Una foto o referencia y las medidas aproximadas.",
    tiempo: "5 a 10 días con acabado",
    necesidad: "Pieza terminada",
  },
  {
    titulo: "Acabados y ensamble",
    que: "Que la pieza llegue lista para usar: lijada, pintada, anodizada o armada.",
    para: "Quien no quiere terminar las piezas por su cuenta.",
    incluye: "El acabado que elijas y, si hace falta, el armado de varias partes.",
    necesitas: "Qué acabado quieres (o pide que te recomienden) y cómo se arma.",
    tiempo: "5 a 10 días",
    necesidad: "Pieza terminada",
  },
]

// Las máquinas que hay en la red, para quien sí sabe qué proceso quiere.
const PROCESOS = [
  { titulo: "Corte y grabado láser", detalle: "MDF, madera, acrílico, cuero", calculadora: "/cotizar/corte-laser", servicio: "Corte láser", categoria: "corte-laser" },
  { titulo: "Router CNC", detalle: "Tableros grandes, madera sólida, aluminio", calculadora: "/cotizar/router-cnc", servicio: "Corte CNC", categoria: "router-cnc" },
  { titulo: "Corte plasma", detalle: "Lámina y placa de acero e inoxidable", calculadora: "/cotizar/corte-plasma", servicio: "Corte plasma", categoria: "corte-plasma" },
  { titulo: "Impresión 3D", detalle: "PLA, PETG, ABS, TPU, resina", calculadora: "/cotizar/impresion-3d", servicio: "Impresión 3D", categoria: "impresion-3d" },
  { titulo: "Fresado / maquinado CNC", detalle: "Piezas de metal con medida exacta", servicio: "Maquinado", categoria: "maquinado-cnc" },
  { titulo: "Torno CNC", detalle: "Ejes, bujes, roscas, poleas", servicio: "Maquinado", categoria: "torneado-cnc" },
  { titulo: "Maquinado 4 y 5 ejes", detalle: "Moldes y piezas complejas", servicio: "Maquinado", categoria: "maquinado-4-y-5-ejes" },
  { titulo: "Fresado de madera", detalle: "Tallado, relieves, muebles", servicio: "Fresado de madera", categoria: "router-cnc" },
]

const MATERIALES = [
  { nombre: "MDF", ideal: "Letreros, cajas, maquetas, muebles para pintar" },
  { nombre: "Triplay y madera sólida", ideal: "Muebles, celosías, decoración, piezas a la vista" },
  { nombre: "Acrílico", ideal: "Exhibidores, señalética, protecciones, displays con luz" },
  { nombre: "Acero y acero inoxidable", ideal: "Soportes, bases, herrería, piezas que cargan peso" },
  { nombre: "Aluminio", ideal: "Placas, carcasas, piezas ligeras de máquina, letreros de exterior" },
  { nombre: "Plásticos de ingeniería", ideal: "Nylon y delrin: bujes, engranes, piezas que se deslizan" },
  { nombre: "Filamentos 3D", ideal: "PLA para prototipos, PETG y ABS para piezas funcionales, TPU flexible" },
  { nombre: "Cuero, tela y foamboard", ideal: "Accesorios, empaques, maquetas y marcos" },
]

const TIEMPOS = [
  { que: "Prototipo simple", rango: "2 a 5 días" },
  { que: "Corte por lote", rango: "3 a 7 días" },
  { que: "Pieza con acabado", rango: "5 a 10 días" },
  { que: "Producción por volumen", rango: "Según el proyecto" },
]

const BTN = "inline-flex items-center justify-center rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110"
const BTN2 = "inline-flex items-center justify-center rounded-xl border-2 border-[#142033] px-6 py-3 font-semibold text-[#142033] hover:bg-[#142033] hover:text-white"
const H2 = "text-2xl font-extrabold text-[#142033] sm:text-3xl"

function Llamado({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#FDEEE1] p-5 sm:p-6">
      <div className="max-w-xl">
        <p className="text-lg font-extrabold text-[#142033]">{titulo}</p>
        <p className="text-sm text-[#44433D]">{texto}</p>
      </div>
      <LocalizedClientLink href="/cotizar" className={BTN}>
        Sube tu proyecto y cotiza
      </LocalizedClientLink>
    </section>
  )
}

export default async function FabricacionPage() {
  const [{ trabajos, total }, talleresTodos] = await Promise.all([
    trabajosAbiertos({ limit: 6 }),
    listarTalleres().catch(() => []),
  ])
  const talleres = [...talleresTodos].sort((a, b) => Number(b.verificado) - Number(a.verificado))
  const verificados = talleres.filter((t) => t.verificado).length
  // Ejemplos: sólo fotos reales que subieron los talleres a su perfil, una por
  // taller para que no sea la galería de uno solo.
  const fotos = talleres
    .filter((t) => t.perfil.galeria.length)
    .slice(0, 8)
    .map((t) => ({ url: t.perfil.galeria[0], taller: t }))

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 lg:px-8">
      {/* Hero */}
      <header className="overflow-hidden rounded-3xl bg-[#142033] p-6 text-white sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Fabricación CNC</p>
        <h1 className="mt-1 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
          Solicita tu trabajo CNC en minutos
        </h1>
        <p className="mt-3 max-w-2xl text-white/80 sm:text-lg">
          Cuéntanos qué necesitas, sube tu archivo y recibe cotización de talleres capacitados en México.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LocalizedClientLink href="/cotizar" className={BTN}>
            Solicitar cotización
          </LocalizedClientLink>
          <a href="#como-funciona" className="inline-flex items-center rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10">
            Ver cómo funciona
          </a>
        </div>
        <p className="mt-6 text-sm font-semibold text-white/90">¿Qué necesitas?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {NECESIDADES.map((n) => (
            <LocalizedClientLink
              key={n.valor}
              href={pedir(n.valor)}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"
            >
              {n.valor === "Diseño" ? "Diseñar algo antes" : n.valor}
            </LocalizedClientLink>
          ))}
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
          <li>✓ Gratis y sin compromiso</li>
          <li>✓ Con archivo o sin archivo</li>
          <li>✓ Pago seguro dentro de HETNA</li>
          <li>✓ Envíos a todo México</li>
        </ul>
      </header>

      {/* Servicios por necesidad */}
      <section id="servicios" className="mt-12 scroll-mt-24">
        <h2 className={H2}>Servicios</h2>
        <p className="mt-1 max-w-2xl text-[#6B675C]">
          Elige lo que quieres lograr. No tienes que saber qué máquina se usa: el taller te lo propone.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICIOS.map((s) => (
            <article key={s.titulo} className="flex flex-col rounded-2xl border border-[#E7E4DC] bg-white p-5">
              <h3 className="text-lg font-extrabold text-[#142033]">{s.titulo}</h3>
              <p className="mt-1 text-sm text-[#2B2A26]">{s.que}</p>
              <dl className="mt-3 grid gap-2 text-[13px]">
                <div>
                  <dt className="font-bold text-[#44433D]">Para quién</dt>
                  <dd className="text-[#6B675C]">{s.para}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[#44433D]">Qué incluye</dt>
                  <dd className="text-[#6B675C]">{s.incluye}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[#44433D]">Qué necesitas</dt>
                  <dd className="text-[#6B675C]">{s.necesitas}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[#44433D]">Tiempo típico</dt>
                  <dd className="font-semibold text-[#C2560A]">{s.tiempo}</dd>
                </div>
              </dl>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
                <LocalizedClientLink
                  href={pedir(s.necesidad, s.servicio)}
                  className="rounded-xl bg-[#C2560A] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  Cotizar
                </LocalizedClientLink>
                {s.calculadora && (
                  <LocalizedClientLink href={s.calculadora.href} className="text-sm font-semibold text-[#142033] hover:text-[#C2560A]">
                    {s.calculadora.texto} →
                  </LocalizedClientLink>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <Llamado
        titulo="¿Ya sabes lo que necesitas?"
        texto="Sube tu archivo o descríbelo. Los talleres que hacen ese trabajo te mandan precio y tiempo de entrega."
      />

      {/* Cómo funciona */}
      <section id="como-funciona" className="mt-12 scroll-mt-24">
        <h2 className={H2}>Cómo funciona</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Cuéntanos qué necesitas", "Elige si quieres cortar, grabar, una pieza terminada, un diseño o producción."],
            ["Sube tu archivo o describe la pieza", "DXF, STL, STEP, fotos o un boceto. Si no tienes nada, descríbelo con medidas."],
            ["Recibe cotización de talleres", "Los talleres que hacen ese trabajo te mandan precio y tiempo durante 7 días. Tú comparas."],
            ["Aprueba, produce y recibe", "Eliges, pagas dentro de HETNA, el taller fabrica y te lo envía o lo recoges."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFF1E6] font-extrabold text-[#C2560A]">{i + 1}</span>
              <span>
                <span className="block font-bold text-[#142033]">{t}</span>
                <span className="text-sm text-[#6B675C]">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
            <p className="font-extrabold text-[#142033]">📁 Si ya tienes archivo</p>
            <p className="mt-1 text-sm text-[#44433D]">
              Súbelo en el formulario (DXF, DWG, SVG, AI, PDF, STL, STEP…). El taller lo revisa antes de cotizar
              y, si le falta algo (cotas, grosor, escala), te escribimos para aclararlo.
            </p>
            <LocalizedClientLink href={pedir(undefined)} className="mt-3 inline-block text-sm font-semibold text-[#C2560A]">
              Subir mi archivo →
            </LocalizedClientLink>
          </div>
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
            <p className="font-extrabold text-[#142033]">✏️ Si no tienes archivo</p>
            <p className="mt-1 text-sm text-[#44433D]">
              Elige &ldquo;No tengo archivo, necesito diseño&rdquo;, &ldquo;Tengo boceto o foto&rdquo; o &ldquo;Tengo idea o
              referencia&rdquo;. Los talleres que también diseñan te cotizan el diseño junto con la fabricación.
            </p>
            <LocalizedClientLink href={pedir("Diseño")} className="mt-3 inline-block text-sm font-semibold text-[#C2560A]">
              Pedir ayuda con el diseño →
            </LocalizedClientLink>
          </div>
        </div>
      </section>

      {/* Qué puedes fabricar */}
      <section className="mt-12">
        <h2 className={H2}>Qué puedes fabricar</h2>
        <p className="mt-1 max-w-2xl text-[#6B675C]">
          Las máquinas de la red. En las que dicen &ldquo;precio al instante&rdquo; ves un estimado con sólo poner las medidas.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESOS.map((p) => (
            <div key={p.titulo} className="flex flex-col rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <p className="font-bold text-[#142033]">{p.titulo}</p>
              <p className="text-sm text-[#6B675C]">{p.detalle}</p>
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-3 text-sm font-semibold">
                {p.calculadora ? (
                  <LocalizedClientLink href={p.calculadora} className="text-[#1F5A2B] hover:underline">
                    Precio al instante
                  </LocalizedClientLink>
                ) : (
                  <LocalizedClientLink href={pedir(undefined, p.servicio)} className="text-[#C2560A] hover:underline">
                    Pedir propuestas
                  </LocalizedClientLink>
                )}
                <LocalizedClientLink href={`/categories/${p.categoria}`} className="text-[#142033] hover:text-[#C2560A]">
                  Ver talleres
                </LocalizedClientLink>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Materiales */}
      <section className="mt-12">
        <h2 className={H2}>Materiales</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MATERIALES.map((m) => (
            <div key={m.nombre} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <p className="font-bold text-[#142033]">{m.nombre}</p>
              <p className="mt-1 text-sm text-[#6B675C]">
                <span className="font-semibold text-[#44433D]">Ideal para:</span> {m.ideal}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Ejemplos */}
      {(fotos.length > 0 || trabajos.length > 0) && (
        <section className="mt-12">
          <h2 className={H2}>Ejemplos</h2>
          {fotos.length > 0 && (
            <>
              <p className="mt-1 text-[#6B675C]">Trabajos de talleres de la red, tal como los publicaron en su perfil.</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {fotos.map((f) => (
                  <LocalizedClientLink
                    key={f.url}
                    href={`/talleres/${f.taller.handle}`}
                    className="group block overflow-hidden rounded-2xl border border-[#E7E4DC] bg-white"
                  >
                    <span className="block aspect-square overflow-hidden bg-[#F3F1EA]">
                      <Image
                        src={f.url}
                        alt={`Trabajo de ${f.taller.nombre}`}
                        width={320}
                        height={320}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </span>
                    <span className="block truncate px-3 py-2 text-xs font-semibold text-[#142033]">
                      {f.taller.nombre} · {ubicacion(f.taller.perfil) || "México"}
                    </span>
                  </LocalizedClientLink>
                ))}
              </div>
            </>
          )}
          {trabajos.length > 0 && (
            <>
              <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-extrabold text-[#142033]">Lo que otros clientes están cotizando ahora</h3>
                <LocalizedClientLink href="/trabajos" className="text-sm font-semibold text-[#C2560A]">
                  Ver los {total} →
                </LocalizedClientLink>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trabajos.map((t) => (
                  <TarjetaTrabajo key={t.folio} trabajo={t} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <Llamado
        titulo="¿Tienes algo parecido en mente?"
        texto="Mándanos una foto o referencia. No necesitas tener el plano: lo describes y te cotizan."
      />

      {/* Tiempos y cobertura */}
      <section className="mt-12 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
          <h2 className="text-xl font-extrabold text-[#142033]">Tiempos típicos</h2>
          <dl className="mt-3 divide-y divide-[#E7E4DC]">
            {TIEMPOS.map((t) => (
              <div key={t.que} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[#2B2A26]">{t.que}</dt>
                <dd className="font-bold text-[#C2560A]">{t.rango}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-[#6B675C]">
            Son rangos de referencia. Cada taller confirma su tiempo de entrega en la propuesta, y ése es el que cuenta.
          </p>
        </div>
        <div className="rounded-2xl bg-[#142033] p-5 text-white sm:p-6">
          <h2 className="text-xl font-extrabold">Cobertura</h2>
          <p className="mt-2 text-sm text-white/80">
            Talleres en distintos estados de México y envíos por paquetería a todo el país. Cuando pides propuestas,
            los talleres de tu estado reciben el aviso primero, para que el flete salga más barato.
          </p>
          <LocalizedClientLink href="/talleres" className="mt-4 inline-block text-sm font-semibold text-[#F2A25F]">
            Ver talleres por estado →
          </LocalizedClientLink>
        </div>
      </section>

      {/* Confianza */}
      <section className="mt-12">
        <h2 className={H2}>Por qué cotizar con HETNA</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [
              "Talleres verificados",
              verificados > 0
                ? `${verificados} ${verificados === 1 ? "taller verificado" : "talleres verificados"} con identificación y fotos de su taller.`
                : "HETNA verifica a los talleres con identificación y fotos del taller.",
            ],
            ["Atención por WhatsApp", "Si a un taller le falta un dato o tienes una duda, te contestamos por WhatsApp."],
            ["Seguimiento con folio", "Cada solicitud tiene folio y una liga privada para ver propuestas y el estado de tu pedido."],
            ["Envíos a todo México", "Cada propuesta dice si incluye el envío. También puedes recoger."],
            ["Revisión de archivos", "El taller revisa tu archivo antes de cotizar; si hay que corregir algo, te avisamos."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <p className="font-bold text-[#142033]">✓ {t}</p>
              <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
            </div>
          ))}
        </div>
        {talleres.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {talleres.slice(0, 6).map((t) => (
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
        )}
      </section>

      {/* Preguntas frecuentes */}
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

      {/* CTA final */}
      <section className="mt-10 rounded-3xl bg-[#142033] p-6 text-center text-white sm:p-10">
        <h2 className="text-2xl font-extrabold sm:text-3xl">Sube tu proyecto y cotiza</h2>
        <p className="mx-auto mt-2 max-w-xl text-white/80">
          Es gratis. Recibes propuestas de talleres, comparas precio y tiempo, y sólo pagas si eliges una.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <LocalizedClientLink href="/cotizar" className={BTN}>
            Solicitar cotización
          </LocalizedClientLink>
          <a
            href={ligaWhatsapp("Hola, quiero cotizar un trabajo de fabricación CNC")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10"
          >
            Preguntar por WhatsApp
          </a>
        </div>
      </section>

      {/* Para talleres */}
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
          <LocalizedClientLink href="/trabajos" className={BTN2.replace("px-6 py-3", "px-4 py-2 text-sm")}>
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
