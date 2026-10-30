import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { EscanearPieza } from "@/components/hetna/disenar/EscanearPieza"
import { GeneradorAnidado } from "@/components/hetna/generador/GeneradorAnidado"
import { GeneradorCaja } from "@/components/hetna/generador/GeneradorCaja"
import { GeneradorConvertidor } from "@/components/hetna/generador/GeneradorConvertidor"
import { GeneradorEmpaques } from "@/components/hetna/generador/GeneradorEmpaques"
import { GeneradorExtruir } from "@/components/hetna/generador/GeneradorExtruir"
import { GeneradorGrabado } from "@/components/hetna/generador/GeneradorGrabado"
import { GeneradorLetrero } from "@/components/hetna/generador/GeneradorLetrero"
import { GeneradorLlaveros } from "@/components/hetna/generador/GeneradorLlaveros"
import { GeneradorMueble } from "@/components/hetna/generador/GeneradorMueble"
import { GeneradorPatron } from "@/components/hetna/generador/GeneradorPatron"
import { GeneradorRelieve } from "@/components/hetna/generador/GeneradorRelieve"
import { GeneradorRompecabezas } from "@/components/hetna/generador/GeneradorRompecabezas"
import { GeneradorVectorizador } from "@/components/hetna/generador/GeneradorVectorizador"
import { ESCANEAR, buscarHerramientaDiseno } from "@/lib/hetna/disenar"

// Una herramienta abierta dentro del espacio "Diseñar y escanear". El menú y
// la ruta de arriba los pone el layout; aquí sólo va la herramienta.
const SITIO = "https://hetnacnc.com"

type Props = { params: Promise<{ locale: string; herramienta: string }> }

const GENERADORES: Record<string, () => React.JSX.Element> = {
  "caja-con-juntas": GeneradorCaja,
  letreros: GeneradorLetrero,
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { herramienta } = await params
  const h = buscarHerramientaDiseno(herramienta)
  if (!h) return {}
  return {
    title: h.titulo,
    description: h.descripcion,
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
  return <Generador />
}
