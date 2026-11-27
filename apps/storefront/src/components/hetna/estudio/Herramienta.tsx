"use client"

// Carga sólo la herramienta que se abre. Si las 15 se nombraran en la página
// del servidor, Next las metería todas en el paquete del navegador (506 kB).
import dynamic from "next/dynamic"

import type { ModoArchivos } from "@/components/hetna/generador/GeneradorArchivos"
import type { ModoDecoracion } from "@/components/hetna/generador/GeneradorDecoracion"
import type { ModoImagen } from "@/components/hetna/generador/GeneradorImagen"
import type { ModoLetrero } from "@/components/hetna/generador/GeneradorLetrerosPlacas"
import type { ModoLlaveroPlaca } from "@/components/hetna/generador/GeneradorLlaverosPlacas"

const GeneradorCaja = dynamic(() => import("@/components/hetna/generador/GeneradorCaja").then((m) => m.GeneradorCaja))
const GeneradorEmpaques = dynamic(() => import("@/components/hetna/generador/GeneradorEmpaques").then((m) => m.GeneradorEmpaques))
// letreros, esténcil y código QR: una sola herramienta con modos
const GeneradorLetrerosPlacas = dynamic(() => import("@/components/hetna/generador/GeneradorLetrerosPlacas").then((m) => m.GeneradorLetrerosPlacas))
// Imagen (vectorizador + grabado + relieve) y Archivos (convertidor + anidado + rebanado + SVG a STL)
const GeneradorImagen = dynamic(() => import("@/components/hetna/generador/GeneradorImagen").then((m) => m.GeneradorImagen))
const GeneradorArchivos = dynamic(() => import("@/components/hetna/generador/GeneradorArchivos").then((m) => m.GeneradorArchivos))
const MODO_IMAGEN: Record<string, ModoImagen> = { vectorizador: "vectorizar", "grabado-foto": "grabado", "litofania-relieve": "relieve", "organizador-herramientas": "organizador" }
const MODO_ARCHIVOS: Record<string, ModoArchivos> = { convertidor: "convertir", "anidado-piezas": "anidar", "rebanado-capas": "rebanar", "svg-a-stl": "extruir", "pruebas-maquina": "pruebas", "desarrollo-lamina": "lamina" }
// relojes, marcos y lámparas: Decoración
const GeneradorDecoracion = dynamic(() => import("@/components/hetna/generador/GeneradorDecoracion").then((m) => m.GeneradorDecoracion))
const MODO_DECORACION: Record<string, ModoDecoracion> = { relojes: "reloj", "marcos-portarretratos": "marco", "lamparas-capas": "lampara", "esferas-navidad": "esfera", "reloj-palabras": "palabras", "mapa-topografico": "mapa" }
// rompecabezas y engranes: Juegos y mecanismos
const GeneradorJuegos = dynamic(() => import("@/components/hetna/generador/GeneradorJuegos").then((m) => m.GeneradorJuegos))
const MODO_JUEGOS: Record<string, "rompecabezas" | "engranes"> = { rompecabezas: "rompecabezas", engranes: "engranes" }
const MODO_LETRERO: Record<string, ModoLetrero> = { letreros: "letrero", "estencil-letras": "estencil", "codigo-qr": "qr", "placa-redonda": "redonda", incrustaciones: "incrustacion" }
const GeneradorLetras3D = dynamic(() => import("@/components/hetna/generador/GeneradorLetras3D").then((m) => m.GeneradorLetras3D))
const GeneradorCortadores = dynamic(() => import("@/components/hetna/generador/GeneradorCortadores").then((m) => m.GeneradorCortadores))
const GeneradorTexturizador = dynamic(() => import("@/components/hetna/generador/GeneradorTexturizador").then((m) => m.GeneradorTexturizador))
// llaveros, etiquetas en braille y etiquetas para cajas: Llaveros y placas
const GeneradorLlaverosPlacas = dynamic(() => import("@/components/hetna/generador/GeneradorLlaverosPlacas").then((m) => m.GeneradorLlaverosPlacas))
const MODO_LLAVERO: Record<string, ModoLlaveroPlaca> = { llaveros: "llavero", "etiquetas-braille": "braille", "etiquetas-cajas": "etiqueta" }
const GeneradorModelos3D = dynamic(() => import("@/components/hetna/generador/GeneradorModelos3D").then((m) => m.GeneradorModelos3D))
const GeneradorPartir3D = dynamic(() => import("@/components/hetna/generador/GeneradorPartir3D").then((m) => m.GeneradorPartir3D))
const GeneradorMoldes = dynamic(() => import("@/components/hetna/generador/GeneradorMoldes").then((m) => m.GeneradorMoldes))
const GeneradorMuebles = dynamic(() => import("@/components/hetna/generador/GeneradorMuebles").then((m) => m.GeneradorMuebles))
// desde imagen, ensamble sin tornillos y despiece de gabinetes: Muebles
const MODO_MUEBLES: Record<string, "imagen" | "cocina" | "molduras" | "costillas"> = { "muebles-desde-imagen": "imagen", "molduras-tallados": "molduras", "costillas-desde-imagen": "costillas", "muebles-ensamble": "imagen", "despiece-muebles": "cocina" }
// Patrones de corte (desde imagen, celosía, Voronoi, radial, bisagra): una sola herramienta con modos
const GeneradorPatronesCorte = dynamic(() => import("@/components/hetna/generador/GeneradorPatronesCorte").then((m) => m.GeneradorPatronesCorte))
const MODO_PATRON: Record<string, "imagen" | "celosia" | "voronoi" | "radial" | "bisagra"> = { "celosia-desde-imagen": "imagen", celosias: "celosia", "patron-voronoi": "voronoi", "patrones-radiales": "radial", "bisagra-viva": "bisagra" }
// el organizador de cajón ahora es un tipo de caja (separadores)
const GeneradorOrganizador = dynamic(() => import("@/components/hetna/generador/GeneradorCaja").then((m) => m.GeneradorOrganizadorCaja))

