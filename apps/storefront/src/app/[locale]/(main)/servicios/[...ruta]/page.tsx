import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { ServicioPagina } from "@/components/hetna/ServicioPagina"
import { Academia } from "@/components/hetna/academia/Academia"
import { buscarServicio } from "@/components/hetna/servicios-datos"
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
  if (s.slug === "cotizador-cnc") {
    return {
      title: "App HETNA CNC para talleres: cotiza, cobra y controla tu taller",
      description: "La app para talleres de router, láser, plasma e impresión 3D: cotizaciones con tus costos, clientes, avances, gastos, inventario y pagos en línea. Web y Android, gratis para empezar.",
    }
  }
  if (s.slug === "aprendizaje-cnc") {
    return {
      title: "Academia CNC: cursos de router, láser, plasma y Fusion 360 | HETNA",
      description: "Cursos prácticos de CNC en español impartidos por talleres de México. Muchos gratis; los de pago con lecciones de muestra.",
    }
  }
  return { title: s.nombre, description: s.resumen }
}

export default async function ServicioRuta({ params, searchParams }: Props) {
  const { ruta, locale } = await params
  const clave = (ruta || []).join("/")
  // la antigua Calculadora CNC ahora es la Calculadora CNC profesional (/calculadora-cnc)
  if (clave === "calculadora-cnc") redirect(`/${locale}/calculadora-cnc`)
  // El Copiloto IA se retiró (costaba más de lo que aportaba); sus calculadoras
  // viven en la Calculadora CNC, así que las ligas viejas van para allá.
  if (clave === "copiloto-ia-cnc") redirect(`/${locale}/calculadora-cnc`)
  const s = buscarServicio(clave)
  if (!s) notFound()

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
      listCourses({ limit: 60 }),
    ])
    return <Academia cursos={courses} articulos={learning_articles} />
  }

  return <ServicioPagina s={s} />
}
