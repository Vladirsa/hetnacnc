"use client"

// Llaveros y placas (3D Studio): llaveros con nombre, etiquetas en braille y
// etiquetas para cajas organizadoras en una sola herramienta con modos.
import dynamic from "next/dynamic"
import { useState } from "react"

import { SelectorModos, type Modo } from "./SelectorModos"
const GeneradorLlaveros = dynamic(() => import("./GeneradorLlaveros").then((x) => x.GeneradorLlaveros))
const GeneradorPlacas3D = dynamic(() => import("./GeneradorPlacas3D").then((x) => x.GeneradorPlacas3D))

export type ModoLlaveroPlaca = "llavero" | "braille" | "etiqueta"

const MODOS: Modo<ModoLlaveroPlaca>[] = [
  {
    id: "llavero",
    slug: "llaveros",
    nombre: "Llavero",
    nota: "Llaveros, placas y adornos con nombre",
    icono: (
      <>
        <rect x="6" y="12" width="28" height="16" rx="4" />
        <circle cx="11" cy="20" r="2" />
        <path d="M17 24l2-8 2 8M24 16v8h4" />
      </>
    ),
  },
  {
    id: "braille",
    slug: "etiquetas-braille",
    nombre: "Braille",
    nota: "Placas con puntos en relieve",
    icono: (
      <>
        <rect x="5" y="10" width="30" height="20" rx="3" />
        <circle cx="13" cy="15" r="1.6" />
        <circle cx="13" cy="20" r="1.6" />
        <circle cx="18" cy="15" r="1.6" />
        <circle cx="25" cy="20" r="1.6" />
        <circle cx="25" cy="25" r="1.6" />
        <circle cx="30" cy="15" r="1.6" />
      </>
    ),
  },
  {
    id: "etiqueta",
    slug: "etiquetas-cajas",
    nombre: "Etiqueta",
    nota: "Para cajas, cajones y Gridfinity",
    icono: (
      <>
        <rect x="4" y="14" width="32" height="12" rx="2" />
        <path d="M9 20h3M15 18v4M18 18h5M20.5 18v4M26 18v4h3" />
      </>
    ),
  },
]

export function GeneradorLlaverosPlacas({ modoInicial = "llavero" }: { modoInicial?: ModoLlaveroPlaca }) {
  const [modo, setModo] = useState<ModoLlaveroPlaca>(modoInicial)
  const cabecera = <SelectorModos titulo="Llaveros y placas" modos={MODOS} modo={modo} cambiar={setModo} />
  if (modo === "llavero") return <GeneradorLlaveros cabecera={cabecera} />
  return <GeneradorPlacas3D key={modo} modo={modo} cabecera={cabecera} />
}
