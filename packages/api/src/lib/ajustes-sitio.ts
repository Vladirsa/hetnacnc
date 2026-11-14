// Ajustes del sitio editables desde el admin, guardados como JSON por clave.
// Hoy: "ejemplo-cotizacion" (auditoría de mejoras, tarea 6): un ejemplo de
// solicitud respondida, con datos reales anonimizados, para la página
// Cotizar. Si no está cargado, la página no muestra nada inventado.
export const T_AJUSTE = "hetna_ajuste_sitio"
export const CLAVES = ["ejemplo-cotizacion"] as const

let listo = false
export async function asegurarAjustes(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_AJUSTE))) {
    await knex.schema.createTable(T_AJUSTE, (t: any) => {
      t.text("clave").primary()
      t.jsonb("valor").notNullable()
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

const txt = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)

/** Ejemplo de cotización: pieza, material, rango de precio y tiempo. Vacío = se quita. */
export function leerEjemplo(b: any): { error: string } | { valor: Record<string, string> | null } {
  const v = {
    pieza: txt(b?.pieza, 120),
    material: txt(b?.material, 80),
    cantidad: txt(b?.cantidad, 40),
    precio: txt(b?.precio, 60),
    tiempo: txt(b?.tiempo, 60),
    propuestas: txt(b?.propuestas, 20),
  }
  if (!v.pieza && !v.precio) return { valor: null }
  if (!v.pieza || !v.precio || !v.tiempo) return { error: "Faltan pieza, rango de precio o tiempo." }
  return { valor: v }
}
