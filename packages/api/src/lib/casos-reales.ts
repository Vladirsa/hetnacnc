// Trabajos reales (auditoría de mejoras del 14 nov 2026, tarea 5: confianza).
// Casos que HETNA carga desde el admin ("Trabajos reales"): foto de la pieza
// terminada, ciudad, material, tipo de trabajo y tiempo de entrega. Sólo se
// publican con permiso del cliente; la sección del sitio no aparece mientras
// no haya ninguno (nunca contenido de ejemplo como si fuera real).
export const T_CASO = "hetna_caso_real"

let listo = false
export async function asegurarCasos(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_CASO))) {
    await knex.schema.createTable(T_CASO, (t: any) => {
      t.text("id").primary()
      t.text("titulo").notNullable()
      t.text("foto_url").notNullable()
      t.text("ciudad").nullable()
      t.text("material").nullable()
      t.text("tipo_trabajo").nullable()
      t.text("tiempo_entrega").nullable()
      t.boolean("permiso_cliente").notNullable().defaultTo(false)
      t.boolean("publicado").notNullable().defaultTo(false)
      t.integer("orden").notNullable().defaultTo(0)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

const texto = (v: unknown, n: number) => {
  const s = String(v ?? "").trim().slice(0, n)
  return s || null
}

/** Valida lo que manda el admin. Devuelve el mensaje de error o los datos. */
export function leerCaso(b: any): { error: string } | { datos: Record<string, unknown> } {
  const titulo = texto(b?.titulo, 120)
  const foto_url = texto(b?.foto_url, 600)
  if (!titulo) return { error: "Escribe qué se fabricó." }
  if (!foto_url || !/^https:\/\//i.test(foto_url)) return { error: "Sube la foto de la pieza terminada." }
  const permiso = b?.permiso_cliente === true
  const publicado = b?.publicado === true
  if (publicado && !permiso) return { error: "Sólo se publica con permiso del cliente." }
  return {
    datos: {
      titulo,
      foto_url,
      ciudad: texto(b?.ciudad, 80),
      material: texto(b?.material, 80),
      tipo_trabajo: texto(b?.tipo_trabajo, 80),
      tiempo_entrega: texto(b?.tiempo_entrega, 60),
      permiso_cliente: permiso,
      publicado,
      orden: Math.max(0, Math.min(999, Number(b?.orden) || 0)),
    },
  }
}

export const casoPublico = (c: any) => ({
  id: c.id,
  titulo: c.titulo,
  foto_url: c.foto_url,
  ciudad: c.ciudad,
  material: c.material,
  tipo_trabajo: c.tipo_trabajo,
  tiempo_entrega: c.tiempo_entrega,
})
