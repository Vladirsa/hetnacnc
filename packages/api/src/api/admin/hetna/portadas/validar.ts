import { MedusaError } from "@medusajs/framework/utils"

// Campos que HETNA puede editar desde el panel de portadas
export type DatosPortada = {
  etiqueta?: string
  titulo?: string
  texto?: string
  imagen_url?: string | null
  boton1_texto?: string | null
  boton1_url?: string | null
  boton2_texto?: string | null
  boton2_url?: string | null
  orden?: number
  activa?: boolean
  inicia_en?: Date | null
  termina_en?: Date | null
  estado?: "pendiente_pago" | "en_revision" | "aprobada" | "rechazada"
  nota_admin?: string | null
}

const ESTADOS = ["pendiente_pago", "en_revision", "aprobada", "rechazada"] as const

const error = (msg: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, msg)

const texto = (v: unknown, campo: string, max: number): string => {
  if (typeof v !== "string") throw error(`"${campo}" debe ser texto`)
  const t = v.trim()
  if (t.length > max) throw error(`"${campo}" admite máximo ${max} caracteres`)
  return t
}

const textoONulo = (v: unknown, campo: string, max: number): string | null => {
  if (v === null || v === undefined || v === "") return null
  return texto(v, campo, max)
}

// Solo rutas internas (/categories/...) o ligas https://; nunca javascript: ni otros esquemas
const liga = (v: unknown, campo: string): string | null => {
  const t = textoONulo(v, campo, 500)
  if (t === null) return null
  if (t.startsWith("/") && !t.startsWith("//")) return t
  try {
    const u = new URL(t)
    if (u.protocol === "https:" || u.protocol === "http:") return t
  } catch {
    // cae al error de abajo
  }
  throw error(`"${campo}" debe empezar con / (página de la tienda) o con https://`)
}

const fecha = (v: unknown, campo: string): Date | null => {
  if (v === null || v === undefined || v === "") return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) throw error(`"${campo}" no es una fecha válida`)
  return d
}

export const validarPortada = (
  body: Record<string, unknown>,
  { crear }: { crear: boolean }
): DatosPortada => {
  const datos: DatosPortada = {}
  const tiene = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

  if (crear || tiene("titulo")) {
    const t = texto(body.titulo ?? "", "titulo", 120)
    if (!t) throw error("El título es obligatorio")
    datos.titulo = t
  }
  if (tiene("etiqueta")) datos.etiqueta = texto(body.etiqueta ?? "", "etiqueta", 40)
  if (tiene("texto")) datos.texto = texto(body.texto ?? "", "texto", 260)
  if (tiene("imagen_url")) datos.imagen_url = liga(body.imagen_url, "imagen_url")
  if (tiene("boton1_texto")) datos.boton1_texto = textoONulo(body.boton1_texto, "boton1_texto", 40)
  if (tiene("boton1_url")) datos.boton1_url = liga(body.boton1_url, "boton1_url")
  if (tiene("boton2_texto")) datos.boton2_texto = textoONulo(body.boton2_texto, "boton2_texto", 40)
  if (tiene("boton2_url")) datos.boton2_url = liga(body.boton2_url, "boton2_url")
  if (tiene("orden")) {
    const n = Number(body.orden)
    if (!Number.isInteger(n)) throw error(`"orden" debe ser un número entero`)
    datos.orden = n
  }
  if (tiene("activa")) datos.activa = Boolean(body.activa)
  if (tiene("inicia_en")) datos.inicia_en = fecha(body.inicia_en, "inicia_en")
  if (tiene("termina_en")) datos.termina_en = fecha(body.termina_en, "termina_en")
  if (tiene("estado")) {
    if (!ESTADOS.includes(body.estado as (typeof ESTADOS)[number])) {
      throw error(`"estado" no es válido`)
    }
    datos.estado = body.estado as DatosPortada["estado"]
  }
  if (tiene("nota_admin")) datos.nota_admin = textoONulo(body.nota_admin, "nota_admin", 500)

  if (datos.inicia_en && datos.termina_en && datos.termina_en < datos.inicia_en) {
    throw error("La fecha de fin debe ser posterior a la de inicio")
  }
  return datos
}
