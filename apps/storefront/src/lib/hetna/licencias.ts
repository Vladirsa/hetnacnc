// Licencias de diseños digitales (respuesta jurídica del 14 nov 2026,
// pregunta 8). Mismas claves que packages/api/src/lib/licencias.ts.
//
// Cada diseño trae metadata.licencia (y licencia_piezas en la comercial
// limitada); sin licencia elegida, se vende con la personal. La ficha, el
// filtro de la tienda y la página /licencias-disenos leen de aquí.
//
// Texto preliminar: lo revisa el abogado junto con los términos (ver
// docs/legal/respuestas-2026-11-14.md).

export type ClaveLicencia = "personal" | "comercial_limitada" | "comercial_ampliada"
export const PIEZAS_POR_OMISION = 100

export type Licencia = {
  clave: ClaveLicencia
  nombre: string
  resumen: string
  // Lo que permite, renglón por renglón (sí / no / texto)
  permisos: { que: string; si: boolean; nota?: string }[]
}

// Reglas que aplican a las tres
export const REGLAS_COMUNES = [
  "No se permite revender, compartir, publicar ni distribuir el archivo, ni versiones modificadas como archivo.",
  "Las piezas físicas que fabriques puedes conservarlas o entregarlas según la licencia, sin límite de tiempo.",
  "Válida en cualquier país y sin fecha de vencimiento para el comprador.",
  "Si modificas el diseño, el archivo modificado sigue sujeto a la misma licencia.",
  "La licencia es del comprador: no se transfiere a otra persona o empresa.",
]

export const LICENCIAS: Record<ClaveLicencia, Licencia> = {
  personal: {
    clave: "personal",
    nombre: "Personal",
    resumen: "Para fabricar piezas para ti. No incluye vender las piezas.",
    permisos: [
      { que: "Fabricar piezas para uso propio", si: true },
      { que: "Modificar el diseño para tu uso", si: true },
      { que: "Vender las piezas fabricadas", si: false },
      { que: "Fabricar para tus clientes", si: false },
      { que: "Uso industrial o producción en serie", si: false },
    ],
  },
  comercial_limitada: {
    clave: "comercial_limitada",
    nombre: "Comercial limitada",
    resumen: "Para vender las piezas que fabriques, hasta un número de piezas.",
    permisos: [
      { que: "Fabricar piezas para uso propio", si: true },
      { que: "Modificar el diseño", si: true },
      { que: "Vender las piezas fabricadas", si: true, nota: "hasta el número de piezas indicado" },
      { que: "Fabricar para tus clientes", si: true, nota: "dentro del mismo límite" },
      { que: "Uso industrial o producción en serie", si: false },
    ],
  },
  comercial_ampliada: {
    clave: "comercial_ampliada",
    nombre: "Comercial ampliada",
    resumen: "Para producción comercial sin límite de piezas.",
    permisos: [
      { que: "Fabricar piezas para uso propio", si: true },
      { que: "Modificar el diseño", si: true },
      { que: "Vender las piezas fabricadas", si: true, nota: "sin límite de piezas" },
      { que: "Fabricar para tus clientes", si: true },
      { que: "Uso industrial o producción en serie", si: true },
    ],
  },
}

export const ORDEN_LICENCIAS: ClaveLicencia[] = ["personal", "comercial_limitada", "comercial_ampliada"]

/** La licencia de un producto (personal si no tiene). */
export function licenciaDe(metadata?: Record<string, unknown> | null): { licencia: Licencia; piezas: number | null } {
  const v = String(metadata?.licencia || "").trim().toLowerCase() as ClaveLicencia
  const licencia = LICENCIAS[v] || LICENCIAS.personal
  const n = Math.floor(Number(metadata?.licencia_piezas))
  return { licencia, piezas: licencia.clave === "comercial_limitada" ? (n > 0 ? n : PIEZAS_POR_OMISION) : null }
}

/** "Comercial limitada (hasta 100 piezas)" */
export const nombreLicencia = (metadata?: Record<string, unknown> | null) => {
  const { licencia, piezas } = licenciaDe(metadata)
  return piezas ? `${licencia.nombre} (hasta ${piezas.toLocaleString("es-MX")} piezas)` : licencia.nombre
}
