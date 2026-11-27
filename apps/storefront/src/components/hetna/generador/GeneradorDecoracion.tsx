"use client"

// Decoración (2D Studio): relojes de pared, marcos y portarretratos, y
// lámparas por capas en una sola herramienta. Las tres son piezas decorativas
// para regalo o venta. Cada modo es la herramienta de antes tal cual (mismo
// motor y mismos archivos). Las direcciones viejas siguen vivas y abren su modo.
import dynamic from "next/dynamic"
import { useState } from "react"

import { SelectorModos, type Modo } from "./SelectorModos"
// Cada modo se baja sólo cuando se abre (antes se bajaban todos juntos)
const GeneradorEsferas = dynamic(() => import("./GeneradorEsferas").then((x) => x.GeneradorEsferas))
const GeneradorLamparas = dynamic(() => import("./GeneradorLamparas").then((x) => x.GeneradorLamparas))
const GeneradorMarcos = dynamic(() => import("./GeneradorMarcos").then((x) => x.GeneradorMarcos))
const GeneradorRelojes = dynamic(() => import("./GeneradorRelojes").then((x) => x.GeneradorRelojes))
const GeneradorRelojPalabras = dynamic(() => import("./GeneradorRelojPalabras").then((x) => x.GeneradorRelojPalabras))
const GeneradorMapaTopo = dynamic(() => import("./GeneradorMapaTopo").then((x) => x.GeneradorMapaTopo))


export type ModoDecoracion = "reloj" | "marco" | "lampara" | "esfera" | "palabras" | "mapa"

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
  {
    id: "esfera",
    slug: "esferas-navidad",
    nombre: "Esfera con nombre",
    nota: "Adornos navideños, uno por nombre",
    icono: (
      <>
        <circle cx="20" cy="23" r="12" />
        <path d="M16 11h8V8h-8zM20 8V5M8 21h24M8 26h24" />
      </>
    ),
  },
  {
    id: "palabras",
    slug: "reloj-palabras",
    nombre: "Reloj de palabras",
    nota: "La hora escrita con letras",
    icono: (
      <>
        <rect x="6" y="6" width="28" height="28" rx="2" />
        <path d="M11 13h7M22 13h7M11 20h18M11 27h10" />
      </>
    ),
  },
  {
    id: "mapa",
    slug: "mapa-topografico",
    nombre: "Mapa topográfico",
    nota: "Montañas reales por capas",
    icono: (
      <>
        <path d="M4 32l10-16 7 10 5-7 10 13z" />
        <path d="M10 25c4 2 8 2 12 0" />
      </>
    ),
  },
]

export function GeneradorDecoracion({ modoInicial = "reloj" }: { modoInicial?: ModoDecoracion }) {
  const [modo, setModo] = useState<ModoDecoracion>(modoInicial)
  const cabecera = <SelectorModos titulo="Decoración" modos={MODOS} modo={modo} cambiar={setModo} />
  if (modo === "marco") return <GeneradorMarcos cabecera={cabecera} />
  if (modo === "lampara") return <GeneradorLamparas cabecera={cabecera} />
  if (modo === "esfera") return <GeneradorEsferas cabecera={cabecera} />
  if (modo === "palabras") return <GeneradorRelojPalabras cabecera={cabecera} />
  if (modo === "mapa") return <GeneradorMapaTopo cabecera={cabecera} />
  return <GeneradorRelojes cabecera={cabecera} />
}
