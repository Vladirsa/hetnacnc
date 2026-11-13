// /mx/cnc/<guía>/<ciudad> — la guía enfocada en una ciudad (sólo las guías con
// `ciudades`). Se indexa sólo si hay talleres de ese servicio en el estado:
// sin talleres locales sería una página "puerta" (lib/seo/guias.ts).
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { GuiaCnc, talleresDeGuia } from "@/components/hetna/guias/GuiaCnc"
import { ciudadPorSlug, enCiudad, guiaPorSlug } from "@/lib/seo/guias"

type Props = { params: Promise<{ locale: string; guia: string; ciudad: string }> }

// Las rutas que no existen dan 404 con notFound() (no se usa dynamicParams =
// false: el segmento [locale] no se genera en el build y todo daría 404).
export const revalidate = 3600


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params
  const g = guiaPorSlug(p.guia)
  const c = ciudadPorSlug(p.ciudad)
  if (!g?.ciudades || !c) return {}
  const locales = (await talleresDeGuia(g)).filter((t) => enCiudad(c, t.perfil.estado, t.perfil.ciudad))
  const url = `https://hetnacnc.com/mx/cnc/${g.slug}/${c.slug}`
  return {
    title: `${g.h1} en ${c.nombre}`,
    description: `${g.h1} en ${c.nombre}: ${locales.length ? `talleres en ${c.estado}` : "talleres con envío"}, espesores, cómo preparar tu archivo y precio al instante.`,
    alternates: { canonical: url },
    robots: locales.length ? { index: true, follow: true } : { index: false, follow: true },
  }
}

export default async function PaginaGuiaCiudad({ params }: Props) {
  const p = await params
  const g = guiaPorSlug(p.guia)
  const c = ciudadPorSlug(p.ciudad)
  if (!g?.ciudades || !c) notFound()
  return <GuiaCnc guia={g} ciudad={c} />
}
