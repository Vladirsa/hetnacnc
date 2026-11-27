import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import { ListaFavoritos } from "@/components/hetna/Favoritos"

const metadataEs: Metadata = {
  title: "Favoritos",
  description: "Tus productos guardados en HETNA CNC",
}

export default function FavoritosPage() {
  return (
    <main className="w-full px-4 lg:px-16 py-8 bg-[#FAF9F6]">
      <h1 className="font-display text-[26px] font-bold m-0 mb-6"><TS>Tus favoritos</TS></h1>
      <ListaFavoritos />
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
