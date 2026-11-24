import { permanentRedirect } from "next/navigation"

// La lista de empresas de todos los países se quitó: ahora cada país es un punto
// en el mapa de /talleres (MapaTalleres, prop `paises`). Esta dirección llegó a
// estar publicada, así que manda al mapa.
export default async function TalleresMundoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  permanentRedirect(`/${locale}/talleres`)
}
