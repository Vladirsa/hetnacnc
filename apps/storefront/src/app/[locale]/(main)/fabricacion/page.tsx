import type { Metadata } from "next"
import Image from "next/image"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { PREGUNTAS_FABRICACION } from "@/components/hetna/servicios/ServicioCategoria"
import FormSolicitudTaller from "@/components/hetna/taller/FormSolicitudTaller"
import { TarjetaTrabajo } from "@/components/hetna/trabajos/TarjetaTrabajo"
import { NECESIDADES } from "@/lib/fabricacion/opciones"
import { EMPRESA, ligaWhatsApp } from "@/lib/hetna/empresa"
import { listarTalleres, ubicacion } from "@/lib/hetna/talleres"
import { trabajosAbiertos } from "@/lib/trabajos/datos"

export const revalidate = 300

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/fabricacion" },
  title: "Fabricación CNC en México, de prototipo a producción",
  description:
    "Prototipos, piezas únicas y producción con talleres CNC de México: corte, grabado, maquinado e impresión 3D. Sube tu archivo y recibe cotizaciones.",
}

// La página para quien quiere que le FABRIQUEN algo. Ordenada como piensa el
// cliente: qué necesita (no cómo se llama el proceso), cómo se pide, qué tiene
// que mandar, cuánto tarda y qué pasa después. Todo botón lleva al mismo
// formulario (/cotizar), ya con la necesidad o el proceso elegidos, o a la
// calculadora cuando el precio sale de las medidas.
//
// Los tiempos son rangos típicos que HETNA pidió publicar; el plazo real lo
// pone cada taller en su propuesta, y la página lo dice.

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

// Lo que se puede pedir, en las palabras con que lo busca el cliente. Cada uno
// abre el formulario con la necesidad ya elegida.
const FABRICAMOS = [
  { que: "Piezas únicas", ej: "Una refacción, un regalo, una pieza que ya no venden", necesidad: "Pieza terminada" },
  { que: "Prototipos", ej: "Para probar forma y medidas antes de producir", necesidad: "Prototipo" },
  { que: "Lotes de producción", ej: "De decenas a miles de piezas iguales", necesidad: "Producción por volumen" },
  { que: "Cortes a medida", ej: "Tableros, láminas y placas cortadas a tu plano", necesidad: "Cortar piezas" },
  { que: "Grabados", ej: "Logotipos, placas, números de serie", necesidad: "Grabar o marcar" },
  { que: "Componentes personalizados", ej: "Soportes, carcasas, bridas, adaptadores", necesidad: "Pieza terminada" },
  { que: "Piezas para maquinaria", ej: "Bujes, ejes, engranes, placas de montaje", necesidad: "Pieza terminada" },
  { que: "Señalética", ej: "Letreros, letras 3D, placas de exterior", necesidad: "Cortar piezas" },
  { que: "Mobiliario", ej: "Muebles, celosías, exhibidores, stands", necesidad: "Pieza terminada" },
  { que: "Utillaje y plantillas", ej: "Escantillones, guías de taladro, jigs, moldes", necesidad: "Pieza terminada" },
  { que: "Proyectos por diseño", ej: "Tienes la idea, no el plano: te lo diseñan", necesidad: "Diseño" },
]

// Capacidades por proceso. Son REFERENCIAS típicas de la industria para que el
// cliente sepa si su pieza cabe; la tabla lo dice, y cada taller confirma las
// de su máquina en la propuesta. No se presentan como garantía de HETNA.
const CAPACIDADES = [
  { proceso: "Corte y grabado láser", tamano: "Hasta 130 × 90 cm", grosor: "MDF y madera hasta 12 mm · acrílico hasta 10 mm", tolerancia: "± 0.1 a 0.2 mm" },
  { proceso: "Router CNC", tamano: "Tablero completo 122 × 244 cm", grosor: "Hasta 50 mm en madera", tolerancia: "± 0.2 a 0.5 mm" },
  { proceso: "Corte plasma", tamano: "Hasta 150 × 300 cm", grosor: "Lámina calibre 20 a placa de 1\"", tolerancia: "± 0.5 a 1 mm" },
  { proceso: "Fresado CNC (metal)", tamano: "Según la máquina del taller", grosor: "Bloque y placa", tolerancia: "± 0.02 a 0.05 mm" },
  { proceso: "Torno CNC", tamano: "Según la máquina del taller", grosor: "Barra redonda y hexagonal", tolerancia: "± 0.02 mm" },
  { proceso: "Impresión 3D (FDM)", tamano: "Hasta 25 × 25 × 25 cm por pieza", grosor: "Pared mínima ~1 mm", tolerancia: "± 0.2 a 0.3 mm" },
]

