import type { Metadata } from "next"

import { ServiciosIndice } from "@/components/hetna/ServicioPagina"

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/servicios" },
  title: "Servicios",
  description:
    "Generador 2D y 3D, Laboratorio CAM, maquinado en 3, 4 y 5 ejes, torno CNC, aprendizaje, cotizador y calculadora CNC.",
}

export default function ServiciosPage() {
  return <ServiciosIndice />
}
