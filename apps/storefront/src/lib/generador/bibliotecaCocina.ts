// Biblioteca de gabinetes de cocina y muebles de melamina para la casa
// (libreros, roperos, cómodas, burós…): cada modelo es una receta del
// asistente de gabinete (gabinete.ts) con sus medidas de inicio; el cliente las
// cambia y lo abre en el editor.

import { GABINETE_INICIO, type OpcionesGabinete, type TipoGabinete } from "./gabinete"

export type ModeloCocina = {
  id: string
  nombre: string
  grupo: "Bajos" | "Altos" | "Columnas" | "Casa"
  base: TipoGabinete
  medidas: { ancho: number; alto: number; fondo: number }
  receta: Partial<Omit<OpcionesGabinete, "grosor" | "gFrente" | "ancho" | "alto" | "fondo">>
}

export const MODELOS_COCINA: ModeloCocina[] = [
  { id: "bajo-1p", nombre: "Bajo 1 puerta", grupo: "Bajos", base: "bajo", medidas: { ancho: 450, alto: 720, fondo: 560 }, receta: { frente: "puerta", repisas: 1 } },
  { id: "bajo-2p", nombre: "Bajo 2 puertas", grupo: "Bajos", base: "bajo", medidas: { ancho: 800, alto: 720, fondo: 560 }, receta: { frente: "puertas", repisas: 1 } },
  { id: "bajo-cajon-puertas", nombre: "Bajo cajón y puertas", grupo: "Bajos", base: "bajo", medidas: { ancho: 800, alto: 720, fondo: 560 }, receta: { frente: "cajon-puertas", repisas: 1 } },
  { id: "cajonera-3", nombre: "Cajonera 3 cajones", grupo: "Bajos", base: "bajo", medidas: { ancho: 600, alto: 720, fondo: 560 }, receta: { frente: "cajones", cajones: 3 } },
  { id: "cajonera-4", nombre: "Cajonera 4 cajones", grupo: "Bajos", base: "bajo", medidas: { ancho: 450, alto: 720, fondo: 560 }, receta: { frente: "cajones", cajones: 4 } },
  { id: "fregadero", nombre: "Fregadero", grupo: "Bajos", base: "bajo", medidas: { ancho: 800, alto: 720, fondo: 560 }, receta: { frente: "puertas", fondoTipo: "sin", techo: "travesanos", repisas: 0 } },
  { id: "esquinero", nombre: "Esquinero ciego", grupo: "Bajos", base: "bajo", medidas: { ancho: 1000, alto: 720, fondo: 560 }, receta: { frente: "esquinero", repisas: 1 } },
  { id: "abierto-bajo", nombre: "Bajo abierto (repisas)", grupo: "Bajos", base: "bajo", medidas: { ancho: 300, alto: 720, fondo: 560 }, receta: { frente: "nada", repisas: 2, techo: "completo" } },
  { id: "alto-1p", nombre: "Alto 1 puerta", grupo: "Altos", base: "alto", medidas: { ancho: 400, alto: 720, fondo: 320 }, receta: { frente: "puerta", repisas: 2 } },
  { id: "alto-2p", nombre: "Alto 2 puertas", grupo: "Altos", base: "alto", medidas: { ancho: 800, alto: 720, fondo: 320 }, receta: { frente: "puertas", repisas: 2 } },
  { id: "alto-abatible", nombre: "Alto abatible", grupo: "Altos", base: "alto", medidas: { ancho: 800, alto: 360, fondo: 320 }, receta: { frente: "abatible", repisas: 0 } },
  { id: "alto-abierto", nombre: "Alto abierto (especiero)", grupo: "Altos", base: "alto", medidas: { ancho: 300, alto: 720, fondo: 320 }, receta: { frente: "nada", repisas: 3 } },
  { id: "alacena", nombre: "Alacena 2 puertas", grupo: "Columnas", base: "columna", medidas: { ancho: 600, alto: 2100, fondo: 560 }, receta: { frente: "puertas", repisas: 4 } },
  { id: "columna-cajones", nombre: "Columna de cajones", grupo: "Columnas", base: "columna", medidas: { ancho: 600, alto: 2100, fondo: 560 }, receta: { frente: "cajones", cajones: 6 } },
  // Muebles de la casa (melamina): mismas reglas de carpintería que la cocina.
  { id: "librero-abierto", nombre: "Librero abierto", grupo: "Casa", base: "columna", medidas: { ancho: 800, alto: 1800, fondo: 300 }, receta: { frente: "nada", repisas: 4, zoclo: 60, zocloRemetido: 20 } },
  { id: "librero-puertas", nombre: "Librero con puertas", grupo: "Casa", base: "columna", medidas: { ancho: 800, alto: 1800, fondo: 350 }, receta: { frente: "puertas", repisas: 4, zoclo: 60, zocloRemetido: 20 } },
  { id: "ropero-2p", nombre: "Ropero 2 puertas", grupo: "Casa", base: "columna", medidas: { ancho: 900, alto: 2000, fondo: 580 }, receta: { frente: "puertas", repisas: 3, zoclo: 80, zocloRemetido: 30 } },
  { id: "comoda-4", nombre: "Cómoda 4 cajones", grupo: "Casa", base: "bajo", medidas: { ancho: 800, alto: 900, fondo: 450 }, receta: { frente: "cajones", cajones: 4, techo: "completo", zoclo: 60, zocloRemetido: 20 } },
  { id: "buro-2", nombre: "Buró 2 cajones", grupo: "Casa", base: "bajo", medidas: { ancho: 450, alto: 550, fondo: 400 }, receta: { frente: "cajones", cajones: 2, techo: "completo", zoclo: 50, zocloRemetido: 20 } },
  { id: "zapatera", nombre: "Zapatera 2 puertas", grupo: "Casa", base: "bajo", medidas: { ancho: 800, alto: 1000, fondo: 350 }, receta: { frente: "puertas", repisas: 3, techo: "completo", zoclo: 60, zocloRemetido: 20 } },
  { id: "centro-tv", nombre: "Mueble de TV", grupo: "Casa", base: "bajo", medidas: { ancho: 1200, alto: 500, fondo: 420 }, receta: { frente: "nada", repisas: 1, techo: "completo", zoclo: 60, zocloRemetido: 20 } },
  { id: "repisa-pared", nombre: "Repisa de pared", grupo: "Casa", base: "alto", medidas: { ancho: 900, alto: 300, fondo: 250 }, receta: { frente: "nada", repisas: 0 } },
  { id: "sobre-refri", nombre: "Alto sobre refrigerador", grupo: "Altos", base: "alto", medidas: { ancho: 900, alto: 400, fondo: 560 }, receta: { frente: "puertas", repisas: 0 } },
]

export function opcionesModelo(m: ModeloCocina, medidas: { ancho: number; alto: number; fondo: number }, grosor: number): OpcionesGabinete {
  return { ...GABINETE_INICIO[m.base], ...m.receta, ...medidas, grosor, gFrente: grosor }
}
