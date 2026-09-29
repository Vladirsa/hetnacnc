import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { ServicioPagina } from "@/components/hetna/ServicioPagina"
import { buscarServicio } from "@/components/hetna/servicios-datos"
import { CopilotoApp } from "@/components/hetna/copiloto/CopilotoApp"
import { CotizadorEmbebido } from "@/components/hetna/taller/CotizadorEmbebido"
import { CotizadorLanding } from "@/components/hetna/taller/CotizadorLanding"
import { retrieveCustomer } from "@/lib/data/customer"

type Props = {
  params: Promise<{ locale: string; ruta: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ruta } = await params
  const s = buscarServicio((ruta || []).join("/"))
  if (!s) return {}
  if (s.slug === "copiloto-ia-cnc") {
    return {
      title: "Copiloto IA CNC: parámetros, G-code y diagnóstico",
      description: "Pregúntale a la IA especializada en CNC: velocidades y avances para router, láser, plasma y fibra, revisión de G-code, DXF y STL, errores de Mach3 y GRBL, y costos. Calculadoras gratis.",
    }
  }
  if (s.slug === "cotizador-cnc") {
    return {
      title: "Cotizador CNC para talleres",
      description: "Cotiza desde tu celular: sube DXF, SVG, STL u OBJ, obtén el precio con tus tarifas y envíalo por WhatsApp con PDF. Gratis para empezar.",
    }
  }
  return { title: s.nombre, description: s.resumen }
}

export default async function ServicioRuta({ params, searchParams }: Props) {
  const { ruta, locale } = await params
  const clave = (ruta || []).join("/")
  // la antigua Calculadora CNC ahora vive dentro del Copiloto IA CNC
  if (clave === "calculadora-cnc") redirect(`/${locale}/servicios/copiloto-ia-cnc?vista=calculadoras`)
  const s = buscarServicio(clave)
  if (!s) notFound()

  // Copiloto IA CNC: chat especializado + calculadoras + "Mi maquina"
  if (s.slug === "copiloto-ia-cnc") {
    const q = await searchParams
    const v = q.vista === "calculadoras" || q.vista === "maquina" ? q.vista : "copiloto"
    return <CopilotoApp locale={locale} vistaInicial={v} />
  }

  // El Cotizador CNC es la herramienta de HetNa Taller:
  // con sesion abre la app; sin sesion muestra la pagina con planes y prueba sin cuenta.
  if (s.slug === "cotizador-cnc") {
    const cliente = await retrieveCustomer().catch(() => null)
    return cliente ? <CotizadorEmbebido modo="cuenta" locale={locale} /> : <CotizadorLanding locale={locale} />
  }

  return <ServicioPagina s={s} />
}
