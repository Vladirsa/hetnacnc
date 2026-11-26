// Servicios con precio "desde" que publica un taller o diseñador en su perfil
// (decisión del dueño, 26 nov 2026, opción B): por ejemplo
//   «Vectorizar logo para corte · desde $350 · 2 días hábiles».
// No se compran en el carrito: el botón «Pedir cotización» abre una solicitud
// directa a quien lo publica (el flujo de solicitudes que ya existe, con el
// pago protegido dentro de HETNA). Salen en el perfil del taller y en las
// páginas de servicio de Diseño 2D/3D y Programación CAM.
//
// Se guardan en seller.metadata.paquetes (la tienda ya lee la metadata pública
// del taller). Sin datos de contacto: todo el trato va dentro de HETNA.
import { randomBytes } from "crypto"

import { revisarMensaje } from "./chat-filtro"
import { subir } from "./fabrica"
import { leerSTL, simplificar, stlBinario, stlDe } from "./vista-3d-auto"

export const CATEGORIAS_PAQUETE = {
  "diseno-2d-3d": "Diseño 2D / 3D",
  "programacion-cam": "Programación CAM",
  otro: "Otro servicio",
} as const
export type CategoriaPaquete = keyof typeof CATEGORIAS_PAQUETE
export const MAX_PAQUETES = 12

export type Paquete = {
  id: string
  titulo: string
  desde: number
  entrega_dias: number | null
  descripcion: string
  categoria: CategoriaPaquete
  // Muestra 3D simplificada que sube el diseñador (POST /vendor/hetna-paquetes/modelo):
  // el cliente la gira antes de pedir cotización. Nunca es el archivo original.
  modelo_3d: string | null
}

// Sólo las muestras que generó HETNA (modelo3d-….stl en el almacenamiento público)
export const MODELO_VALIDO = /^https:\/\/[^\s"'<>]+\/[^\/\s"'<>]*modelo3d-[A-Za-z0-9_-]+\.stl(\?[^\s"'<>]*)?$/

export class ErrorPaquete extends Error {}

const limpio = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)

/** Valida y limpia la lista que manda el panel. Lanza ErrorPaquete con un mensaje para el taller. */
export function normalizarPaquetes(entrada: unknown): Paquete[] {
  if (!Array.isArray(entrada)) throw new ErrorPaquete("Lista no válida.")
  if (entrada.length > MAX_PAQUETES) throw new ErrorPaquete(`Puedes publicar hasta ${MAX_PAQUETES} servicios.`)
  return entrada.map((x: any, i) => {
    const titulo = limpio(x?.titulo, 80)
    const descripcion = String(x?.descripcion ?? "").trim().slice(0, 600)
    const desde = Math.round(Number(x?.desde))
    const dias = x?.entrega_dias === "" || x?.entrega_dias == null ? null : Math.round(Number(x.entrega_dias))
    const categoria = (x?.categoria in CATEGORIAS_PAQUETE ? x.categoria : "otro") as CategoriaPaquete
    const n = `Servicio ${i + 1}`
    if (titulo.length < 5) throw new ErrorPaquete(`${n}: escribe un nombre (por ejemplo «Vectorizar logo para corte»).`)
    if (!(desde >= 50 && desde <= 1_000_000)) throw new ErrorPaquete(`${n}: el precio «desde» debe ser de $50 a $1,000,000.`)
    if (dias !== null && !(dias >= 1 && dias <= 120)) throw new ErrorPaquete(`${n}: los días de entrega van de 1 a 120.`)
    for (const t of [titulo, descripcion]) {
      // Los números largos sí pasan (medidas, referencias); correos, redes y ligas no
      if (t && revisarMensaje(t).motivos.some((m) => m !== "telefono")) {
        throw new ErrorPaquete(`${n}: quita correos, redes sociales, ligas o datos de contacto. Todo el trato va dentro de HETNA.`)
      }
      if (t && /(\d[\s.-]?){10}/.test(t)) throw new ErrorPaquete(`${n}: quita los números de teléfono.`)
    }
    const id = typeof x?.id === "string" && /^paq_[a-f0-9]{12}$/.test(x.id) ? x.id : `paq_${randomBytes(6).toString("hex")}`
    const modelo_3d = typeof x?.modelo_3d === "string" && MODELO_VALIDO.test(x.modelo_3d) ? x.modelo_3d : null
    return { id, titulo, desde, entrega_dias: dias, descripcion, categoria, modelo_3d }
  })
}

/** Lo publicado por un taller (lo que haya en su metadata, ya limpio). */
export function paquetesDe(metadata: any): Paquete[] {
  try {
    return normalizarPaquetes(Array.isArray(metadata?.paquetes) ? metadata.paquetes : [])
  } catch {
    return []
  }
}

// ── Muestra 3D de un servicio ──────────────────────────────────────────────

export const MAX_MB_MODELO = 25

/** Del STL (o ZIP con STL) que sube el diseñador saca una muestra simplificada
 *  (~8,000 triángulos) y la sube al almacenamiento público. El original no se
 *  guarda: así nadie se lleva su modelo completo. */
export async function generarModeloPaquete(scope: any, sellerId: string, contenido: Buffer): Promise<string> {
  const esZip = contenido.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  let stl: Buffer | null
  try {
    stl = stlDe(esZip ? "modelo.zip" : "modelo.stl", contenido)
  } catch {
    throw new ErrorPaquete("No pudimos abrir el ZIP.")
  }
  if (!stl) throw new ErrorPaquete("El ZIP no trae ningún archivo STL.")
  let tris: Float32Array
  try {
    tris = simplificar(leerSTL(stl))
  } catch {
    throw new ErrorPaquete("No pudimos leer el STL. Exporta de nuevo el modelo en STL.")
  }
  if (tris.length < 9 * 4) throw new ErrorPaquete("El STL viene vacío o no se pudo leer.")
  const limpio = String(sellerId).replace(/[^A-Za-z0-9_]/g, "").slice(-20)
  return subir(scope, `modelo3d-${limpio}-${randomBytes(5).toString("hex")}.stl`, "model/stl", stlBinario(tris))
}
