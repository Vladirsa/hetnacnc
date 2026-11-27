import { metaEnIdioma } from "@/i18n/servidor"
import type { Metadata } from "next"

import { PanelTaller } from "@/components/hetna/panel-taller/PanelTaller"

const metadataEs: Metadata = {
  title: "Panel del taller",
  description: "Solicitudes de cotización, trabajos en curso y tu plan del Cotizador.",
  robots: { index: false, follow: false },
}

// La sesión es la del panel de vendedores (/seller): la cookie es del mismo
// dominio, así que el panel lee /vendor/* directo desde el navegador. Sin
// sesión, PanelTaller muestra el acceso para talleres.
export default function PanelTallerPage() {
  return <PanelTaller />
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
