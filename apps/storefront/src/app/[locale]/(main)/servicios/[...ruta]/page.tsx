import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { ServicioPagina } from "@/components/hetna/ServicioPagina"
import { buscarServicio } from "@/components/hetna/servicios-datos"
import { CopilotoApp } from "@/components/hetna/copiloto/CopilotoApp"
import { GeneradorCaja } from "@/components/hetna/generador/GeneradorCaja"
import { GeneradorConvertidor } from "@/components/hetna/generador/GeneradorConvertidor"
import { GeneradorEmpaques } from "@/components/hetna/generador/GeneradorEmpaques"
import { GeneradorGrabado } from "@/components/hetna/generador/GeneradorGrabado"
import { GeneradorLetrero } from "@/components/hetna/generador/GeneradorLetrero"
import { GeneradorMueble } from "@/components/hetna/generador/GeneradorMueble"
import { GeneradorPatron } from "@/components/hetna/generador/GeneradorPatron"
import { GeneradorRelieve } from "@/components/hetna/generador/GeneradorRelieve"
import { GeneradorVectorizador } from "@/components/hetna/generador/GeneradorVectorizador"
import { CotizadorEmbebido } from "@/components/hetna/taller/CotizadorEmbebido"
import { CotizadorLanding } from "@/components/hetna/taller/CotizadorLanding"
import { retrieveCustomer } from "@/lib/data/customer"
import { listLearningArticles } from "@/lib/data/learning-articles"

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
  if (s.slug === "generador-2d-3d/caja-con-juntas") {
    return {
      title: "Generador de caja con juntas de dedo gratis (DXF y SVG)",
      description: "Crea gratis una caja con juntas de dedo para corte láser o router CNC: escribe medidas y espesor de MDF o acrílico y descarga en DXF, SVG o PDF.",
    }
  }
  if (s.slug === "generador-2d-3d/plantillas-empaque") {
    return {
      title: "Generador de plantillas de cajas y empaques gratis (DXF, SVG, PDF)",
      description: "Crea gratis plantillas de caja con solapas, pirámide, cono, sobre, bolsa y caja hexagonal a tu medida. Descarga en DXF, SVG o PDF para imprimir, plotter o láser.",
    }
  }
  if (s.slug === "generador-2d-3d/convertidor") {
    return {
      title: "Convertir DXF a SVG, SVG a DXF y STL a OBJ gratis en línea",
      description: "Convierte gratis archivos DXF, SVG, STL y OBJ, cambia su tamaño o ajústalos a otro espesor de material para corte láser, router o plasma. Sin subir tu archivo.",
    }
  }
  if (s.slug === "generador-2d-3d/despiece-muebles") {
    return {
      title: "Despiece de muebles gratis: lista de corte y acomodo en hojas (DXF)",
      description: "Calcula gratis el despiece de gabinetes, libreros, closets y cocinas en melamina o MDF: lista de corte, acomodo en hojas, metros de canto y herrajes. Descarga el DXF para tu router CNC.",
    }
  }
  if (s.slug === "generador-2d-3d/vectorizador") {
    return {
      title: "Vectorizar imagen gratis para CNC y láser: de JPG o PNG a DXF y SVG",
      description: "Convierte gratis un logotipo, dibujo o foto en vector: contornos cerrados en DXF o SVG listos para corte láser, router CNC o plasma. Tu imagen no se sube a ningún servidor.",
    }
  }
  if (s.slug === "generador-2d-3d/letreros") {
    return {
      title: "Generador de letreros y nombres en DXF gratis para router CNC y láser",
      description: "Escribe un nombre o un letrero, elige entre 19 tipografías y descarga gratis el DXF con las letras unidas, con barra o en placa con barrenos. Revisa si tu fresa alcanza todos los detalles.",
    }
  }
  if (s.slug === "generador-2d-3d/grabado-foto") {
    return {
      title: "Foto para grabado láser gratis: tramado Jarvis, semitono y DPI exacto",
      description: "Prepara gratis tu foto para grabar con láser en madera, MDF, piel, pizarra o acrílico: brillo, contraste, tramado Jarvis, Stucki o Floyd, semitono y PNG con la resolución exacta para LightBurn.",
    }
  }
  if (s.slug === "generador-2d-3d/litofania-relieve") {
    return {
      title: "Generador de litofanías y relieves 3D gratis: de foto a STL",
      description: "Convierte gratis una foto en STL: litofanía plana, curva o en cilindro para lámpara lista para imprimir, o relieve 3D con mapa de alturas para tallar en router CNC con VCarve o Aspire.",
    }
  }
  if (s.slug === "generador-2d-3d/patrones-radiales") {
    return {
      title: "Generador de patrones radiales gratis: mandalas y arte de pared (DXF, SVG)",
      description: "Crea gratis mandalas y patrones decorativos para corte láser: capas escaladas y rotadas con una fórmula matemática. Descarga en DXF o SVG.",
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

  // Generador 2D y 3D: herramienta gratis de caja con juntas de dedo
  if (s.slug === "generador-2d-3d/caja-con-juntas") return <GeneradorCaja />
  if (s.slug === "generador-2d-3d/plantillas-empaque") return <GeneradorEmpaques />
  if (s.slug === "generador-2d-3d/convertidor") return <GeneradorConvertidor />
  if (s.slug === "generador-2d-3d/despiece-muebles") return <GeneradorMueble />
  if (s.slug === "generador-2d-3d/vectorizador") return <GeneradorVectorizador />
  if (s.slug === "generador-2d-3d/letreros") return <GeneradorLetrero />
  if (s.slug === "generador-2d-3d/grabado-foto") return <GeneradorGrabado />
  if (s.slug === "generador-2d-3d/litofania-relieve") return <GeneradorRelieve />
  if (s.slug === "generador-2d-3d/patrones-radiales") return <GeneradorPatron />

  if (s.slug === "aprendizaje-cnc") {
    const { learning_articles } = await listLearningArticles({ limit: 9 })
    return <ServicioPagina s={s} articulos={learning_articles} />
  }

  return <ServicioPagina s={s} />
}
