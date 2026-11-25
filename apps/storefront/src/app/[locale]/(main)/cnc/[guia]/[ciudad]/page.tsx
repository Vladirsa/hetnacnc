// /mx/cnc/<guía>/<ciudad> — la guía enfocada en una ciudad (sólo las guías con
// `ciudades`). Se indexa sólo si hay talleres de ese servicio en el estado, o al
// menos MIN_DIRECTORIO empresas del directorio que lo ofrecen ahí: sin empresas
// locales sería una página "puerta" (lib/seo/guias.ts, lib/seo/directorio-guia.ts).
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { GuiaCnc, talleresDeGuia } from "@/components/hetna/guias/GuiaCnc"
import { ciudadPorSlug, enCiudad, guiaPorSlug, h1EnCiudad } from "@/lib/seo/guias"
import { MIN_DIRECTORIO, directorioDeGuia } from "@/lib/seo/directorio-guia"

type Props = { params: Promise<{ locale: string; guia: string; ciudad: string }> }

// Las rutas que no existen dan 404 con notFound() (no se usa dynamicParams =
// false: el segmento [locale] no se genera en el build y todo daría 404).
export const revalidate = 3600


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params
  const g = guiaPorSlug(p.guia)
  const c = ciudadPorSlug(p.ciudad)
  if (!g?.ciudades || !c) return {}
  const [talleres, directorio] = await Promise.all([talleresDeGuia(g), directorioDeGuia(g, c)])
  const locales = talleres.filter((t) => enCiudad(c, t.perfil.estado, t.perfil.ciudad))
  const indexable = locales.length > 0 || directorio.length >= MIN_DIRECTORIO
  const cuantas = locales.length + directorio.length
  const url = `https://hetnacnc.com/mx/cnc/${g.slug}/${c.slug}`
  return {
    title: h1EnCiudad(g, c),
    description: `${h1EnCiudad(g, c)}: ${indexable ? `${cuantas} talleres y empresas en ${c.estado}` : "talleres con envío"}, espesores, cómo preparar tu archivo y precio al instante.`,
    alternates: { canonical: url },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  }
}

export default async function PaginaGuiaCiudad({ params }: Props) {
  const p = await params
  const g = guiaPorSlug(p.guia)
  const c = ciudadPorSlug(p.ciudad)
  if (!g?.ciudades || !c) notFound()
  return <GuiaCnc guia={g} ciudad={c} />
}
