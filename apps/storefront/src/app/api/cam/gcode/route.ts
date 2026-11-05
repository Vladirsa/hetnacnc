// Laboratorio CAM, flujo 1: subir un DXF y bajar el G-code, sin cuenta.
//
// Vive en el storefront y no en el backend de Medusa a propósito: este es el
// camino anónimo. Todo lo demás de la plataforma (cotizador, escaneos) exige
// sesión porque guarda cosas en el perfil del taller; aquí no se guarda nada,
// y pedir cuenta antes de que alguien compruebe que el producto sirve es la
// forma más barata de perderlo.
//
// El motor es Python (infra/cam/bridges/dxf_gcode.py, ver su README). Se
// lanza como subproceso en vez de reimplementarlo en TypeScript: está
// verificado contra geometría real y portarlo sería reescribir código probado
// para ganar nada.
import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { NextResponse } from "next/server"

// CAM_PYTHON apunta al intérprete que tiene ezdxf y shapely instalados (ver
// infra/cam/requirements.txt). Sin él, esta ruta responde que el motor no
// está disponible en vez de tronar: es el "si un bridge falta, ese camino se
// apaga y el resto sigue" del patrón.
const PYTHON = process.env.CAM_PYTHON || "python3"
const BRIDGE =
  process.env.CAM_BRIDGE_DXF || path.join(process.cwd(), "..", "..", "infra", "cam", "bridges", "dxf_gcode.py")
// CAM Studio 2D (fase B): el mismo motor, pero por operaciones (cajeado,
// grabado en V, barrenado, láser...). Vive junto al primero.
const BRIDGE_OPS = path.join(path.dirname(BRIDGE), "cam2d.py")
const MAX_CONFIG = 20_000

// Un DXF de corte rara vez pasa de unos cientos de KB. 4 MB deja margen de
// sobra y corta de tajo el archivo equivocado.
const MAX_BYTES = 4 * 1024 * 1024
const TIMEOUT_MS = 30_000

const MATERIALES = ["mdf", "acrilico", "pino", "encino", "aluminio"]

type Respuesta = { ok: true; plan: Record<string, unknown>; gcode: string } | { ok: false; [k: string]: unknown }

function fallo(categoria: string, mensaje: string, remedio: string, status = 400) {
  return NextResponse.json(
    { ok: false, categoria, mensaje, remedio, reintentable: false },
    { status }
  )
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fallo("entrada_invalida", "No se pudo leer el archivo.", "Vuelve a elegirlo e intenta de nuevo.")
  }

  const archivo = form.get("dxf")
  if (!(archivo instanceof Blob)) {
    return fallo("entrada_invalida", "Falta el archivo DXF.", "Elige el archivo que quieres cortar.")
  }
  if (archivo.size > MAX_BYTES) {
    return fallo(
      "fuera_de_rango",
      "El archivo pesa más de 4 MB.",
      "Un DXF de corte casi nunca pasa de unos cientos de KB. Revisa que no traiga imágenes o sombreados dentro."
    )
  }

  const material = String(form.get("material") || "")
  if (!MATERIALES.includes(material)) {
    return fallo("entrada_invalida", "Material no reconocido.", "Elige uno de la lista.")
  }

  // Con "config" (JSON con máquina y operaciones) se usa el motor por
  // operaciones; sin él, el flujo de siempre (corte de contorno).
  const textoConfig = form.get("config")
  if (typeof textoConfig === "string" && textoConfig.trim()) {
    if (textoConfig.length > MAX_CONFIG) {
      return fallo("fuera_de_rango", "Son demasiadas operaciones.", "Usa 20 o menos.")
    }
    let config: Record<string, unknown>
    try {
      config = JSON.parse(textoConfig)
    } catch {
      return fallo("entrada_invalida", "No se pudieron leer las operaciones.", "Recarga la página e intenta de nuevo.")
    }
    const espesorOps = Number(form.get("espesor"))
    if (!Number.isFinite(espesorOps) || espesorOps <= 0 || espesorOps > 200) {
      return fallo("entrada_invalida", "El espesor del material no es válido.", "Captúralo en milímetros, entre 0.5 y 200.")
    }
    return conOperaciones(archivo, { ...config, material, espesor: espesorOps })
  }

  const diametro = Number(form.get("diametro"))
  const espesor = Number(form.get("espesor"))
  if (!Number.isFinite(diametro) || diametro <= 0 || diametro > 25) {
    return fallo("entrada_invalida", "El diámetro de la fresa no es válido.", "Captúralo en milímetros, entre 0.5 y 25.")
  }
  if (!Number.isFinite(espesor) || espesor <= 0 || espesor > 200) {
    return fallo("entrada_invalida", "El espesor del material no es válido.", "Captúralo en milímetros, entre 0.5 y 200.")
  }

  const carpeta = await mkdtemp(path.join(tmpdir(), "hetna-cam-"))
  const entrada = path.join(carpeta, "pieza.dxf")
  const salida = path.join(carpeta, "pieza.nc")

  try {
    await writeFile(entrada, Buffer.from(await archivo.arrayBuffer()))

    const resultado = await correrBridge([entrada, salida, material, String(diametro), String(espesor)])

    if (!resultado.ok) {
      // El bridge ya devuelve el contrato completo (categoria, mensaje,
      // remedio); se pasa tal cual para no perder el remedio por el camino.
      return NextResponse.json(resultado, { status: 422 })
    }

    const gcode = await readFile(salida, "utf-8")
    return NextResponse.json({ ok: true, plan: (resultado as any).plan, gcode })
  } catch (e) {
    console.error("[cam] falló la generación de G-code", e)
    return fallo(
      "fallo_de_ejecucion",
      "No se pudo generar el G-code.",
      "Vuelve a intentarlo. Si sigue fallando, escríbenos y revisamos tu archivo.",
      500
    )
  } finally {
    await rm(carpeta, { recursive: true, force: true }).catch(() => {})
  }
}

