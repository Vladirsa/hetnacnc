import type { Metadata } from "next"

import { EstudioCam2D } from "@/components/hetna/cam/EstudioCam2D"

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/cam/subir" },
  title: "CAM Studio 2D: de tu DXF a G-code en un minuto",
  description:
    "Sube tu DXF, elige material y fresa, mira la trayectoria simulada y descarga el G-code listo para tu router. Gratis y sin cuenta.",
}

// Sin guardia de sesión a propósito: este es el flujo que alguien prueba antes
// de confiar en la plataforma. Pedirle cuenta primero es la forma más barata
// de perderlo. La explicación de qué hace y qué no vive en /laboratorio-cam.
export default function CamStudio2D() {
  return <EstudioCam2D />
}
