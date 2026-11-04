import type { Metadata } from "next"
import { descripcionCorta } from "@/lib/helpers/seo"
import { notFound } from "next/navigation"

import { EscanearPieza } from "@/components/hetna/disenar/EscanearPieza"
import dynamic from "next/dynamic"

import { ESCANEAR, buscarHerramientaDiseno } from "@/lib/hetna/disenar"

// Cada herramienta se carga sola: antes la página traía el código de las 15
// (506 kB) aunque se abriera una.
const GeneradorAnidado = dynamic(() => import("@/components/hetna/generador/GeneradorAnidado").then((m) => m.GeneradorAnidado))
const GeneradorCaja = dynamic(() => import("@/components/hetna/generador/GeneradorCaja").then((m) => m.GeneradorCaja))
const GeneradorConvertidor = dynamic(() => import("@/components/hetna/generador/GeneradorConvertidor").then((m) => m.GeneradorConvertidor))
const GeneradorEmpaques = dynamic(() => import("@/components/hetna/generador/GeneradorEmpaques").then((m) => m.GeneradorEmpaques))
const GeneradorExtruir = dynamic(() => import("@/components/hetna/generador/GeneradorExtruir").then((m) => m.GeneradorExtruir))
const GeneradorGrabado = dynamic(() => import("@/components/hetna/generador/GeneradorGrabado").then((m) => m.GeneradorGrabado))
const GeneradorLetrero = dynamic(() => import("@/components/hetna/generador/GeneradorLetrero").then((m) => m.GeneradorLetrero))
const GeneradorLetras3D = dynamic(() => import("@/components/hetna/generador/GeneradorLetras3D").then((m) => m.GeneradorLetras3D))
const GeneradorLlaveros = dynamic(() => import("@/components/hetna/generador/GeneradorLlaveros").then((m) => m.GeneradorLlaveros))
const GeneradorMueble = dynamic(() => import("@/components/hetna/generador/GeneradorMueble").then((m) => m.GeneradorMueble))
const GeneradorPatron = dynamic(() => import("@/components/hetna/generador/GeneradorPatron").then((m) => m.GeneradorPatron))
const GeneradorRelieve = dynamic(() => import("@/components/hetna/generador/GeneradorRelieve").then((m) => m.GeneradorRelieve))
const GeneradorRompecabezas = dynamic(() => import("@/components/hetna/generador/GeneradorRompecabezas").then((m) => m.GeneradorRompecabezas))
const GeneradorVectorizador = dynamic(() => import("@/components/hetna/generador/GeneradorVectorizador").then((m) => m.GeneradorVectorizador))

// Una herramienta abierta dentro del estudio 3D o 2D (pantalla completa). La
// barra con las herramientas la pone el layout de (estudio).
const SITIO = "https://hetnacnc.com"

type Props = { params: Promise<{ locale: string; herramienta: string }> }

const GENERADORES: Record<string, React.ComponentType> = {
  "caja-con-juntas": GeneradorCaja,
  letreros: GeneradorLetrero,
  "letras-3d": GeneradorLetras3D,
  llaveros: GeneradorLlaveros,
  rompecabezas: GeneradorRompecabezas,
  vectorizador: GeneradorVectorizador,
  "despiece-muebles": GeneradorMueble,
  "plantillas-empaque": GeneradorEmpaques,
  "grabado-foto": GeneradorGrabado,
  "litofania-relieve": GeneradorRelieve,
  "patrones-radiales": GeneradorPatron,
  convertidor: GeneradorConvertidor,
  "svg-a-stl": GeneradorExtruir,
  "anidado-piezas": GeneradorAnidado,
}

const OSCURAS = new Set(["letras-3d", "caja-con-juntas", "llaveros", "vectorizador"])

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { herramienta } = await params
  const h = buscarHerramientaDiseno(herramienta)
  if (!h) return {}
  return {
    title: h.titulo,
    description: descripcionCorta(h.descripcion),
    alternates: {
      canonical: `${SITIO}/mx/disenar/${h.slug}`,
      languages: { "es-MX": `${SITIO}/mx/disenar/${h.slug}`, "en-US": `${SITIO}/us/disenar/${h.slug}` },
    },
  }
}

export default async function HerramientaDiseno({ params }: Props) {
  const { herramienta, locale } = await params
  if (herramienta === ESCANEAR) return <EscanearPieza locale={locale} />
  const Generador = GENERADORES[herramienta]
  if (!Generador) notFound()
  // Las herramientas que ya tienen su propio estudio oscuro van tal cual; las
  // demás se pintan con el tema oscuro común (.tema-estudio, globals.css).
  if (OSCURAS.has(herramienta)) return <Generador />
  return (
    <div className="tema-estudio flex-1">
      <Generador />
    </div>
  )
}
