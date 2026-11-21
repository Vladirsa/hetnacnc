// Profundidad con IA para el generador de relieves (hetnacnc.com/mx/disenar/litofania-relieve).
//
// La tienda y la IA comparten un servidor de 2 núcleos, así que:
//   · la IA corre en un proceso aparte (trabajador.ts) con prioridad baja (nice 15);
//   · una foto a la vez, con una fila corta (si está llena, "ocupado");
//   · el proceso se cierra tras 10 minutos sin uso y libera la memoria (~500 MB);
//   · la foto llega ya reducida desde el navegador (lado corto ≈ 518 px) y no se guarda.
//
// Modelo: Depth Anything V2 Small en ONNX (Apache-2.0), en RELIEVE_IA_MODELO o
// ~/.hetna/modelos/depth-anything-v2-small.onnx. Lo baja scripts/desplegar.sh.
// Sin modelo o sin onnxruntime-node, disponible() es false y la página sigue con
// el relieve por brillo.
import { type ChildProcess, spawn } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

export const MODELO = () => process.env.RELIEVE_IA_MODELO || path.join(os.homedir(), ".hetna", "modelos", "depth-anything-v2-small.onnx")
export const LADO_MIN = 140
export const LADO_MAX = 1036
const FILA_MAX = 3
const TIEMPO_MAX = 45_000
const INACTIVO = 10 * 60_000

export class ErrorRelieve extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje)
  }
}

const archivoTrabajador = () => path.join(__dirname, "trabajador.js")

// Se recuerda sólo el "sí". Un "no" se vuelve a revisar cada minuto: si la API
// arrancó a media instalación de dependencias (durante un despliegue), antes se
// quedaba con "no disponible" hasta el siguiente reinicio.
let motorOk = false
let revisadoEn = 0
function motorInstalado() {
  if (motorOk) return true
  if (Date.now() - revisadoEn < 60_000) return false
  revisadoEn = Date.now()
  try {
    require.resolve("onnxruntime-node")
    motorOk = true
  } catch {
    motorOk = false
  }
  return motorOk
}

/** Por qué no está disponible (o null si sí lo está). Sin rutas ni datos sensibles. */
export function motivoNoDisponible(): "apagado" | "sin_motor" | "sin_modelo" | "sin_trabajador" | null {
  if (process.env.RELIEVE_IA === "0") return "apagado"
  if (!motorInstalado()) return "sin_motor"
  if (!fs.existsSync(MODELO())) return "sin_modelo"
  if (!fs.existsSync(archivoTrabajador())) return "sin_trabajador"
  return null
}

export const disponible = () => motivoNoDisponible() === null

/** Revisa que la foto venga con las medidas que espera el modelo. */
export function validar(ancho: number, alto: number, bytes: number) {
  const ok = (n: number) => Number.isInteger(n) && n >= LADO_MIN && n <= LADO_MAX && n % 14 === 0
  if (!ok(ancho) || !ok(alto)) throw new ErrorRelieve(400, `Medidas no válidas: deben ser múltiplos de 14 entre ${LADO_MIN} y ${LADO_MAX} px.`)
  if (bytes !== ancho * alto * 3) throw new ErrorRelieve(400, "La imagen no coincide con sus medidas.")
}

type Resultado = { ancho: number; alto: number; profundidad: Uint16Array }
type Tarea = { ancho: number; alto: number; rgb: Uint8Array; resolver: (r: Resultado) => void; rechazar: (e: Error) => void }

let hijo: ChildProcess | null = null
let enCurso: (Tarea & { id: number; reloj: NodeJS.Timeout }) | null = null
const fila: Tarea[] = []
let siguienteId = 1
let apagado: NodeJS.Timeout | null = null

function cerrarHijo() {
  if (hijo) {
    hijo.removeAllListeners()
    try { hijo.kill() } catch {}
  }
  hijo = null
}

function lanzar(): ChildProcess {
  const h = spawn(process.execPath, [archivoTrabajador()], {
    stdio: ["ignore", "inherit", "inherit", "ipc"],
    serialization: "advanced",
    env: { ...process.env, RELIEVE_IA_MODELO: MODELO(), OMP_NUM_THREADS: "1" },
  })
  try { if (h.pid) os.setPriority(h.pid, 15) } catch {}
  h.on("message", (m: any) => {
    if (!enCurso || m?.id !== enCurso.id) return
    const t = enCurso
    enCurso = null
    clearTimeout(t.reloj)
    if (m.ok) t.resolver({ ancho: m.ancho, alto: m.alto, profundidad: m.profundidad })
    else t.rechazar(new ErrorRelieve(500, "La IA no pudo procesar la foto."))
    siguiente()
  })
  h.on("exit", () => {
    hijo = null
    if (enCurso) {
      const t = enCurso
      enCurso = null
      clearTimeout(t.reloj)
      t.rechazar(new ErrorRelieve(503, "La IA se reinició. Intenta de nuevo."))
      siguiente()
    }
  })
  return h
}

function siguiente() {
  if (enCurso) return
  const t = fila.shift()
  if (!t) {
    if (apagado) clearTimeout(apagado)
    apagado = setTimeout(cerrarHijo, INACTIVO)
    apagado.unref?.()
    return
  }
  if (apagado) { clearTimeout(apagado); apagado = null }
  if (!hijo) hijo = lanzar()
  const id = siguienteId++
  const reloj = setTimeout(() => {
    // tardó demasiado: se reinicia el proceso (el "exit" rechaza la tarea)
    cerrarHijo()
    if (enCurso?.id === id) {
      const x = enCurso
      enCurso = null
      x.rechazar(new ErrorRelieve(504, "La IA tardó demasiado. Intenta con otra foto."))
      siguiente()
    }
  }, TIEMPO_MAX)
  enCurso = { ...t, id, reloj }
  hijo.send({ id, ancho: t.ancho, alto: t.alto, rgb: t.rgb })
}

/** Profundidad de una foto ya reducida (RGB intercalado). Cerca = 65535. */
export function profundidad(ancho: number, alto: number, rgb: Uint8Array): Promise<Resultado> {
  if (!disponible()) return Promise.reject(new ErrorRelieve(503, "La profundidad con IA no está disponible en este momento."))
  validar(ancho, alto, rgb.length)
  if (fila.length >= FILA_MAX) return Promise.reject(new ErrorRelieve(503, "La IA está ocupada. Intenta de nuevo en unos segundos."))
  return new Promise((resolver, rechazar) => {
    fila.push({ ancho, alto, rgb, resolver, rechazar })
    siguiente()
  })
}

/** Sólo para pruebas: cuántos pedidos esperan y si hay uno en curso. */
export const _estado = () => ({ fila: fila.length, enCurso: Boolean(enCurso), hijo: Boolean(hijo) })
