import type { Metadata } from "next"

import { ListaFavoritos } from "@/components/hetna/Favoritos"

export const metadata: Metadata = {
  title: "Favoritos",
  description: "Tus productos guardados en HETNA CNC",
}

export default function FavoritosPage() {
  return (
    <main className="w-full px-4 lg:px-16 py-8 bg-[#FAF9F6]">
      <h1 className="font-display text-[26px] font-bold m-0 mb-6">Tus favoritos</h1>
      <ListaFavoritos />
    </main>
  )
}
