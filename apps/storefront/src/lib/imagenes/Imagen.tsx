// next/image con el optimizador sólo para dominios propios (auditoría de
// seguridad del 18 nov 2026; ver dominios.ts). Se usa igual que next/image:
//   import Image from "@/lib/imagenes/Imagen"
// Las fotos de otros dominios y los SVG se muestran tal cual (unoptimized).
import NextImage, { type ImageProps } from "next/image"

import { DOMINIOS_IMAGENES } from "./dominios"

export function seOptimiza(src: ImageProps["src"]): boolean {
  if (typeof src !== "string") return true // importada desde el proyecto
  if (/\.svg(\?|#|$)/i.test(src)) return false
  if (src.startsWith("/") && !src.startsWith("//")) return true
  try {
    const u = new URL(src)
    if (u.protocol === "http:" && u.hostname === "localhost" && process.env.NODE_ENV !== "production") return true
    return u.protocol === "https:" && DOMINIOS_IMAGENES.includes(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

export default function Imagen(props: ImageProps) {
  return <NextImage {...props} unoptimized={props.unoptimized || !seOptimiza(props.src)} />
}
