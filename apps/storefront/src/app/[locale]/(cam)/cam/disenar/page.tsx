import { metaEnIdioma } from "@/i18n/servidor"
import type { Metadata } from "next"

import { DisenadorVectorial } from "@/components/hetna/cam/disenador/DisenadorVectorial"

const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/cam/disenar" },
  title: "Diseñador de vectores CNC gratis: dibuja, edita y manda a maquilar",
  description:
    "Dibuja en tu navegador líneas, curvas, rectángulos, círculos, estrellas y texto; suelda, resta, haz offset y copias en fila o en círculo. Pásalo al CAM con una operación por capa o mándalo a maquilar con talleres CNC.",
}

// Sin cuenta, como el CAM 2D: el diseño se guarda en el navegador mientras se dibuja.
export default function DisenarVectores() {
  return <DisenadorVectorial />
}

export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
