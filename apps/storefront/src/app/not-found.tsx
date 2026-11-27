import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ArrowUpIcon } from "@/icons"
import { Metadata } from "next"

const metadataEs: Metadata = {
  title: "404",
  description: "Algo salió mal",
}

export default function NotFound() {
  return (
    <div className="flex flex-col gap-4 items-center justify-center py-24">
      <h1 className="text-2xl-semi text-ui-fg-base"><TS>Página no encontrada</TS></h1>
      <p className="text-small-regular text-ui-fg-base">
        <TS>La página que buscas no existe.</TS>
      </p>
      <LocalizedClientLink className="flex gap-x-1 items-center group" href="/">
        <TS>Ir al inicio</TS>
        <ArrowUpIcon
          className="group-hover:rotate-45 ease-in-out duration-150"
          color="var(--fg-interactive)"
        />
      </LocalizedClientLink>
    </div>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