const ACABADOS_TEXTO = [
  "Tal como sale de máquina",
  "Lijado y desbaste",
  "Pintura y barniz",
  "Pintura electrostática",
  "Anodizado y galvanizado",
  "Ensamble de varias piezas",
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
  { nombre: "Madera y triplay", ideal: "Muebles, celosías, decoración, piezas a la vista" },
  { nombre: "Acrílico", ideal: "Exhibidores, señalética, protecciones, displays con luz" },
  { nombre: "Acero y acero inoxidable", ideal: "Soportes, bases, herrería, piezas que cargan peso" },
  { nombre: "Aluminio", ideal: "Placas, carcasas, piezas ligeras de máquina, letreros de exterior" },
  { nombre: "Plásticos de ingeniería", ideal: "Nylon y delrin: bujes, engranes, piezas que se deslizan" },
  { nombre: "Filamentos 3D", ideal: "PLA para prototipos, PETG y ABS para piezas funcionales, TPU flexible" },
  { nombre: "PVC espumado (Sintra)", ideal: "Señalética interior, letras recortadas, maquetas" },
  { nombre: "Foam y foamboard", ideal: "Maquetas, empaques a la medida, moldes y rellenos" },
  { nombre: "Cuero y tela", ideal: "Accesorios, llaveros, parches y artículos promocionales" },
]

