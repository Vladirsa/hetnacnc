"use client"

// Decoración (2D Studio): relojes de pared, marcos y portarretratos, y
// lámparas por capas en una sola herramienta. Las tres son piezas decorativas
// para regalo o venta. Cada modo es la herramienta de antes tal cual (mismo
// motor y mismos archivos). Las direcciones viejas siguen vivas y abren su modo.
import { useState } from "react"

import { GeneradorLamparas } from "./GeneradorLamparas"
import { GeneradorMarcos } from "./GeneradorMarcos"
import { GeneradorRelojes } from "./GeneradorRelojes"
import { SelectorModos, type Modo } from "./SelectorModos"

export type ModoDecoracion = "reloj" | "marco" | "lampara"

const MODOS: Modo<ModoDecoracion>[] = [
  {
    id: "reloj",
    slug: "relojes",
    nombre: "Reloj",
    nota: "Carátulas de pared con números o marcas",
    icono: (
      <>
        <circle cx="20" cy="20" r="14" />
        <path d="M20 11v9l6 4" />
      </>
    ),
  },
  {
    id: "marco",
    slug: "marcos-portarretratos",
    nombre: "Marco",
    nota: "Portarretratos por capas con ranura",
    icono: (
      <>
        <rect x="7" y="5" width="26" height="30" rx="2" />
        <rect x="12" y="10" width="16" height="20" />
      </>
    ),
  },
  {
    id: "lampara",
    slug: "lamparas-capas",
    nombre: "Lámpara",
    nota: "Costillas y anillos que se encastran",
    icono: (
      <>
        <path d="M20 5c8 0 12 7 12 15s-4 15-12 15S8 28 8 20 12 5 20 5z" />
        <path d="M20 5v30M9 15h22M9 25h22" />
      </>
    ),
  },
]

export function GeneradorDecoracion({ modoInicial = "reloj" }: { modoInicial?: ModoDecoracion }) {
  const [modo, setModo] = useState<ModoDecoracion>(modoInicial)
  const cabecera = <SelectorModos titulo="Decoración" modos={MODOS} modo={modo} cambiar={setModo} />
  if (modo === "marco") return <GeneradorMarcos cabecera={cabecera} />
  if (modo === "lampara") return <GeneradorLamparas cabecera={cabecera} />
  return <GeneradorRelojes cabecera={cabecera} />
}
