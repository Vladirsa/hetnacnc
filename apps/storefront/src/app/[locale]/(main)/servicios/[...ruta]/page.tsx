import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ServicioPagina } from "@/components/hetna/ServicioPagina"
import { buscarServicio } from "@/components/hetna/servicios-datos"
import { CotizadorEmbebido } from "@/components/hetna/taller/CotizadorEmbebido"
import { CotizadorLanding } from "@/components/hetna/taller/CotizadorLanding"
import { retrieveCustomer } from "@/lib/data/customer"

type Props = { params: Promise<{ locale: string; ruta: string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ruta } = await params
  const s = buscarServicio((ruta || []).join("/"))
  if (!s) return {}
  if (s.slug === "cotizador-cnc") {
    return {
      title: "Cotizador CNC para talleres",
      description: "Cotiza desde tu celular: sube DXF, SVG, STL u OBJ, obtén el precio con tus tarifas y envíalo por WhatsApp con PDF. Gratis para empezar.",
    }
  }
  return { title: s.nombre, description: s.resumen }
}

export default async function ServicioRuta({ params }: Props) {
  const { ruta, locale } = await params
  const s = buscarServicio((ruta || []).join("/"))
  if (!s) notFound()

  // El Cotizador CNC es la herramienta de HetNa Taller:
  // con sesion abre la app; sin sesion muestra la pagina con planes y prueba sin cuenta.
  if (s.slug === "cotizador-cnc") {
    const cliente = await retrieveCustomer().catch(() => null)
    return cliente ? <CotizadorEmbebido modo="cuenta" locale={locale} /> : <CotizadorLanding locale={locale} />
  }

  return <ServicioPagina s={s} />
}
