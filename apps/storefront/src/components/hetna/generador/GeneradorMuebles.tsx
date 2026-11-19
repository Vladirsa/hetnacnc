"use client"

// Muebles (2D Studio): mueble desde una imagen (cualquier mueble de tablero,
// con IA), ensamble sin tornillos (exhibidor paramétrico) y despiece de
// gabinetes con herrajes. Cada modo conserva su dirección:
// /disenar/muebles-desde-imagen, /disenar/muebles-ensamble y /disenar/despiece-muebles.
import { useState } from "react"

import { GeneradorEnsamble } from "./GeneradorEnsamble"
import { GeneradorMueble } from "./GeneradorMueble"
import { GeneradorMolduras } from "./GeneradorMolduras"
import { GeneradorTableros } from "./GeneradorTableros"
import { SelectorModos, type Modo } from "./SelectorModos"

export type ModoMuebles = "imagen" | "ensamble" | "gabinete" | "molduras"

const MODOS: Modo<ModoMuebles>[] = [
  {
    id: "imagen",
    slug: "muebles-desde-imagen",
    nombre: "Desde una imagen",
    nota: "Cualquier mueble de tablero, con IA",
    icono: (
      <>
        <rect x="5" y="7" width="30" height="24" rx="3" />
        <path d="M5 25l9-8 7 6 5-4 9 7" />
        <circle cx="27" cy="14" r="2.5" />
      </>
    ),
  },
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
    id: "molduras",
    slug: "molduras-tallados",
    nombre: "Molduras y tallados",
    nota: "Perfiles de fresa y paneles tallados en 3D",
    icono: (
      <>
        <rect x="6" y="6" width="28" height="28" rx="2" />
        <rect x="12" y="12" width="16" height="16" rx="1" />
        <circle cx="20" cy="20" r="3" />
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
  if (modo === "imagen") return <GeneradorTableros cabecera={cabecera} />
  if (modo === "molduras") return <GeneradorMolduras cabecera={cabecera} />
  if (modo === "gabinete")
    return (
      <div className="tema-estudio flex-1">
        <GeneradorMueble cabecera={cabecera} />
      </div>
    )
  return <GeneradorEnsamble cabecera={cabecera} />
}
