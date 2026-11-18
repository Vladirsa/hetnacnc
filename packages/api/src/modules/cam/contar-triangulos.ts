// Cuántos triángulos tiene un modelo 3D, contados en el servidor con el
// archivo real (auditoría de seguridad del 18 nov 2026).
//
// El nivel de precio del servicio CAM (catalog.ts › computeTier) se elegía con
// los números que manda el navegador. Alguien podía mandar triangles: 0 y pagar
// el nivel más barato por un modelo enorme. Ahora el servidor cuenta lo que
// puede contar y se queda con el número mayor.
//
// Cuenta igual que el CAM Lab (lab-05-interfaz.js: S.M.nT):
//   - STL binario: el número de la cabecera (cuadra con el tamaño del archivo).
//   - STL de texto: un triángulo por cada "facet".
//   - OBJ: cada cara de n vértices son n − 2 triángulos (como OBJLoader).
//   - STEP / IGES: no se puede sin teselar el modelo → null (se usa lo del navegador).
import type { CamJobStats } from "./catalog"

/** Más allá del umbral más alto (catalog.ts › TIER_RULES) el nivel ya no cambia. */
const TOPE_TRIANGULOS = 600_000

export function contarTriangulos(buf: Buffer, nombre: string): number | null {
  const ext = (nombre.split(".").pop() || "").toLowerCase()
  if (ext === "stl") {
    if (buf.length >= 84) {
      const n = buf.readUInt32LE(80)
      if (84 + n * 50 === buf.length) return n
    }
    const texto = buf.toString("latin1")
    if (!/^\s*solid\b/i.test(texto.slice(0, 512))) return null
    return (texto.match(/\bfacet\s+normal\b/gi) || []).length
  }
  if (ext === "obj") {
    // Se recorre el archivo sin partirlo en líneas (un OBJ de 80 MB en un
    // split congelaba el servidor varios segundos) y se deja de contar al
    // pasar el último umbral de precio: más allá no cambia el nivel.
    let total = 0
    let inicio = 0
    const n = buf.length
    while (inicio < n && total <= TOPE_TRIANGULOS) {
      let fin = buf.indexOf(10, inicio) // \n
      if (fin < 0) fin = n
      // "f " o "f\t" al inicio de la línea
      if (buf[inicio] === 102 && (buf[inicio + 1] === 32 || buf[inicio + 1] === 9)) {
        let vertices = 0
        let enToken = false
        for (let k = inicio + 2; k < fin; k++) {
          const c = buf[k]
          const espacio = c === 32 || c === 9 || c === 13
          if (!espacio && !enToken && ++vertices > TOPE_TRIANGULOS + 2) break
          enToken = !espacio
        }
        if (vertices >= 3) total += vertices - 2
      }
      inicio = fin + 1
    }
    return total
  }
  return null
}

/**
 * Los números del navegador con los triángulos del servidor como piso. Se
 * deja un margen pequeño para no cambiarle el nivel a nadie por redondeos.
 */
export function statsVerificadas(
  delNavegador: CamJobStats | null | undefined,
  servidor: number | null
): (CamJobStats & { triangles_servidor?: number }) | null {
  if (servidor == null) return delNavegador ? { ...delNavegador } : null
  const base: CamJobStats & { triangles_servidor?: number } = { ...(delNavegador ?? {}), triangles_servidor: servidor }
  const dicho = Number(base.triangles) || 0
  if (servidor > dicho * 1.02 + 100) base.triangles = servidor
  return base
}
