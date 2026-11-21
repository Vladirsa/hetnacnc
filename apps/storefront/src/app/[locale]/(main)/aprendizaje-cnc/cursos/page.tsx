import { permanentRedirect } from "next/navigation"

// Los cursos se listan en la Academia (/servicios/aprendizaje-cnc). Esta
// dirección daba 404 (auditoría SEO del 21 nov 2026): ahora redirige con 308.
export default async function Cursos({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  permanentRedirect(`/${locale}/servicios/aprendizaje-cnc#cursos`)
}
