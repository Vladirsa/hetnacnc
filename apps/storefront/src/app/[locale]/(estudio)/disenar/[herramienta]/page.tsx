import type { Metadata } from "next"
import { descripcionCorta } from "@/lib/helpers/seo"
import { notFound } from "next/navigation"

import { EscanearPieza } from "@/components/hetna/disenar/EscanearPieza"
import { GeneradorAnidado } from "@/components/hetna/generador/GeneradorAnidado"
import { GeneradorCaja } from "@/components/hetna/generador/GeneradorCaja"
import { GeneradorConvertidor } from "@/components/hetna/generador/GeneradorConvertidor"
import { GeneradorEmpaques } from "@/components/hetna/generador/GeneradorEmpaques"
import { GeneradorExtruir } from "@/components/hetna/generador/GeneradorExtruir"
import { GeneradorGrabado } from "@/components/hetna/generador/GeneradorGrabado"
import { GeneradorLetrero } from "@/components/hetna/generador/GeneradorLetrero"
import { GeneradorLetras3D } from "@/components/hetna/generador/GeneradorLetras3D"
import { GeneradorLlaveros } from "@/components/hetna/generador/GeneradorLlaveros"
import { GeneradorMueble } from "@/components/hetna/generador/GeneradorMueble"
import { GeneradorPatron } from "@/components/hetna/generador/GeneradorPatron"
import { GeneradorRelieve } from "@/components/hetna/generador/GeneradorRelieve"
import { GeneradorRompecabezas } from "@/components/hetna/generador/GeneradorRompecabezas"
import { GeneradorVectorizador } from "@/components/hetna/generador/GeneradorVectorizador"
import { ESCANEAR, buscarHerramientaDiseno } from "@/lib/hetna/disenar"

// Una herramienta abierta dentro del estudio 3D o 2D (pantalla completa). La
// barra con las herramientas la pone el layout de (estudio).
const SITIO = "https://hetnacnc.com"

type Props = { params: Promise<{ locale: string; herramienta: string }> }

const GENERADORES: Record<string, () => React.JSX.Element> = {
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

const OSCURAS = new Set(["letras-3d"])

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
  // Las herramientas que ya tienen su propio estudio oscuro van a todo lo
  // ancho; las demás, sobre un fondo claro para que se lean como siempre.
  if (OSCURAS.has(herramienta)) return <Generador />
  return (
    <div className="flex-1 bg-[#F4F3EF] text-[#1B1B18]">
      <Generador />
    </div>
  )
}
