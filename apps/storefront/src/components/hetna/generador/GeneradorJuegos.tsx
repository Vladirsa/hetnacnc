"use client"

// Juegos y mecanismos (2D Studio): rompecabezas y engranes en una sola
// herramienta. Cada modo es la herramienta de antes tal cual (mismo motor y
// mismos archivos). Las direcciones viejas siguen vivas y abren su modo.
import dynamic from "next/dynamic"
import { useState } from "react"

import { SelectorModos, type Modo } from "./SelectorModos"
// Cada modo se baja sólo cuando se abre (antes se bajaban todos juntos)
const GeneradorEngranes = dynamic(() => import("./GeneradorEngranes").then((x) => x.GeneradorEngranes))
const GeneradorRompecabezas = dynamic(() => import("./GeneradorRompecabezas").then((x) => x.GeneradorRompecabezas))


export type ModoJuegos = "rompecabezas" | "engranes"

const MODOS: Modo<ModoJuegos>[] = [
  {
    id: "rompecabezas",
    slug: "rompecabezas",
    nombre: "Rompecabezas",
    nota: "Piezas con pestañas para cortar en láser",
    icono: (
      <path d="M8 8h9a3 3 0 1 1 6 0h9v9a3 3 0 1 0 0 6v9h-9a3 3 0 1 0-6 0H8v-9a3 3 0 1 1 0-6z" />
    ),
  },
  {
    id: "engranes",
    slug: "engranes",
    nombre: "Engranes",
    nota: "Engranes rectos que sí engranan",
    icono: (
      <>
        <circle cx="20" cy="20" r="9" />
        <circle cx="20" cy="20" r="3" />
        <path d="M20 6v5M20 29v5M6 20h5M29 20h5M10 10l3.5 3.5M26.5 26.5L30 30M10 30l3.5-3.5M26.5 13.5L30 10" />
      </>
    ),
  },
]

export function GeneradorJuegos({ modoInicial = "rompecabezas" }: { modoInicial?: ModoJuegos }) {
  const [modo, setModo] = useState<ModoJuegos>(modoInicial)
  const cabecera = <SelectorModos titulo="Juegos y mecanismos" modos={MODOS} modo={modo} cambiar={setModo} />
  if (modo === "engranes") return <GeneradorEngranes cabecera={cabecera} />
  // el rompecabezas tiene su propia pantalla: se pinta con el tema oscuro del estudio
  return (
    <div className="tema-estudio flex-1">
      <GeneradorRompecabezas cabecera={cabecera} />
    </div>
  )
}