// Lo que se le puede hacer a una pieza. Es lo que el cliente busca ("¿me la
// perforan?", "¿me hacen la ranura?"), no el nombre de la máquina.
const OPERACIONES = [
  { que: "Corte", detalle: "Contornos y piezas sueltas en lámina, tablero o placa." },
  { que: "Grabado", detalle: "Logotipos, textos, números de serie y relieves." },
  { que: "Perforado", detalle: "Barrenos, avellanados y patrones de agujeros a medida." },
  { que: "Ranurado y cajeado", detalle: "Ranuras, cajas y rebajes para ensambles y herrajes." },
  { que: "Prototipado", detalle: "Una o pocas piezas para probar antes de producir." },
  { que: "Producción por volumen", detalle: "Lotes y pedidos recurrentes con el mismo resultado." },
  { que: "Acabados básicos", detalle: "Lijado, pintura, barniz y armado de piezas." },
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
  // Todos los llamados llevan al formulario de esta misma página: un clic menos.
  return (
    <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#FDEEE1] p-5 sm:p-6">
      <div className="max-w-xl">
        <p className="text-lg font-extrabold text-[#142033]">{titulo}</p>
        <p className="text-sm text-[#44433D]">{texto}</p>
      </div>
      <a href="#solicitar" className={BTN}>
        Sube tu proyecto y cotiza
      </a>
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
  // Máquinas que los talleres registraron en su perfil: capacidad real de la
  // red, no un texto de marketing.
  const maquinas = [
    ...new Set(talleres.flatMap((t) => t.perfil.maquinas.map((m) => m.nombre.trim())).filter(Boolean)),
  ].slice(0, 16)
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
          Fabricación CNC en México, de prototipo a producción
        </h1>
        <p className="mt-3 max-w-2xl text-white/80 sm:text-lg">
          Prototipos, piezas únicas y producción por volumen con talleres especializados en México.
          Cuéntanos qué necesitas, sube tu archivo y recibe cotizaciones.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#solicitar" className={BTN}>
            Solicitar cotización
          </a>
          <a href="#capacidades" className="inline-flex items-center rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10">
            Ver capacidades
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
          <li>✓ Cotizar es gratis</li>
          <li>✓ Con archivo o sin archivo</li>
          <li>✓ Talleres especializados en México</li>
          <li>✓ Pago seguro dentro de HETNA</li>
          <li>✓ Envíos a todo el país</li>
        </ul>
      </header>

      {/* Qué fabricamos */}
      <section className="mt-12">
        <h2 className={H2}>¿Qué podemos fabricar?</h2>
        <p className="mt-1 max-w-2xl text-[#6B675C]">Si está en esta lista, la red lo hace. Toca la que se parece a lo tuyo.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {FABRICAMOS.map((f) => (
            <LocalizedClientLink
              key={f.que}
              href={pedir(f.necesidad)}
              className="rounded-2xl border border-[#E7E4DC] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#C2560A] hover:shadow-md"
            >
              <span className="block font-bold text-[#142033]">{f.que}</span>
              <span className="mt-1 block text-[13px] text-[#6B675C]">{f.ej}</span>
            </LocalizedClientLink>
          ))}
          <a
            href="#solicitar"
            className="flex flex-col justify-center rounded-2xl border-2 border-dashed border-[#C2560A] bg-[#FDEEE1] p-4 text-[#B34D07]"
          >
            <span className="block font-bold">¿Otra cosa?</span>
            <span className="mt-1 block text-[13px]">Descríbela y te dicen si se puede y cuánto cuesta.</span>
          </a>
        </div>
      </section>

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
        <h2 className={H2}>Así de fácil es pedir tu fabricación</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Cuéntanos tu proyecto", "Qué quieres lograr, material, cantidad, medidas y para cuándo. Toma un par de minutos."],
            ["Sube tu archivo o referencia", "DXF, STL, STEP, fotos o un boceto. Si no tienes nada, descríbelo con medidas."],
            ["Recibe cotización", "Talleres especializados te mandan precio y tiempo de entrega. Comparas y eliges."],
            ["Se fabrica y te lo entregamos", "Pagas dentro de HETNA, el taller produce y te lo envía a cualquier parte de México."],
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

      {/* Conexión con talleres */}
      <section className="mt-12 rounded-3xl border border-[#E7E4DC] bg-white p-5 sm:p-8">
        <h2 className={H2}>Te conectamos con talleres especializados</h2>
        <p className="mt-1 max-w-3xl text-[#44433D]">
          HETNA no es un solo taller: es una <strong>red de talleres CNC en México</strong>. Tu proyecto puede ser
          atendido por cualquier taller de la red HETNA que haga ese trabajo.
        </p>
        <p className="mt-2 max-w-3xl text-[#6B675C]">
          Seleccionamos a los talleres según el tipo de proyecto, tu material y tu ubicación: primero reciben el aviso
          los que trabajan tu material y los de tu estado, para que el precio y el envío te salgan mejor. Cada uno te
          cotiza por separado y tú eliges con quién fabricar.
        </p>
        <ol className="mt-5 grid gap-3 md:grid-cols-5">
          {[
            ["Tú", "Llenas el formulario y subes tu archivo."],
            ["HETNA", "Selecciona los talleres compatibles por tipo de proyecto, material y ubicación."],
            ["Talleres", "Los compatibles la ven en su panel, descargan tu archivo y cotizan, o dicen si les falta un dato."],
            ["Tú eliges", "Comparas precio, tiempo y condiciones, y pagas dentro de HETNA."],
            ["Seguimiento", "Con tu folio ves el avance hasta que recibes tu pedido y lo calificas."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl bg-[#FAF9F6] p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C2560A]">Paso {i + 1}</span>
              <span className="mt-1 block font-bold text-[#142033]">{t}</span>
              <span className="mt-1 block text-sm text-[#6B675C]">{d}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-[#44433D]">
          Tus datos de contacto sólo los ve HETNA. Los talleres ven el trabajo y tus archivos, nunca tu correo ni tu teléfono.
        </p>
      </section>

      {/* Procesos y capacidades */}
      <section id="capacidades" className="mt-12 scroll-mt-24">
        <h2 className={H2}>Capacidades</h2>
        <p className="mt-1 max-w-2xl text-[#6B675C]">Lo que la red puede hacerle a tu pieza.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {OPERACIONES.map((o) => (
            <div key={o.que} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <p className="font-bold text-[#142033]">✓ {o.que}</p>
              <p className="mt-1 text-sm text-[#6B675C]">{o.detalle}</p>
            </div>
          ))}
          <a href="#solicitar" className="flex flex-col justify-center rounded-2xl bg-[#142033] p-4 text-white">
            <span className="font-bold">¿Tu pieza necesita algo más?</span>
            <span className="mt-1 text-sm text-white/75">Descríbelo en la solicitud.</span>
          </a>
        </div>

        <h3 className="mt-10 text-xl font-extrabold text-[#142033]">Procesos y máquinas</h3>
        <p className="mt-1 max-w-2xl text-[#6B675C]">
          En los que dicen &ldquo;precio al instante&rdquo; ves un estimado con sólo poner las medidas.
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

      <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E7E4DC] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[#F3F1EA] text-[#142033]">
            <tr>
              <th className="px-4 py-3 font-bold">Proceso</th>
              <th className="px-4 py-3 font-bold">Tamaño máximo típico</th>
              <th className="px-4 py-3 font-bold">Grosor / pieza</th>
              <th className="px-4 py-3 font-bold">Tolerancia típica</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E4DC] text-[#44433D]">
            {CAPACIDADES.map((c) => (
              <tr key={c.proceso}>
                <td className="px-4 py-3 font-semibold text-[#142033]">{c.proceso}</td>
                <td className="px-4 py-3">{c.tamano}</td>
                <td className="px-4 py-3">{c.grosor}</td>
                <td className="px-4 py-3">{c.tolerancia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[#6B675C]">
        Referencias típicas por proceso. La medida máxima y la tolerancia exacta las confirma cada taller con su máquina, en la propuesta.
        Para piezas más grandes se pueden hacer por secciones.
      </p>
      <div className={`mt-6 grid gap-4 ${maquinas.length ? "lg:grid-cols-2" : ""}`}>
        <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
          <p className="font-extrabold text-[#142033]">Acabados</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ACABADOS_TEXTO.map((a) => (
              <span key={a} className="rounded-full bg-[#F3F1EA] px-3 py-1.5 text-sm text-[#2B2A26]">{a}</span>
            ))}
          </div>
          <p className="mt-3 text-sm text-[#6B675C]">Producción por volumen: desde una pieza hasta pedidos recurrentes cada mes.</p>
        </div>
        {maquinas.length > 0 && (
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
            <p className="font-extrabold text-[#142033]">Máquinas registradas por talleres de la red</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {maquinas.map((m) => (
                <span key={m} className="rounded-full border border-[#E7E4DC] px-3 py-1.5 text-sm text-[#2B2A26]">{m}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      </section>

      {/* Materiales */}
      <section className="mt-12">
        <h2 className={H2}>Materiales que trabajamos</h2>
        <p className="mt-1 max-w-2xl text-[#6B675C]">
          Los talleres de la red trabajan estos materiales. Si no ves el tuyo, pregúntalo en tu solicitud.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MATERIALES.map((m) => (
            <div key={m.nombre} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <p className="font-bold text-[#142033]">{m.nombre}</p>
              <p className="mt-1 text-sm text-[#6B675C]">
                <span className="font-semibold text-[#44433D]">Ideal para:</span> {m.ideal}
              </p>
            </div>
          ))}
          <a href="#solicitar" className="rounded-2xl border-2 border-dashed border-[#C2560A] bg-[#FDEEE1] p-4 text-[#B34D07]">
            <span className="block font-bold">Otros materiales</span>
            <span className="mt-1 block text-sm">Latón, cobre, policarbonato, corcho, hule… pregúntanos por el tuyo.</span>
          </a>
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
        <h2 className={H2}>Por qué HETNA</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [
              "Red de talleres especializados",
              verificados > 0
                ? `Talleres CNC de distintos estados; ${verificados} ${verificados === 1 ? "ya está verificado" : "ya están verificados"} con identificación y fotos de su taller.`
                : "Talleres CNC de distintos estados. HETNA verifica a cada uno con identificación y fotos de su taller.",
            ],
            ["Atención en México", `Desde ${EMPRESA.ciudad}, ${EMPRESA.estado}, por WhatsApp ${EMPRESA.whatsappVisible}. ${EMPRESA.horario}.`],
            ["Cotización rápida", "Precio al instante en láser, router, plasma e impresión 3D. En lo demás, las propuestas te llegan por correo conforme los talleres cotizan."],
            ["Soporte técnico y revisión de archivos", "El taller revisa tu archivo antes de cotizar; si falta una cota o el grosor, te escribimos para aclararlo."],
            ["Seguimiento del proyecto", "Cada solicitud tiene folio y una liga privada donde ves las propuestas, tu pago y el avance."],
            ["Envíos a todo el país", "Cada propuesta dice si incluye el envío. También puedes recoger con el taller."],
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

      {/* Solicitud, en la misma página */}
      <section id="solicitar" className="mt-12 scroll-mt-24 rounded-3xl bg-[#142033] p-4 sm:p-8">
        <div className="mb-5 text-white">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Solicita tu fabricación ahora</h2>
          <p className="mt-1 max-w-2xl text-white/80">
            Es gratis y sin compromiso. Con estos datos los talleres te pueden dar un precio real desde la primera respuesta.
          </p>
        </div>
        <FormSolicitudTaller />
        <p className="mt-4 text-center text-sm text-white/70">
          ¿Prefieres hablar primero?{" "}
          <a
            href={ligaWhatsApp("Hola HETNA, quiero cotizar una fabricación CNC. Tipo de pieza: , material: , cantidad: , medidas: , ciudad: ")}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#F2A25F] underline"
          >
            Escríbenos por WhatsApp
          </a>
        </p>
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
