"use client"

// Carga sólo la herramienta que se abre. Si las 15 se nombraran en la página
// del servidor, Next las metería todas en el paquete del navegador (506 kB).
import dynamic from "next/dynamic"

const GeneradorAnidado = dynamic(() => import("@/components/hetna/generador/GeneradorAnidado").then((m) => m.GeneradorAnidado))
const GeneradorCaja = dynamic(() => import("@/components/hetna/generador/GeneradorCaja").then((m) => m.GeneradorCaja))
const GeneradorConvertidor = dynamic(() => import("@/components/hetna/generador/GeneradorConvertidor").then((m) => m.GeneradorConvertidor))
const GeneradorEmpaques = dynamic(() => import("@/components/hetna/generador/GeneradorEmpaques").then((m) => m.GeneradorEmpaques))
const GeneradorExtruir = dynamic(() => import("@/components/hetna/generador/GeneradorExtruir").then((m) => m.GeneradorExtruir))
const GeneradorGrabado = dynamic(() => import("@/components/hetna/generador/GeneradorGrabado").then((m) => m.GeneradorGrabado))
const GeneradorLetrero = dynamic(() => import("@/components/hetna/generador/GeneradorLetrero").then((m) => m.GeneradorLetrero))
const GeneradorLetras3D = dynamic(() => import("@/components/hetna/generador/GeneradorLetras3D").then((m) => m.GeneradorLetras3D))
const GeneradorLlaveros = dynamic(() => import("@/components/hetna/generador/GeneradorLlaveros").then((m) => m.GeneradorLlaveros))
const GeneradorMueble = dynamic(() => import("@/components/hetna/generador/GeneradorMueble").then((m) => m.GeneradorMueble))
const GeneradorPatron = dynamic(() => import("@/components/hetna/generador/GeneradorPatron").then((m) => m.GeneradorPatron))
const GeneradorRelieve = dynamic(() => import("@/components/hetna/generador/GeneradorRelieve").then((m) => m.GeneradorRelieve))
const GeneradorRompecabezas = dynamic(() => import("@/components/hetna/generador/GeneradorRompecabezas").then((m) => m.GeneradorRompecabezas))
const GeneradorVectorizador = dynamic(() => import("@/components/hetna/generador/GeneradorVectorizador").then((m) => m.GeneradorVectorizador))

const GENERADORES: Record<string, React.ComponentType> = {
  "caja-con-juntas": GeneradorCaja,
  letreros: GeneradorLetrero,
  "letras-3d": GeneradorLetras3D,
  llaveros: GeneradorLlaveros,
  rompecabezas: GeneradorRompecabezas,
  vectorizador: GeneradorVectorizador,
  "despiece-muebles": GeneradorMueble,
  "plantillas-empaque": GeneradorEmpaques,
  "grabado-foto": GeneradorGrabado,
  "litofania-relieve": GeneradorRelieve,
  "patrones-radiales": GeneradorPatron,
  convertidor: GeneradorConvertidor,
  "svg-a-stl": GeneradorExtruir,
  "anidado-piezas": GeneradorAnidado,
}

export const HAY_HERRAMIENTA = new Set(Object.keys(GENERADORES))

export function Herramienta({ slug }: { slug: string }) {
  const G = GENERADORES[slug]
  return G ? <G /> : null
}
