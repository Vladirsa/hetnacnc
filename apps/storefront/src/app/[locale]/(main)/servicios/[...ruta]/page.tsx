import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { ServicioPagina } from "@/components/hetna/ServicioPagina"
import { buscarServicio } from "@/components/hetna/servicios-datos"
import { CopilotoApp } from "@/components/hetna/copiloto/CopilotoApp"
import { CotizadorLanding } from "@/components/hetna/taller/CotizadorLanding"
import { listLearningArticles } from "@/lib/data/learning-articles"
import { listCourses } from "@/lib/data/courses"

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
      title: "App HETNA CNC para talleres: cotiza, cobra y controla tu taller",
      description: "La app para talleres de router, láser, plasma e impresión 3D: cotizaciones con tus costos, clientes, avances, gastos, inventario y pagos en línea. Web y Android, gratis para empezar.",
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

  // La app HETNA CNC para talleres (Flutter, /cotizador/): esta página la
  // presenta, con instalación y planes; los botones abren la app real. Si un
  // generador manda un archivo (?archivo=generador) la página abre el
  // cotizador rápido embebido.
  if (s.slug === "cotizador-cnc") return <CotizadorLanding locale={locale} />

  // Los generadores gratis ya no se abren aquí: /servicios/generador-2d-3d/<herramienta>
  // redirige al espacio "Diseñar y escanear" (/disenar, ver next.config).

  if (s.slug === "aprendizaje-cnc") {
    const [{ learning_articles }, { courses }] = await Promise.all([
      listLearningArticles({ limit: 9 }),
      listCourses({ limit: 9 }),
    ])
    return <ServicioPagina s={s} articulos={learning_articles} cursos={courses} />
  }

  return <ServicioPagina s={s} />
}
