"use client"

// Patrones de corte (2D Studio): celosías, patrones radiales y bisagra viva
// en una sola herramienta. Las tres son "un patrón que se repite o se escala
// dentro de un área". Cada modo es la herramienta de antes tal cual (mismo
// motor y mismos archivos); aquí sólo se elige el modo. Las direcciones viejas
// siguen vivas y abren su modo; al cambiar de modo la dirección cambia para
// que la liga que se comparte abra lo mismo.
import { useState } from "react"

import { GeneradorBisagra } from "./GeneradorBisagra"
import { GeneradorCelosias } from "./GeneradorCelosias"
import { GeneradorPatron } from "./GeneradorPatron"
import { SelectorModos, type Modo } from "./SelectorModos"

export type ModoPatron = "celosia" | "radial" | "bisagra"

const MODOS: Modo<ModoPatron>[] = [
  {
    id: "celosia",
    slug: "celosias",
    nombre: "Celosía",
    nota: "Panel con marco y patrón calado",
    icono: (
      <>
        <rect x="6" y="6" width="28" height="28" rx="2" />
        <path d="M14 10l3 5-3 5-3-5zM26 10l3 5-3 5-3-5zM20 20l3 5-3 5-3-5z" />
      </>
    ),
  },
  {
    id: "radial",
    slug: "patrones-radiales",
    nombre: "Mandala",
    nota: "Capas escaladas y giradas",
    icono: (
      <>
        <path d="M20 5l13 9-5 16H12L7 14z" />
        <path d="M20 12l7 5-3 8h-8l-3-8z" />
      </>
    ),
  },
  {
    id: "bisagra",
    slug: "bisagra-viva",
    nombre: "Bisagra viva",
    nota: "Cortes para que el MDF doble",
    icono: (
      <>
        <rect x="5" y="10" width="30" height="20" rx="2" />
        <path d="M16 13v6M16 22v5M19 10v7M19 20v7M22 13v6M22 22v5M25 10v7M25 20v7" />
      </>
    ),
  },
]

export function GeneradorPatronesCorte({ modoInicial = "celosia" }: { modoInicial?: ModoPatron }) {
  const [modo, setModo] = useState<ModoPatron>(modoInicial)
  const cabecera = <SelectorModos titulo="Patrones de corte" modos={MODOS} modo={modo} cambiar={setModo} />

  if (modo === "radial") return <GeneradorPatron cabecera={cabecera} />
  if (modo === "bisagra") return <GeneradorBisagra cabecera={cabecera} />
  return <GeneradorCelosias cabecera={cabecera} />
}
