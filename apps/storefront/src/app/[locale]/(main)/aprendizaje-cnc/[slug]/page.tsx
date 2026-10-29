import { permanentRedirect } from "next/navigation"

// Los artículos se mudaron al blog del foro (/foro-cnc/blog). La dirección
// vieja redirige con 308 para conservar las ligas y lo que ya indexó Google.
export default async function AprendizajeArticulo({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  permanentRedirect(`/${locale}/foro-cnc/blog/${slug}`)
}
