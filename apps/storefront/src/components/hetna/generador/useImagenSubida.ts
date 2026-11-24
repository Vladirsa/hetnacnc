"use client"

// Subir una imagen en el navegador: la reduce a píxeles (lado máximo dado),
// libera la URL anterior al cambiarla y al salir, avisa si no abre y evita que
// una carga vieja pise a la nueva. La imagen no sale del equipo.
import { useEffect, useRef, useState } from "react"

import type { Imagen } from "@/lib/generador/trazado"

/** Píxeles RGBA de la imagen, reducida para que su lado largo mida a lo más `lado`. */
export function pixelesDeImagen(img: HTMLImageElement, lado: number): Imagen | null {
  const s = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * s))
  const h = Math.max(1, Math.round(img.naturalHeight * s))
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const ctx = c.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h)
  return { data: d.data, width: w, height: h }
}

export type ImagenSubida = { im: Imagen; url: string; nombre: string; img: HTMLImageElement }

export function useImagenSubida(lado: number, alCargar?: (s: ImagenSubida) => void) {
  const [subida, setSubida] = useState<ImagenSubida | null>(null)
  const [error, setError] = useState("")
  const urlActual = useRef("")
  const carga = useRef(0)
  const alCargarRef = useRef(alCargar)
  alCargarRef.current = alCargar

  useEffect(() => () => {
    if (urlActual.current) URL.revokeObjectURL(urlActual.current)
  }, [])

  const abrir = (f?: File) => {
    if (!f) return
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setError("Sube una imagen JPG, PNG o WEBP.")
    const u = URL.createObjectURL(f)
    const img = new Image()
    const n = ++carga.current
    const fallo = () => {
      URL.revokeObjectURL(u)
      if (n === carga.current) setError("No se pudo abrir esa imagen. Prueba con una captura de pantalla en PNG o JPG.")
    }
    img.onerror = fallo
    img.onload = () => {
      // Si mientras tanto eligieron otra imagen, ésta ya no cuenta
      if (n !== carga.current) return URL.revokeObjectURL(u)
      const im = pixelesDeImagen(img, lado)
      if (!im) return fallo()
      if (urlActual.current) URL.revokeObjectURL(urlActual.current)
      urlActual.current = u
      const s = { im, url: u, nombre: f.name.replace(/\.[^.]+$/, ""), img }
      setError("")
      setSubida(s)
      alCargarRef.current?.(s)
    }
    img.src = u
  }

  return { subida, error, abrir }
}
