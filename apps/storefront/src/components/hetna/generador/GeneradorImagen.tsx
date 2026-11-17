"use client"

// Imagen (2D Studio): vectorizador, foto a grabado y litofanía/relieve en una
// sola herramienta. Las tres empiezan igual (subes una foto) y después eliges
// qué sacar: vectores para cortar, grabado para láser o relieve en 3D. Cada
// modo es la herramienta de antes tal cual. Las direcciones viejas siguen
// vivas y abren su modo.
import { useState } from "react"

import { GeneradorGrabado } from "./GeneradorGrabado"
import { GeneradorRelieve } from "./GeneradorRelieve"
import { GeneradorVectorizador } from "./GeneradorVectorizador"
import { SelectorModos, type Modo } from "./SelectorModos"

export type ModoImagen = "vectorizar" | "grabado" | "relieve"

const MODOS: Modo<ModoImagen>[] = [
  {
    id: "vectorizar",
    slug: "vectorizador",
    nombre: "Vectorizar",
    nota: "Foto o logo a vectores para cortar",
    icono: (
      <>
        <path d="M8 32c6-2 9-8 11-14M32 8c-8 2-12 7-13 10" />
        <circle cx="8" cy="32" r="3" />
        <circle cx="32" cy="8" r="3" />
      </>
    ),
  },
  {
    id: "grabado",
    slug: "grabado-foto",
    nombre: "Grabado",
    nota: "Foto lista para grabar en láser",
    icono: (
      <>
        <rect x="5" y="8" width="30" height="24" rx="2" />
        <path d="M5 26l9-8 7 6 5-4 9 7" />
        <circle cx="27" cy="15" r="2.5" />
      </>
    ),
  },
  {
    id: "relieve",
    slug: "litofania-relieve",
    nombre: "Relieve 3D",
    nota: "Litofanía y relieve en STL",
    icono: (
      <>
        <path d="M5 28l8-10 6 6 6-9 10 13z" />
        <path d="M5 28v4h30v-4" />
      </>
    ),
  },
]

export function GeneradorImagen({ modoInicial = "vectorizar" }: { modoInicial?: ModoImagen }) {
  const [modo, setModo] = useState<ModoImagen>(modoInicial)
  const cabecera = <SelectorModos titulo="Imagen" modos={MODOS} modo={modo} cambiar={setModo} />
  if (modo === "vectorizar") return <GeneradorVectorizador cabecera={cabecera} />
  // grabado y relieve tienen su propia pantalla: se pintan con el tema oscuro del estudio
  return <div className="tema-estudio flex-1">{modo === "grabado" ? <GeneradorGrabado cabecera={cabecera} /> : <GeneradorRelieve cabecera={cabecera} />}</div>
}
