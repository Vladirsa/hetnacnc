import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { archivosDe } from "../../../cam-multipart"

// Tipos propios en lugar de `typeof import("occt-import-js")`: el paquete es
// opcional y no siempre está instalado. Con el import de tipos, cualquier
// compilación que llegue a este archivo (por ejemplo el panel del taller, que
// revisa los tipos de las rutas) fallaba con "Cannot find module".
type OcctMalla = {
  attributes: { position: { array: ArrayLike<number> } }
  index: { array: ArrayLike<number> & Iterable<number> }
}
type OcctResultado = { success: boolean; meshes?: OcctMalla[] }
type Occt = {
  ReadStepFile: (contenido: Uint8Array, params: unknown) => OcctResultado
  ReadIgesFile: (contenido: Uint8Array, params: unknown) => OcctResultado
}
type OcctInit = () => Promise<Occt>
// En una variable para que el compilador no intente resolver el paquete
const PAQUETE_OCCT = "occt-import-js"

/**
 * OpenCascade (occt-import-js) es opcional: el CAM Lab convierte STEP / IGES
 * en el navegador y solo usa esta ruta si el navegador no pudo. Si el paquete
 * no está instalado en el servidor, la ruta responde 501 y el resto sigue.
 */
async function cargarOcct(): Promise<Occt | null> {
  try {
    const mod = (await import(PAQUETE_OCCT)) as { default?: OcctInit } | OcctInit
    const init = (typeof mod === "function" ? mod : mod.default) as OcctInit
    return await init()
  } catch {
    return null
  }
}

let occtPromise: Promise<Occt | null> | null = null
let running = 0
const MAX_CONCURRENT = Number(process.env.CAM_CONVERT_CONCURRENCY || 2)
const MAX_TRIANGLES = 2_000_000

/**
 * POST /store/cam/convert
 * Convierte STEP o IGES a triángulos en el servidor (OpenCascade). El CAM Lab
 * lo usa cuando el navegador no puede hacer la conversión por sí mismo.
 * Responde { positions: base64(Float32Array), triangles }.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const file = archivosDe(req).file?.[0]
  if (!file) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Falta el archivo")
  }
  const ext = file.originalname.split(".").pop()?.toLowerCase()
  if (!ext || !["step", "stp", "iges", "igs"].includes(ext)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Solo se convierten archivos STEP o IGES; STL y OBJ se leen directo en el navegador"
    )
  }
  if (running >= MAX_CONCURRENT) {
    res.status(429).json({ message: "El convertidor está ocupado, intenta de nuevo en unos segundos" })
    return
  }

  running++
  try {
    occtPromise ??= cargarOcct()
    const occt = await occtPromise
    if (!occt) {
      occtPromise = null
      res.status(501).json({
        message: "La conversión de STEP en el servidor no está activa. Exporta tu pieza como STL e intenta de nuevo.",
      })
      return
    }
    const params = {
      linearUnit: "millimeter",
      linearDeflectionType: "bounding_box_ratio",
      linearDeflection: 0.001,
      angularDeflection: 0.5,
    }
    const content = new Uint8Array(file.buffer)
    const result = ext === "step" || ext === "stp" ? occt.ReadStepFile(content, params) : occt.ReadIgesFile(content, params)
    if (!result?.success || !result.meshes?.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "El archivo no contiene sólidos legibles")
    }

    let count = 0
    for (const mesh of result.meshes) {
      count += mesh.index.array.length
    }
    if (count / 3 > MAX_TRIANGLES) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "La pieza genera demasiados triángulos; simplifícala o exporta con menor resolución"
      )
    }
    const positions = new Float32Array(count * 3)
    let offset = 0
    for (const mesh of result.meshes) {
      const p = mesh.attributes.position.array
      for (const idx of mesh.index.array) {
        positions[offset++] = p[idx * 3]
        positions[offset++] = p[idx * 3 + 1]
        positions[offset++] = p[idx * 3 + 2]
      }
    }

    res.json({
      triangles: count / 3,
      positions: Buffer.from(positions.buffer).toString("base64"),
    })
  } finally {
    running--
  }
}
