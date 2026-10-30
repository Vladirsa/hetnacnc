// Registro de calculadoras: cada proceso con sus modos y sus presets de máquina.
import type { Calculadora, Preset } from "./comun"
import { IMPRESION3D, PRESETS_3D } from "./impresion3d"
import { CO2, PRESETS_CO2 } from "./laser-co2"
import { FIBRA_CORTE, FIBRA_MARCADO, PRESETS_FIBRA, PRESETS_FIBRA_CORTE } from "./laser-fibra"
import { PLASMA, PRESETS_PLASMA } from "./plasma"
import { PRESETS_ROUTER, REVISAR_ROUTER, ROUTER } from "./router"

export type Proceso = {
  id: string
  nombre: string
  corto: string
  texto: string
  icono: string
  modos: Calculadora[]
  presets: Preset[]
  presetEtiqueta: string
}

export const PROCESOS: Proceso[] = [
  { id: "router", nombre: "Router CNC y fresadora", corto: "Router CNC", texto: "Madera, plásticos, compuestos, aluminio y acero: RPM, avance, pasadas, potencia y deflexión.", icono: "router", modos: [ROUTER, REVISAR_ROUTER], presets: PRESETS_ROUTER, presetEtiqueta: "Tu máquina" },
  { id: "laser_co2", nombre: "Láser CO₂", corto: "Láser CO₂", texto: "Del K40 al tubo de 300 W y RF: corte, grabado y marcado con velocidad, potencia, foco y pasadas.", icono: "laser", modos: [CO2], presets: PRESETS_CO2, presetEtiqueta: "Tu tubo" },
  { id: "fibra", nombre: "Fibra y UV: marcado", corto: "Fibra / UV", texto: "Marcado, negro, color y grabado profundo en metal; plásticos, vidrio y PCB con UV.", icono: "fibra", modos: [FIBRA_MARCADO], presets: PRESETS_FIBRA, presetEtiqueta: "Tu fuente" },
  { id: "fibra_corte", nombre: "Corte por fibra", corto: "Corte fibra", texto: "Lámina de acero, inoxidable, aluminio, latón y galvanizado de 1 a 12 kW: velocidad, gas, boquilla y foco.", icono: "lamina", modos: [FIBRA_CORTE], presets: PRESETS_FIBRA_CORTE, presetEtiqueta: "Tu fuente" },
  { id: "plasma", nombre: "Plasma CNC", corto: "Plasma", texto: "Velocidad, alturas, voltaje de arco, kerf y perforación por amperaje y espesor.", icono: "plasma", modos: [PLASMA], presets: PRESETS_PLASMA, presetEtiqueta: "Tu amperaje" },
  { id: "impresion3d", nombre: "Impresión 3D", corto: "Impresión 3D", texto: "FDM y resina: temperaturas, velocidad real, tiempo, material, costo y precio de venta.", icono: "impresora", modos: [IMPRESION3D], presets: PRESETS_3D, presetEtiqueta: "Tu impresora" },
]

export const procesoPorId = (id?: string) => PROCESOS.find((p) => p.id === id) || PROCESOS[0]
