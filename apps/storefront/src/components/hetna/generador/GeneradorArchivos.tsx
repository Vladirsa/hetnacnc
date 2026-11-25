"use client"

// Archivos (2D Studio): convertidor, anidado, rebanado en capas y SVG a STL en
// una sola herramienta. Las cuatro empiezan subiendo un archivo (DXF, SVG,
// STL u OBJ) y después eliges: convertir o escalar, acomodar en hojas,
// rebanar en capas o extruir a 3D. Cada modo es la herramienta de antes tal
// cual. Las direcciones viejas siguen vivas y abren su modo.
import dynamic from "next/dynamic"
import { useState } from "react"

import { SelectorModos, type Modo } from "./SelectorModos"
// Cada modo se baja sólo cuando se abre (antes se bajaban todos juntos)
const GeneradorAnidado = dynamic(() => import("./GeneradorAnidado").then((x) => x.GeneradorAnidado))
const GeneradorConvertidor = dynamic(() => import("./GeneradorConvertidor").then((x) => x.GeneradorConvertidor))
const GeneradorExtruir = dynamic(() => import("./GeneradorExtruir").then((x) => x.GeneradorExtruir))
const GeneradorRebanado = dynamic(() => import("./GeneradorRebanado").then((x) => x.GeneradorRebanado))


export type ModoArchivos = "convertir" | "anidar" | "rebanar" | "extruir"

const MODOS: Modo<ModoArchivos>[] = [
  {
    id: "convertir",
    slug: "convertidor",
    nombre: "Convertir",
    nota: "DXF ↔ SVG, STEP ↔ STL ↔ OBJ y escalar",
    icono: (
      <>
        <path d="M8 14h20l-5-5M32 26H12l5 5" />
      </>
    ),
  },
  {
    id: "anidar",
    slug: "anidado-piezas",
    nombre: "Anidar",
    nota: "Acomodar piezas en hojas",
    icono: (
      <>
        <rect x="5" y="7" width="30" height="26" rx="1" />
        <rect x="8" y="10" width="11" height="9" />
        <rect x="21" y="10" width="11" height="14" />
        <rect x="8" y="21" width="11" height="9" />
      </>
    ),
  },
  {
    id: "rebanar",
    slug: "rebanado-capas",
    nombre: "Rebanar",
    nota: "Modelo 3D en capas para cortar",
    icono: (
      <>
        <path d="M8 30h24M10 25h20M12 20h16M14 15h12M16 10h8" />
      </>
    ),
  },
  {
    id: "extruir",
    slug: "svg-a-stl",
    nombre: "A 3D",
    nota: "SVG o DXF a STL con altura",
    icono: (
      <>
        <path d="M8 26l12-6 12 6-12 6z" />
        <path d="M8 26v-10l12-6 12 6v10M20 20v12" />
      </>
    ),
  },
]

export function GeneradorArchivos({ modoInicial = "convertir" }: { modoInicial?: ModoArchivos }) {
  const [modo, setModo] = useState<ModoArchivos>(modoInicial)
  const cabecera = <SelectorModos titulo="Archivos" modos={MODOS} modo={modo} cambiar={setModo} />
  if (modo === "rebanar") return <GeneradorRebanado cabecera={cabecera} />
  // las demás tienen su propia pantalla: se pintan con el tema oscuro del estudio
  return (
    <div className="tema-estudio flex-1">
      {modo === "anidar" ? <GeneradorAnidado cabecera={cabecera} /> : modo === "extruir" ? <GeneradorExtruir cabecera={cabecera} /> : <GeneradorConvertidor cabecera={cabecera} />}
    </div>
  )
}
