// Detecta si una foto tiene el fondo blanco.
// Se revisa el borde de la imagen (un marco delgado): si casi todo es blanco, el fondo es blanco.
// Las fotos con fondo transparente NO cuentan como blancas (en cada pantalla se ven distinto).

import sharp from "sharp"

const PORCENTAJE_MINIMO = 0.88 // 88% del borde debe ser blanco (deja pasar sombras suaves bajo la pieza)
const UMBRAL_BLANCO = 235 // 0-255: desde 235 en cada color se considera blanco

export async function tieneFondoBlanco(foto: Buffer): Promise<{ blanco: boolean; porcentaje: number }> {
  // Se reduce la foto a 120 px para revisar rápido; .rotate() respeta la orientación del celular
  const { data, info } = await sharp(foto)
    .rotate()
    .resize(120, 120, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const ancho = info.width
  const alto = info.height
  const grosor = Math.max(2, Math.round(Math.min(ancho, alto) * 0.04)) // marco de ~4%

  let total = 0
  let blancos = 0
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const enMarco = x < grosor || y < grosor || x >= ancho - grosor || y >= alto - grosor
      if (!enMarco) continue
      const i = (y * ancho + x) * 4
      total++
      const opaco = data[i + 3] >= 240
      if (opaco && data[i] >= UMBRAL_BLANCO && data[i + 1] >= UMBRAL_BLANCO && data[i + 2] >= UMBRAL_BLANCO) blancos++
    }
  }
  const porcentaje = total ? blancos / total : 0
  return { blanco: porcentaje >= PORCENTAJE_MINIMO, porcentaje }
}
