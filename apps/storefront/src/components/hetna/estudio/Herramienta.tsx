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
const GeneradorRelieve = dynamic(() => import("@/components/hetna/generador/GeneradorRelieve").then((m) => m.GeneradorRelieve))
const GeneradorRompecabezas = dynamic(() => import("@/components/hetna/generador/GeneradorRompecabezas").then((m) => m.GeneradorRompecabezas))
// celosías, patrones radiales y bisagra viva: una sola herramienta con modos
const GeneradorPatronesCorte = dynamic(() => import("@/components/hetna/generador/GeneradorPatronesCorte").then((m) => m.GeneradorPatronesCorte))
const MODO_PATRON: Record<string, "celosia" | "radial" | "bisagra"> = { celosias: "celosia", "patrones-radiales": "radial", "bisagra-viva": "bisagra" }
const GeneradorQR = dynamic(() => import("@/components/hetna/generador/GeneradorQR").then((m) => m.GeneradorQR))
const GeneradorRebanado = dynamic(() => import("@/components/hetna/generador/GeneradorRebanado").then((m) => m.GeneradorRebanado))
const GeneradorEngranes = dynamic(() => import("@/components/hetna/generador/GeneradorEngranes").then((m) => m.GeneradorEngranes))
const GeneradorRelojes = dynamic(() => import("@/components/hetna/generador/GeneradorRelojes").then((m) => m.GeneradorRelojes))
// el organizador de cajón ahora es un tipo de caja (separadores)
const GeneradorOrganizador = dynamic(() => import("@/components/hetna/generador/GeneradorCaja").then((m) => m.GeneradorOrganizadorCaja))
const GeneradorLamparas = dynamic(() => import("@/components/hetna/generador/GeneradorLamparas").then((m) => m.GeneradorLamparas))
const GeneradorEstencil = dynamic(() => import("@/components/hetna/generador/GeneradorEstencil").then((m) => m.GeneradorEstencil))
const GeneradorMarcos = dynamic(() => import("@/components/hetna/generador/GeneradorMarcos").then((m) => m.GeneradorMarcos))
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
  convertidor: GeneradorConvertidor,
  "svg-a-stl": GeneradorExtruir,
  "anidado-piezas": GeneradorAnidado,
  "codigo-qr": GeneradorQR,
  "rebanado-capas": GeneradorRebanado,
  engranes: GeneradorEngranes,
  relojes: GeneradorRelojes,
  "organizador-cajon": GeneradorOrganizador,
  "lamparas-capas": GeneradorLamparas,
  "estencil-letras": GeneradorEstencil,
  "marcos-portarretratos": GeneradorMarcos,
}

export const HAY_HERRAMIENTA = new Set([...Object.keys(GENERADORES), ...Object.keys(MODO_PATRON)])

export function Herramienta({ slug }: { slug: string }) {
  if (MODO_PATRON[slug]) return <GeneradorPatronesCorte modoInicial={MODO_PATRON[slug]} />
  const G = GENERADORES[slug]
  return G ? <G /> : null
}
