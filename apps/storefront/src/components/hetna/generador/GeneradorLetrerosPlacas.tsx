"use client"

// Letreros y placas (2D Studio): letreros, esténcil y código QR en una sola
// herramienta. Las tres son "texto (o un QR) sobre una placa" y comparten las
// tipografías. Cada modo es la herramienta de antes tal cual (mismo motor y
// mismos archivos). Las direcciones viejas siguen vivas y abren su modo.
import dynamic from "next/dynamic"
import { useState } from "react"

import { SelectorModos, type Modo } from "./SelectorModos"
// Cada modo se baja sólo cuando se abre (antes se bajaban todos juntos)
const GeneradorEstencil = dynamic(() => import("./GeneradorEstencil").then((x) => x.GeneradorEstencil))
const GeneradorLetrero = dynamic(() => import("./GeneradorLetrero").then((x) => x.GeneradorLetrero))
const GeneradorQR = dynamic(() => import("./GeneradorQR").then((x) => x.GeneradorQR))


export type ModoLetrero = "letrero" | "estencil" | "qr"

const MODOS: Modo<ModoLetrero>[] = [
  {
    id: "letrero",
    slug: "letreros",
    nombre: "Letrero",
    nota: "Nombres y letreros recortados o sobre placa",
    icono: (
      <>
        <rect x="4" y="11" width="32" height="18" rx="3" />
        <path d="M10 24l3-9 3 9M11 21h4M20 15v9h4M28 15v9" />
      </>
    ),
  },
  {
    id: "estencil",
    slug: "estencil-letras",
    nombre: "Esténcil",
    nota: "Plantillas con puentes para pintar",
    icono: (
      <>
        <rect x="4" y="9" width="32" height="22" rx="2" />
        <path d="M12 15a4 4 0 1 0 0 10M12 15v3M12 22v3M24 15h6M27 15v4M27 22v3" />
      </>
    ),
  },
  {
    id: "qr",
    slug: "codigo-qr",
    nombre: "Código QR",
    nota: "QR para grabar en placas y mesas",
    icono: (
      <>
        <rect x="6" y="6" width="11" height="11" />
        <rect x="23" y="6" width="11" height="11" />
        <rect x="6" y="23" width="11" height="11" />
        <path d="M23 23h4v4h-4zM30 30h4v4h-4zM23 31h3M31 23v3" />
      </>
    ),
  },
]

export function GeneradorLetrerosPlacas({ modoInicial = "letrero" }: { modoInicial?: ModoLetrero }) {
  const [modo, setModo] = useState<ModoLetrero>(modoInicial)
  const cabecera = <SelectorModos titulo="Letreros y placas" modos={MODOS} modo={modo} cambiar={setModo} />

  if (modo === "estencil") return <GeneradorEstencil cabecera={cabecera} />
  if (modo === "qr") return <GeneradorQR cabecera={cabecera} />
  // el letrero tiene su propia pantalla (vista de lo que la fresa no alcanza);
  // se pinta con el tema oscuro común del estudio
  return (
    <div className="tema-estudio flex-1">
      <GeneradorLetrero cabecera={cabecera} />
    </div>
  )
}
