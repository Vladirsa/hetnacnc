import type { Metadata } from "next"

import { ServiciosIndice } from "@/components/hetna/ServicioPagina"
import { JsonLd } from "@/components/hetna/JsonLd"
import { SERVICIOS } from "@/components/hetna/servicios-datos"
import { HERRAMIENTAS_DISENO } from "@/lib/hetna/disenar"
import { migas } from "@/lib/hetna/schema"

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/servicios" },
  title: "Servicios CNC: fabricación, CAM y diseño",
  description:
    "Generador 2D y 3D, Laboratorio CAM, maquinado en 3, 4 y 5 ejes, torno CNC, aprendizaje, cotizador y calculadora CNC.",
}

// Lista de servicios para Google (ItemList) y migas de pan
const lista = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Servicios CNC de HETNA",
  // Sin los que redirigen (generador-2d-3d → /disenar, laboratorio-cam → /fabricacion)
  // Mismo filtro que el mapa del sitio (lib/seo/mapa-sitio.ts)
  itemListElement: SERVICIOS.filter(
    (s) =>
      s.slug !== "generador-2d-3d" &&
      !HERRAMIENTAS_DISENO.some((h) => s.slug === `generador-2d-3d/${h.slug}`) &&
      !s.slug.startsWith("laboratorio-cam")
  )
    .slice(0, 30)
    .map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.nombre, url: `https://hetnacnc.com/mx/servicios/${s.slug}` })),
}

export default function ServiciosPage() {
  return (
    <>
      <JsonLd datos={[lista, migas([{ nombre: "Inicio", ruta: "https://hetnacnc.com/mx" }, { nombre: "Servicios" }])]} />
      <ServiciosIndice />
    </>
  )
}
