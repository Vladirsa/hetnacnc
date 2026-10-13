// Datos estructurados del taller (negocio local + migas de pan).
// Va en el layout para no tocar la página del mini-sitio: el layout recibe el mismo [handle].

import type { ReactNode } from "react"

import { JsonLd } from "@/components/hetna/JsonLd"
import { baseSitio, migas, negocioLocalSchema } from "@/lib/hetna/schema"
import { tallerPorHandle } from "@/lib/hetna/talleres"

export default async function TallerLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ handle: string; locale: string }>
}) {
  const { handle, locale } = await params
  const t = await tallerPorHandle(handle)
  const base = baseSitio()

  return (
    <>
      {t && (
        <>
          <JsonLd id="ld-taller" datos={negocioLocalSchema(t, locale)} />
          <JsonLd
            id="ld-migas-taller"
            datos={migas([
              { nombre: "Inicio", ruta: `${base}/${locale}` },
              { nombre: "Talleres", ruta: `${base}/${locale}/talleres` },
              { nombre: t.nombre },
            ])}
          />
        </>
      )}
      {children}
    </>
  )
}
