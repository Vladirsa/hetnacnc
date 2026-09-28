import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ServicioPagina } from "@/components/hetna/ServicioPagina"
import { buscarServicio } from "@/components/hetna/servicios-datos"

type Props = { params: Promise<{ locale: string; ruta: string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ruta } = await params
  const s = buscarServicio((ruta || []).join("/"))
  if (!s) return {}
  return { title: s.nombre, description: s.resumen }
}

export default async function ServicioRuta({ params }: Props) {
  const { ruta } = await params
  const s = buscarServicio((ruta || []).join("/"))
  if (!s) notFound()
  return <ServicioPagina s={s} />
}
