// Medidas del recuadro "Fabrícalo" (components/hetna/fichas/descarga/FabricarDiseno.tsx):
// se escriben libres en cm o mm y, si se pide, en proporción con las del diseño.
export type Medidas = { ancho: string; largo: string; alto: string }
export type Unidad = "cm" | "mm"
const numero = (v: string) => parseFloat(v.replace(",", ".")) || 0
export const aMmDe = (v: string, u: Unidad) => numero(v) * (u === "cm" ? 10 : 1)
export const deMmEn = (mm: number, u: Unidad) => (mm > 0 ? String(Math.round((u === "cm" ? mm / 10 : mm) * 10) / 10) : "")

/** Lo que queda en los campos al escribir `v` en `clave`. Vacío o a medias se deja escribir;
 *  en proporción, las otras medidas del diseño siguen a la que cambió. */
export function medidasTrasCambio(vista: Medidas, clave: keyof Medidas, v: string, o: { proporcion: boolean; base: Medidas | null; unidad: Unidad }): Medidas {
  const nuevo = { ...vista, [clave]: v }
  const b = o.base && { ancho: aMmDe(o.base.ancho, "mm"), largo: aMmDe(o.base.largo, "mm"), alto: aMmDe(o.base.alto, "mm") }
  if (o.proporcion && b && b[clave] > 0 && aMmDe(v, o.unidad) > 0) {
    const f = aMmDe(v, o.unidad) / b[clave]
    for (const k of ["ancho", "largo", "alto"] as const) if (k !== clave && b[k] > 0) nuevo[k] = deMmEn(b[k] * f, o.unidad)
  }
  return nuevo
}

/** Las medidas escritas, pasadas a la otra unidad (lo vacío se queda vacío). */
export const medidasEnUnidad = (m: Medidas, de: Unidad, a: Unidad): Medidas => {
  if (de === a) return m
  const conv = (v: string) => (numero(v) > 0 ? deMmEn(aMmDe(v, de), a) : v)
  return { ancho: conv(m.ancho), largo: conv(m.largo), alto: conv(m.alto) }
}

