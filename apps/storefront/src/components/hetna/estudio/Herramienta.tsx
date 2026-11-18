"use client"

// Carga sólo la herramienta que se abre. Si las 15 se nombraran en la página
// del servidor, Next las metería todas en el paquete del navegador (506 kB).
import dynamic from "next/dynamic"

const GeneradorCaja = dynamic(() => import("@/components/hetna/generador/GeneradorCaja").then((m) => m.GeneradorCaja))
const GeneradorEmpaques = dynamic(() => import("@/components/hetna/generador/GeneradorEmpaques").then((m) => m.GeneradorEmpaques))
// letreros, esténcil y código QR: una sola herramienta con modos
const GeneradorLetrerosPlacas = dynamic(() => import("@/components/hetna/generador/GeneradorLetrerosPlacas").then((m) => m.GeneradorLetrerosPlacas))
// Imagen (vectorizador + grabado + relieve) y Archivos (convertidor + anidado + rebanado + SVG a STL)
const GeneradorImagen = dynamic(() => import("@/components/hetna/generador/GeneradorImagen").then((m) => m.GeneradorImagen))
const GeneradorArchivos = dynamic(() => import("@/components/hetna/generador/GeneradorArchivos").then((m) => m.GeneradorArchivos))
const MODO_IMAGEN: Record<string, "vectorizar" | "grabado" | "relieve"> = { vectorizador: "vectorizar", "grabado-foto": "grabado", "litofania-relieve": "relieve" }
const MODO_ARCHIVOS: Record<string, "convertir" | "anidar" | "rebanar" | "extruir"> = { convertidor: "convertir", "anidado-piezas": "anidar", "rebanado-capas": "rebanar", "svg-a-stl": "extruir" }
// relojes, marcos y lámparas: Decoración
const GeneradorDecoracion = dynamic(() => import("@/components/hetna/generador/GeneradorDecoracion").then((m) => m.GeneradorDecoracion))
const MODO_DECORACION: Record<string, "reloj" | "marco" | "lampara" | "esfera"> = { relojes: "reloj", "marcos-portarretratos": "marco", "lamparas-capas": "lampara", "esferas-navidad": "esfera" }
// rompecabezas y engranes: Juegos y mecanismos
const GeneradorJuegos = dynamic(() => import("@/components/hetna/generador/GeneradorJuegos").then((m) => m.GeneradorJuegos))
const MODO_JUEGOS: Record<string, "rompecabezas" | "engranes"> = { rompecabezas: "rompecabezas", engranes: "engranes" }
const MODO_LETRERO: Record<string, "letrero" | "estencil" | "qr"> = { letreros: "letrero", "estencil-letras": "estencil", "codigo-qr": "qr" }
const GeneradorLetras3D = dynamic(() => import("@/components/hetna/generador/GeneradorLetras3D").then((m) => m.GeneradorLetras3D))
const GeneradorLlaveros = dynamic(() => import("@/components/hetna/generador/GeneradorLlaveros").then((m) => m.GeneradorLlaveros))
const GeneradorMueble = dynamic(() => import("@/components/hetna/generador/GeneradorMueble").then((m) => m.GeneradorMueble))
// celosías, patrones radiales y bisagra viva: una sola herramienta con modos
const GeneradorPatronesCorte = dynamic(() => import("@/components/hetna/generador/GeneradorPatronesCorte").then((m) => m.GeneradorPatronesCorte))
const MODO_PATRON: Record<string, "celosia" | "radial" | "bisagra"> = { celosias: "celosia", "patrones-radiales": "radial", "bisagra-viva": "bisagra" }
// el organizador de cajón ahora es un tipo de caja (separadores)
const GeneradorOrganizador = dynamic(() => import("@/components/hetna/generador/GeneradorCaja").then((m) => m.GeneradorOrganizadorCaja))

const GENERADORES: Record<string, React.ComponentType> = {
  "caja-con-juntas": GeneradorCaja,
  "letras-3d": GeneradorLetras3D,
  llaveros: GeneradorLlaveros,
  "despiece-muebles": GeneradorMueble,
  "plantillas-empaque": GeneradorEmpaques,
  "organizador-cajon": GeneradorOrganizador,
}

export const HAY_HERRAMIENTA = new Set([...Object.keys(GENERADORES), ...Object.keys(MODO_PATRON), ...Object.keys(MODO_LETRERO), ...Object.keys(MODO_IMAGEN), ...Object.keys(MODO_ARCHIVOS), ...Object.keys(MODO_DECORACION), ...Object.keys(MODO_JUEGOS)])

export function Herramienta({ slug }: { slug: string }) {
  if (MODO_PATRON[slug]) return <GeneradorPatronesCorte modoInicial={MODO_PATRON[slug]} />
  if (MODO_LETRERO[slug]) return <GeneradorLetrerosPlacas modoInicial={MODO_LETRERO[slug]} />
  if (MODO_IMAGEN[slug]) return <GeneradorImagen modoInicial={MODO_IMAGEN[slug]} />
  if (MODO_ARCHIVOS[slug]) return <GeneradorArchivos modoInicial={MODO_ARCHIVOS[slug]} />
  if (MODO_DECORACION[slug]) return <GeneradorDecoracion modoInicial={MODO_DECORACION[slug]} />
  if (MODO_JUEGOS[slug]) return <GeneradorJuegos modoInicial={MODO_JUEGOS[slug]} />
  const G = GENERADORES[slug]
  return G ? <G /> : null
}
