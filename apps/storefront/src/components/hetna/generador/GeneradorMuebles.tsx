"use client"

// Muebles (2D Studio): mueble desde una imagen o del catálogo (con IA), cocina
// integral (biblioteca de gabinetes prefabricados que se ajustan a la medida) y
// molduras y tallados, y costillas desde imagen (pared paramétrica o banca).
// Cada modo conserva su dirección (/disenar/costillas-desde-imagen la de costillas):
// /disenar/muebles-desde-imagen, /disenar/despiece-muebles (cocina) y
// /disenar/molduras-tallados. /disenar/muebles-ensamble (el exhibidor sin
// tornillos) abre Desde una imagen: el exhibidor está en su catálogo.
import dynamic from "next/dynamic"
import { useState } from "react"

import { SelectorModos, type Modo } from "./SelectorModos"
// Cada modo se baja sólo cuando se abre (antes se bajaban todos juntos)
const GeneradorCostillas = dynamic(() => import("./GeneradorCostillas").then((x) => x.GeneradorCostillas))
const GeneradorMolduras = dynamic(() => import("./GeneradorMolduras").then((x) => x.GeneradorMolduras))
const GeneradorTableros = dynamic(() => import("./GeneradorTableros").then((x) => x.GeneradorTableros))


export type ModoMuebles = "imagen" | "cocina" | "molduras" | "costillas"

const MODOS: Modo<ModoMuebles>[] = [
  {
    id: "imagen",
    slug: "muebles-desde-imagen",
    nombre: "Desde una imagen",
    nota: "Cualquier mueble de tablero, con IA, o del catálogo",
    icono: (
      <>
        <rect x="5" y="7" width="30" height="24" rx="3" />
        <path d="M5 25l9-8 7 6 5-4 9 7" />
        <circle cx="27" cy="14" r="2.5" />
      </>
    ),
  },
  {
    id: "cocina",
    slug: "despiece-muebles",
    nombre: "Cocina y muebles de melamina",
    nota: "Gabinetes, libreros, roperos y cómodas a tu medida",
    icono: (
      <>
        <rect x="5" y="18" width="30" height="16" rx="1.5" />
        <path d="M20 18v16M5 22h30M8 6h24v8H8z" />
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
    id: "costillas",
    slug: "costillas-desde-imagen",
    nombre: "Costillas desde imagen",
    nota: "Pared paramétrica o banca de tablas que siguen tu imagen",
    icono: <path d="M8 34V14c0-3 2-5 4-5s4 2 4 5v20M18 34V8c0-2 2-4 4-4s4 2 4 4v26M28 34V16c0-3 2-5 4-5s4 2 4 5v18" />,
  },
]

export function GeneradorMuebles({ modoInicial = "imagen" }: { modoInicial?: ModoMuebles }) {
  const [modo, setModo] = useState<ModoMuebles>(modoInicial)
  const cabecera = <SelectorModos titulo="Muebles" modos={MODOS} modo={modo} cambiar={setModo} />
  if (modo === "molduras") return <GeneradorMolduras cabecera={cabecera} />
  if (modo === "costillas") return <GeneradorCostillas cabecera={cabecera} />
  // key: cada enfoque arranca con su propio mueble de inicio
  return <GeneradorTableros key={modo} cabecera={cabecera} enfoque={modo === "cocina" ? "cocina" : "imagen"} />
}