async function conOperaciones(archivo: Blob, config: Record<string, unknown>) {
  const carpeta = await mkdtemp(path.join(tmpdir(), "hetna-cam-"))
  const entrada = path.join(carpeta, "pieza.dxf")
  const salida = path.join(carpeta, "pieza.nc")
  const rutaConfig = path.join(carpeta, "config.json")
  try {
    await writeFile(entrada, Buffer.from(await archivo.arrayBuffer()))
    await writeFile(rutaConfig, JSON.stringify(config))
    const resultado = await correrBridge([entrada, salida, rutaConfig], BRIDGE_OPS)
    if (!resultado.ok) return NextResponse.json(resultado, { status: 422 })
    const gcode = await readFile(salida, "utf-8")
    return NextResponse.json({ ok: true, plan: (resultado as any).plan, gcode })
  } catch (e) {
    console.error("[cam] falló la generación por operaciones", e)
    return fallo(
      "fallo_de_ejecucion",
      "No se pudo generar el G-code.",
      "Vuelve a intentarlo. Si sigue fallando, escríbenos y revisamos tu archivo.",
      500
    )
  } finally {
    await rm(carpeta, { recursive: true, force: true }).catch(() => {})
  }
}

function correrBridge(args: string[], bridge = BRIDGE): Promise<Respuesta> {
  return new Promise((resolve) => {
    const proceso = spawn(PYTHON, [bridge, ...args], { timeout: TIMEOUT_MS })
    let salida = ""
    let errores = ""

    proceso.stdout.on("data", (d) => (salida += d))
    proceso.stderr.on("data", (d) => (errores += d))

    proceso.on("error", (e) => {
      // El intérprete no existe o no es ejecutable: el motor no está
      // instalado en este servidor.
      console.error("[cam] no se pudo lanzar el motor", e)
      resolve({
        ok: false,
        categoria: "no_disponible",
        mensaje: "El generador de G-code no está disponible en este momento.",
        remedio: "Inténtalo más tarde. Ya estamos enterados.",
        reintentable: true,
      })
    })

    proceso.on("close", (codigo) => {
      try {
        resolve(JSON.parse(salida))
      } catch {
        console.error(`[cam] el motor salió con ${codigo}:`, errores.slice(-800))
        resolve({
          ok: false,
          categoria: "fallo_de_ejecucion",
          mensaje: "El motor no pudo procesar el archivo.",
          remedio: "Vuelve a exportar el DXF desde tu programa de dibujo e intenta otra vez.",
          reintentable: true,
        })
      }
    })
  })
}
