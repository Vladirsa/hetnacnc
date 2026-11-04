import type { Metadata } from "next"
import { descripcionCorta } from "@/lib/helpers/seo"
import { notFound } from "next/navigation"

import { EscanearPieza } from "@/components/hetna/disenar/EscanearPieza"
import { Herramienta } from "@/components/hetna/estudio/Herramienta"

import { ESCANEAR, buscarHerramientaDiseno } from "@/lib/hetna/disenar"


// Una herramienta abierta dentro del estudio 3D o 2D (pantalla completa). La
// barra con las herramientas la pone el layout de (estudio).
const SITIO = "https://hetnacnc.com"

type Props = { params: Promise<{ locale: string; herramienta: string }> }

const SLUGS = new Set(["caja-con-juntas", "letreros", "letras-3d", "llaveros", "rompecabezas", "vectorizador", "despiece-muebles", "plantillas-empaque", "grabado-foto", "litofania-relieve", "patrones-radiales", "convertidor", "svg-a-stl", "anidado-piezas"])

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
  if (!SLUGS.has(herramienta)) notFound()
  // Las herramientas que ya tienen su propio estudio oscuro van tal cual; las
  // demás se pintan con el tema oscuro común (.tema-estudio, globals.css).
  if (OSCURAS.has(herramienta)) return <Herramienta slug={herramienta} />
  return (
    <div className="tema-estudio flex-1">
      <Herramienta slug={herramienta} />
    </div>
  )
}
