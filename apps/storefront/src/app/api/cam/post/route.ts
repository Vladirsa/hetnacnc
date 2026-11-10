// CAM Studio 3D: POST /api/cam/post -- el posprocesador de 3, 4 y 5 ejes.
//
// El laboratorio calcula y simula la trayectoria en el navegador, pero el
// programa (el G-code, y los posprocesadores para Fusion y Vectric) se arma
// aquí. Así el candado del plan es real: lo que hay en el navegador no alcanza
// para sacar el programa.
//
// Al revisar se devuelve sólo el arranque del programa y cuántas líneas tiene.
// Con `descargar` se entrega completo, si el plan lo incluye y queda cupo en
// el mes (lib/cam/cupo-servidor.ts): 3 ejes cuenta como "3d"; con ejes
// rotativos, como "multieje".
//
// El motor es el mismo JavaScript del laboratorio (cinemática en
// public/cam-lab/lab-01-motor.js, posprocesadores en cam-servidor/), corrido
// en un contexto aparte por petición.
import { readFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import vm from "node:vm"
import { gunzip } from "node:zlib"
import { NextResponse } from "next/server"

import { autorizarDescarga, huella } from "@/lib/cam/cupo-servidor"

export const dynamic = "force-dynamic"

const MAX_COMPRIMIDO = 12 * 1024 * 1024
const MAX_BYTES = 40 * 1024 * 1024
const MAX_MOVIMIENTOS = 600_000
const MAX_ESTADO = 60_000
const LINEAS_DE_VISTA = 80
const descomprimir = promisify(gunzip)
const EJES_ROTATIVOS: Record<string, number> = { xyz: 0, xyza: 1, ab_mixed: 2, ac_table: 2, bc_table: 2, bc_head: 2 }

// Los dos archivos del motor, compilados una vez por proceso
let motor: Promise<vm.Script[]> | null = null
function cargarMotor() {
  motor ??= Promise.all(
    [path.join(process.cwd(), "public", "cam-lab", "lab-01-motor.js"), path.join(process.cwd(), "cam-servidor", "lab-03-posprocesadores.js")].map(async (f) => new vm.Script(await readFile(f, "utf-8"), { filename: path.basename(f) }))
  ).catch((e) => {
    motor = null
    throw e
  })
  return motor
}

// Corre dentro del contexto del motor: arma el estado y los movimientos y posprocesa
const CORRER = new vm.Script(`(function (e) {
  const s = e.estado;
  if (!s || !s.post || !s.machine || !s.tool || !CTRL[s.post.ctrl] || !KIN_AXES[s.machine.kin]) throw new Error("entrada");
  // fresas del trabajo: la principal va primero; cada movimiento trae el índice de la suya
  const tls = Array.isArray(s.tools) && s.tools.length && s.tools.length <= 8 && s.tools.every(function (t) { return t && typeof t === "object"; }) ? s.tools : [s.tool];
  if (tls[0].id !== s.tool.id) throw new Error("entrada");
  S.machine = s.machine; S.tools = tls; S.toolId = s.tool.id;
  Object.assign(S.feeds, s.feeds); Object.assign(S.strat, s.strat); Object.assign(S.post, s.post);
  S.stock = s.stock; S.zero = s.zero; S.partName = String(s.partName || "pieza").slice(0, 80);
  if (e.clase === "cps") return genCPS();
  if (e.clase === "pp") return genPP();
  if (!S.stock) throw new Error("entrada");
  const m = S.machine, tcp = useTCP(), rot = KIN_AXES[m.kin].length, n = e.n, moves = new Array(n);
  if (rot !== e.rot) throw new Error("entrada");
  let prev = null;
  for (let i = 0; i < n; i++) {
    const p = [e.P[i * 3], e.P[i * 3 + 1], e.P[i * 3 + 2]], ang = [];
    for (let q = 0; q < rot; q++) ang.push(e.A[i * rot + q]);
    const k = kinMats(m.kin, ang), f = e.T[i];
    const tl = tls[f >> 3] || tls[0];
    const mv = { p, ang, R: k.R, ha: k.ha, t: "RPF"[f & 3] || "F", kfail: !!(f & 4), len: prev ? V.dist(prev, p) : 0, tid: tl.id };
    mv.pm = linearOut(mv, m, tl, tcp); moves[i] = mv; prev = p;
  }
  S.moves = moves;
  return postProcess().text;
})`)

const mal = (mensaje: string, status = 400) => NextResponse.json({ ok: false, mensaje }, { status })

export async function POST(req: Request) {
  let crudo: Buffer
  try {
    const cuerpo = Buffer.from(await req.arrayBuffer())
    if (cuerpo.length > MAX_COMPRIMIDO) return mal("El trabajo es demasiado grande para posprocesarlo. Sube el paso lateral o simplifica la pieza.", 413)
    crudo = await descomprimir(cuerpo, { maxOutputLength: MAX_BYTES })
  } catch {
    return mal("No se pudo leer el trabajo. Vuelve a calcular la trayectoria.")
  }

  // Formato: [uint32 largo del JSON][JSON][Float32 x,y,z por movimiento][Float64 ángulos][Uint8 tipo]
  let cab: { clase?: string; descargar?: boolean; n?: number; rot?: number; estado?: unknown }
  let P: Float32Array, A: Float64Array, T: Uint8Array
  try {
    const largo = crudo.readUInt32LE(0)
    if (largo > MAX_ESTADO) throw new Error("estado")
    cab = JSON.parse(crudo.subarray(4, 4 + largo).toString("utf-8"))
    const n = Number(cab.n) | 0
    const rot = Number(cab.rot) | 0
    if (n < 0 || n > MAX_MOVIMIENTOS || rot < 0 || rot > 2) throw new Error("n")
    let o = 4 + largo
    const trozo = (bytes: number) => {
      if (o + bytes > crudo.length) throw new Error("corto")
      const b = crudo.buffer.slice(crudo.byteOffset + o, crudo.byteOffset + o + bytes)
      o += bytes
      return b
    }
    P = new Float32Array(trozo(n * 12))
    A = new Float64Array(trozo(n * rot * 8))
    T = new Uint8Array(trozo(n))
    cab.n = n
    cab.rot = rot
  } catch {
    return mal("El trabajo llegó incompleto. Vuelve a calcular la trayectoria.")
  }
  const clase = cab.clase === "cps" || cab.clase === "pp" ? cab.clase : "gcode"
  if (clase === "gcode" && !cab.n) return mal("No hay trayectoria que posprocesar.")

  let texto: string
  try {
    const scripts = await cargarMotor()
    const contexto = vm.createContext({ location: { search: "" }, window: {}, console, URLSearchParams, performance })
    for (const s of scripts) s.runInContext(contexto, { timeout: 5000 })
    const correr = CORRER.runInContext(contexto) as (e: unknown) => string
    texto = vm.runInContext("f(e)", Object.assign(contexto, { f: correr, e: { estado: cab.estado, clase, n: cab.n, rot: cab.rot, P, A, T } }), { timeout: 25_000 })
  } catch (e) {
    const m = e instanceof Error ? e.message : ""
    if (m !== "entrada") console.error("[cam] falló el posprocesado 3D", e)
    return mal(m === "entrada" ? "Los datos de máquina o de controlador no son válidos. Recarga el laboratorio." : "No se pudo armar el programa. Vuelve a calcular la trayectoria.", m === "entrada" ? 400 : 500)
  }
  if (typeof texto !== "string" || !texto) return mal("No se pudo armar el programa.", 500)

  const lineas = texto.split("\n")
  if (!cab.descargar) {
    return NextResponse.json({ ok: true, vista: lineas.slice(0, LINEAS_DE_VISTA).join("\n"), total: lineas.length, kb: Math.round(texto.length / 102.4) / 10 })
  }
  // Los ejes salen de la máquina declarada, no de lo que diga el navegador
  const kin = String((cab.estado as { machine?: { kin?: unknown } })?.machine?.kin)
  const multieje = (EJES_ROTATIVOS[kin] ?? 2) > 0
  const no = await autorizarDescarga(multieje ? "multieje" : "3d", huella(texto))
  if (no) return NextResponse.json(no.negado, { status: no.status })
  return NextResponse.json({ ok: true, texto, total: lineas.length })
}