const GENERADORES: Record<string, React.ComponentType> = {
  "caja-con-juntas": GeneradorCaja,
  "letras-3d": GeneradorLetras3D,
  texturizador: GeneradorTexturizador,
  "cortadores-galletas": GeneradorCortadores,
  "plantillas-empaque": GeneradorEmpaques,
  "organizador-cajon": GeneradorOrganizador,
  "partir-3d": GeneradorPartir3D,
  "moldes-3d": GeneradorMoldes,
  "modelos-3d": GeneradorModelos3D,
}

export const HAY_HERRAMIENTA = new Set([...Object.keys(GENERADORES), ...Object.keys(MODO_PATRON), ...Object.keys(MODO_LETRERO), ...Object.keys(MODO_IMAGEN), ...Object.keys(MODO_ARCHIVOS), ...Object.keys(MODO_DECORACION), ...Object.keys(MODO_JUEGOS), ...Object.keys(MODO_MUEBLES), ...Object.keys(MODO_LLAVERO)])

export function Herramienta({ slug }: { slug: string }) {
  if (MODO_PATRON[slug]) return <GeneradorPatronesCorte modoInicial={MODO_PATRON[slug]} />
  if (MODO_LETRERO[slug]) return <GeneradorLetrerosPlacas modoInicial={MODO_LETRERO[slug]} />
  if (MODO_IMAGEN[slug]) return <GeneradorImagen modoInicial={MODO_IMAGEN[slug]} />
  if (MODO_ARCHIVOS[slug]) return <GeneradorArchivos modoInicial={MODO_ARCHIVOS[slug]} />
  if (MODO_DECORACION[slug]) return <GeneradorDecoracion modoInicial={MODO_DECORACION[slug]} />
  if (MODO_JUEGOS[slug]) return <GeneradorJuegos modoInicial={MODO_JUEGOS[slug]} />
  if (MODO_MUEBLES[slug]) return <GeneradorMuebles modoInicial={MODO_MUEBLES[slug]} />
  if (MODO_LLAVERO[slug]) return <GeneradorLlaverosPlacas modoInicial={MODO_LLAVERO[slug]} />
  const G = GENERADORES[slug]
  return G ? <G /> : null
}
