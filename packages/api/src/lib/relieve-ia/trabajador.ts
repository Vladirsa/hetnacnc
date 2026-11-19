// Proceso aparte que calcula la profundidad de una foto con Depth Anything V2
// Small (licencia Apache-2.0). Lo lanza servicio.ts con prioridad baja, para
// que la tienda gane el procesador, y se cierra solo cuando lleva rato sin uso.
//
// Recibe por IPC (serialization "advanced"):
//   { id, ancho, alto, rgb: Uint8Array }   ancho y alto múltiplos de 14
// Responde:
//   { id, ok: true, ancho, alto, profundidad: Uint16Array }   cerca = 65535
//   { id, ok: false, error }
// El modelo se carga en el primer pedido. Un solo hilo de cálculo.
/* eslint-disable @typescript-eslint/no-var-requires */
type Pedido = { id: number; ancho: number; alto: number; rgb: Uint8Array }

const MEDIA = [0.485, 0.456, 0.406]
const DESV = [0.229, 0.224, 0.225]
const modelo = process.env.RELIEVE_IA_MODELO || ""

let sesion: any = null
async function abrir() {
  if (sesion) return sesion
  const ort = require("onnxruntime-node")
  sesion = await ort.InferenceSession.create(modelo, { intraOpNumThreads: 1, interOpNumThreads: 1, graphOptimizationLevel: "all" })
  return sesion
}

/** Valores del modelo (más grande = más cerca) a 0–65535, recortando el 1 % de cada extremo. */
export function normalizar(v: Float32Array): Uint16Array {
  const orden = Float32Array.from(v).sort()
  const bajo = orden[Math.floor((orden.length - 1) * 0.01)]
  const alto = orden[Math.floor((orden.length - 1) * 0.99)]
  const rango = alto - bajo || 1
  const out = new Uint16Array(v.length)
  for (let i = 0; i < v.length; i++) out[i] = Math.round(Math.max(0, Math.min(1, (v[i] - bajo) / rango)) * 65535)
  return out
}

/** RGB intercalado a tensor 1×3×alto×ancho normalizado como el preprocesador del modelo. */
export function aTensor(rgb: Uint8Array, ancho: number, alto: number): Float32Array {
  const n = ancho * alto
  const t = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) t[c * n + i] = (rgb[i * 3 + c] / 255 - MEDIA[c]) / DESV[c]
  }
  return t
}

async function calcular(p: Pedido) {
  const ort = require("onnxruntime-node")
  const s = await abrir()
  const entrada = new ort.Tensor("float32", aTensor(p.rgb, p.ancho, p.alto), [1, 3, p.alto, p.ancho])
  const salida = await s.run({ [s.inputNames[0]]: entrada })
  const d = salida[s.outputNames[0]]
  const [alto, ancho] = d.dims.slice(-2)
  return { ancho, alto, profundidad: normalizar(d.data as Float32Array) }
}

if (require.main === module && process.send) {
  process.on("message", async (p: Pedido) => {
    try {
      const r = await calcular(p)
      process.send!({ id: p.id, ok: true, ...r })
    } catch (e) {
      process.send!({ id: p.id, ok: false, error: (e as Error).message })
    }
  })
  process.on("disconnect", () => process.exit(0))
}
