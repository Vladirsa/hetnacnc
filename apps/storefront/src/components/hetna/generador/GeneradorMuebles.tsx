"use client"

// Muebles (2D Studio): ensamble sin tornillos (ranura y espiga, nuevo) y
// despiece de gabinetes con herrajes (el de siempre). Cada modo conserva su
// dirección: /disenar/muebles-ensamble y /disenar/despiece-muebles.
import { useState } from "react"

import { GeneradorEnsamble } from "./GeneradorEnsamble"
import { GeneradorMueble } from "./GeneradorMueble"
import { SelectorModos, type Modo } from "./SelectorModos"

export type ModoMuebles = "ensamble" | "gabinete"

const MODOS: Modo<ModoMuebles>[] = [
  {
    id: "ensamble",
    slug: "muebles-ensamble",
    nombre: "Ensamble sin tornillos",
    nota: "Exhibidores y repisas de ranura y espiga",
    icono: (
      <>
        <path d="M10 5v30M30 5v30M10 13h20M10 22h20M10 31h20" />
        <path d="M6 13h4M30 13h4M6 22h4M30 22h4" />
      </>
    ),
  },
  {
    id: "gabinete",
    slug: "despiece-muebles",
    nombre: "Gabinete con herrajes",
    nota: "Despiece, canto y herrajes",
    icono: (
      <>
        <rect x="7" y="6" width="26" height="28" rx="2" />
        <path d="M20 6v28M17 20h-2M25 20h-2" />
      </>
    ),
  },
]

export function GeneradorMuebles({ modoInicial = "ensamble" }: { modoInicial?: ModoMuebles }) {
  const [modo, setModo] = useState<ModoMuebles>(modoInicial)
  const cabecera = <SelectorModos titulo="Muebles" modos={MODOS} modo={modo} cambiar={setModo} />
  if (modo === "gabinete")
    return (
      <div className="tema-estudio flex-1">
        <GeneradorMueble cabecera={cabecera} />
      </div>
    )
  return <GeneradorEnsamble cabecera={cabecera} />
}
