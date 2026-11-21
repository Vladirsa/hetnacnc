// Escanear: ingeniería inversa desde una pieza real (Fase 1, uso interno).
//
// Una pieza rota, gastada o sin plano se escanea en 3D (Revopoint RANGE 3,
// STL / OBJ / PLY), se sube aquí con fotos y medidas tomadas a mano, el equipo
// la rediseña completando lo que falta, sube el render y el modelo, el cliente
// aprueba o pide ajustes y, aprobada, la manda al Cotizador.
//
// Reglas del documento de la idea (nov. 2026):
//   - Sin precios: no se cobra ni se muestra tarifa hasta medir tiempos reales.
//   - Uso interno: sólo crean solicitudes las cuentas de la casa y las de
//     ESCANEAR_CORREOS. ESCANEAR_PUBLICO=on lo abre a cualquier cliente con
//     sesión, sin rehacer nada.
//   - Siempre el aviso: pieza reconstruida y funcional, sujeta a aprobación del
//     render y a verificación de medidas; no es copia idéntica certificada.
//   - Se guarda cuándo entra a cada estado: de ahí salen los tiempos reales
//     (escaneo, rediseño, prototipo) para poner precios y plazos.
//
// Tabla propia (se crea sola), como hetna_disenos: no necesita migración.
import { STORE_URL, boton, esc, marco, nuevoId } from "./licitacion"
import { correosDeLaCasa } from "./cuentas-casa"
import { sendEmail } from "./resend"
import { mandarPrivado } from "./social-telegram"

export const T_ESCANEAR = "hetna_escanear"

export const ESTADOS = ["recibida", "en_escaneo", "en_rediseno", "render_listo", "aprobada", "en_prototipo", "en_fabricacion", "terminada", "cancelada"] as const
export type Estado = (typeof ESTADOS)[number]
export const NOMBRE_ESTADO: Record<Estado, string> = {
  recibida: "Recibida",
  en_escaneo: "En escaneo",
  en_rediseno: "En rediseño",
  render_listo: "Render listo para aprobar",
  aprobada: "Aprobada",
  en_prototipo: "En prototipo",
  en_fabricacion: "En fabricación",
  terminada: "Terminada",
  cancelada: "Cancelada",
}

export const USOS = ["precision", "mueble", "repuesto"] as const
export const SALIDAS = ["reposicion", "adaptacion", "molde"] as const
export const NOMBRE_SALIDA: Record<(typeof SALIDAS)[number], string> = { reposicion: "Pieza de reposición", adaptacion: "Pieza adaptada", molde: "Molde" }
export const NOMBRE_USO: Record<(typeof USOS)[number], string> = { precision: "Precisión de ingeniería", mueble: "Mueble o madera", repuesto: "Repuesto común" }

/** Escaneo y fotos los sube el cliente; render y modelo, el equipo. */
export const TIPOS_ARCHIVO = ["escaneo", "foto", "render", "modelo"] as const
export type TipoArchivo = (typeof TIPOS_ARCHIVO)[number]
export const MAX_MB_ESCANEO = 95 // tope de Nginx: 100 MB por petición
export const MAX_ARCHIVOS = 30
export const EXTENSIONES: Record<TipoArchivo, string[]> = {
  escaneo: ["stl", "obj", "ply", "3mf", "zip"],
  foto: ["jpg", "jpeg", "png", "webp"],
  render: ["jpg", "jpeg", "png", "webp"],
  modelo: ["stl", "obj", "step", "stp", "3mf", "dxf", "zip"],
}

export const AVISO =
  "Pieza reconstruida y funcional, similar a la original: sujeta a la aprobación del render y a la verificación de medidas. No es una copia idéntica certificada. Sin precio público por ahora."

export type Archivo = { id: string; tipo: TipoArchivo; nombre: string; clave: string; tamano: number; de: "cliente" | "equipo"; creado: string }
export type Medida = { nombre: string; mm: number }
export type Verificacion = { medida: string; esperado_mm: number; medido_mm: number; tolerancia_mm: number; ok: boolean; nota?: string }
export type Comentario = { de: "cliente" | "equipo"; texto: string; accion?: "aprobar" | "ajuste"; creado: string }

export type Solicitud = {
  id: string
  folio: number
  customer_id: string
  correo: string | null
  nombre_cliente: string | null
  titulo: string
  descripcion: string
  uso: (typeof USOS)[number]
  salida: (typeof SALIDAS)[number]
  material_original: string | null
  material_deseado: string | null
  medidas: Medida[]
  zona: string | null
  estado: Estado
  archivos: Archivo[]
  comentarios: Comentario[]
  disenador: string | null
  notas_internas: string | null
  verificacion: Verificacion[]
  tiempos: Partial<Record<Estado, string>>
  creado: string
  actualizado: string
}

let lista = false
export async function asegurarEscanear(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_ESCANEAR))) {
    await knex.schema.createTable(T_ESCANEAR, (t: any) => {
      t.text("id").primary()
      t.increments("folio", { primaryKey: false })
      t.text("customer_id").notNullable().index()
      t.text("correo")
      t.text("nombre_cliente")
      t.text("titulo").notNullable()
      t.text("descripcion").notNullable()
      t.text("uso").notNullable()
      t.text("salida").notNullable()
      t.text("material_original")
      t.text("material_deseado")
      t.jsonb("medidas").notNullable().defaultTo("[]")
      t.text("zona")
      t.text("estado").notNullable().defaultTo("recibida").index()
      t.jsonb("archivos").notNullable().defaultTo("[]")
      t.jsonb("comentarios").notNullable().defaultTo("[]")
      t.text("disenador")
      t.text("notas_internas")
      t.jsonb("verificacion").notNullable().defaultTo("[]")
      t.jsonb("tiempos").notNullable().defaultTo("{}")
      t.timestamp("creado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("actualizado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

const json = (v: unknown, def: unknown) => {
  if (v === null || v === undefined) return def
  if (typeof v === "string") {
    try {
      return JSON.parse(v)
    } catch {
      return def
    }
  }
  return v
}

export function aSolicitud(f: any): Solicitud {
  return {
    ...f,
    folio: Number(f.folio),
    medidas: json(f.medidas, []),
    archivos: json(f.archivos, []),
    comentarios: json(f.comentarios, []),
    verificacion: json(f.verificacion, []),
    tiempos: json(f.tiempos, {}),
    creado: new Date(f.creado).toISOString(),
    actualizado: new Date(f.actualizado).toISOString(),
  }
}

export const folioEscanear = (n: number) => `ESC-${String(n).padStart(4, "0")}`

/** ¿Esta cuenta puede pedir? Fase 1: sólo la casa y la lista; ESCANEAR_PUBLICO=on lo abre. */
export function puedePedir(correo: string | null | undefined) {
  if (String(process.env.ESCANEAR_PUBLICO || "").toLowerCase() === "on") return true
  const c = String(correo || "").trim().toLowerCase()
  if (!c) return false
  const lista = String(process.env.ESCANEAR_CORREOS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
  return correosDeLaCasa().includes(c) || lista.includes(c)
}

/** Vista para el cliente: sin notas internas ni claves del almacén. */
export function vistaCliente(s: Solicitud) {
  const { notas_internas: _n, customer_id: _c, ...resto } = s
  return {
    ...resto,
    folio_texto: folioEscanear(s.folio),
    nombre_estado: NOMBRE_ESTADO[s.estado],
    archivos: s.archivos.map(({ clave: _k, ...a }) => a),
    aviso: AVISO,
  }
}

export async function cargar(knex: any, id: string): Promise<Solicitud | null> {
  await asegurarEscanear(knex)
  const f = await knex(T_ESCANEAR).where({ id }).first()
  return f ? aSolicitud(f) : null
}

export async function crear(knex: any, d: Omit<Solicitud, "id" | "folio" | "estado" | "archivos" | "comentarios" | "disenador" | "notas_internas" | "verificacion" | "tiempos" | "creado" | "actualizado">) {
  await asegurarEscanear(knex)
  const id = nuevoId("esc")
  const ahora = new Date().toISOString()
  const [f] = await knex(T_ESCANEAR)
    .insert({
      id,
      customer_id: d.customer_id,
      correo: d.correo,
      nombre_cliente: d.nombre_cliente,
      titulo: d.titulo,
      descripcion: d.descripcion,
      uso: d.uso,
      salida: d.salida,
      material_original: d.material_original,
      material_deseado: d.material_deseado,
      medidas: JSON.stringify(d.medidas),
      zona: d.zona,
      tiempos: JSON.stringify({ recibida: ahora }),
    })
    .returning("*")
  return aSolicitud(f)
}

export async function guardar(knex: any, id: string, cambios: Partial<Record<string, unknown>>) {
  const fila: Record<string, unknown> = { actualizado: knex.fn.now() }
  for (const [k, v] of Object.entries(cambios)) fila[k] = ["medidas", "archivos", "comentarios", "verificacion", "tiempos"].includes(k) ? JSON.stringify(v) : v
  const [f] = await knex(T_ESCANEAR).where({ id }).update(fila).returning("*")
  return f ? aSolicitud(f) : null
}

/** Cambia de estado y anota cuándo entró (para medir tiempos). */
export function conEstado(s: Solicitud, estado: Estado) {
  return { estado, tiempos: { ...s.tiempos, [estado]: s.tiempos[estado] || new Date().toISOString() } }
}

/** Minutos entre estados, para saber cuánto tarda cada paso. */
export function duraciones(s: Solicitud) {
  const orden = ESTADOS.filter((e) => e !== "cancelada" && s.tiempos[e])
  const r: { de: Estado; a: Estado; minutos: number }[] = []
  for (let i = 1; i < orden.length; i++) {
    const a = new Date(s.tiempos[orden[i - 1]]!).getTime(), b = new Date(s.tiempos[orden[i]]!).getTime()
    if (Number.isFinite(a) && Number.isFinite(b)) r.push({ de: orden[i - 1], a: orden[i], minutos: Math.round((b - a) / 60000) })
  }
  return r
}

export function extensionValida(tipo: TipoArchivo, nombre: string) {
  const ext = (nombre.split(".").pop() || "").toLowerCase()
  return EXTENSIONES[tipo].includes(ext) ? ext : null
}

// ---------------------------------------------------------------------------
// Avisos: al dueño por Telegram; al cliente por correo cuando hay algo que ver
// ---------------------------------------------------------------------------
const ligaCliente = (s: Solicitud) => `${STORE_URL}/mx/user/escanear/${s.id}`

export async function avisarEquipo(knex: any, s: Solicitud, texto: string, logger?: any) {
  try {
    await mandarPrivado(knex, { texto: `🧩 Escanear ${folioEscanear(s.folio)} · ${s.titulo}\n${texto}` })
  } catch (e) {
    logger?.warn?.(`[escanear] Telegram: ${(e as Error).message}`)
  }
}

export async function avisarCliente(s: Solicitud, logger?: any) {
  if (!s.correo) return
  const textos: Partial<Record<Estado, string>> = {
    render_listo: "El render de tu pieza reconstruida está listo. Revísalo y apruébalo, o pide los ajustes que necesites, antes de fabricar nada.",
    en_prototipo: "Tu pieza ya está aprobada y estamos haciendo el prototipo.",
    en_fabricacion: "Tu pieza está en fabricación.",
    terminada: "Tu pieza está terminada. Queda guardada en tu cuenta para volver a fabricarla cuando la necesites.",
  }
  const texto = textos[s.estado]
  if (!texto) return
  const r = await sendEmail({
    to: s.correo,
    subject: `${folioEscanear(s.folio)} · ${NOMBRE_ESTADO[s.estado]}: ${s.titulo.slice(0, 60)}`,
    html: marco(NOMBRE_ESTADO[s.estado], `<p style="margin:0 0 12px;color:#40403A;line-height:1.6">${esc(texto)}</p>` + boton("Ver mi pieza", ligaCliente(s)) + `<p style="margin:12px 0 0;color:#6B6A63;font-size:12px;line-height:1.5">${esc(AVISO)}</p>`),
  })
  if (!r.sent) logger?.warn?.(`[escanear] correo a ${s.correo}: ${r.reason}`)
}

// ---------------------------------------------------------------------------
// Archivos: al bucket privado (escanear/<id>/...), nunca públicos
// ---------------------------------------------------------------------------
export class ErrorEscanear extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje)
  }
}

const TIPO_MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", zip: "application/zip", stl: "model/stl", obj: "model/obj", ply: "application/octet-stream", "3mf": "model/3mf", step: "model/step", stp: "model/step", dxf: "application/dxf" }

export async function agregarArchivo(
  knex: any,
  s: Solicitud,
  a: { tipo: TipoArchivo; nombre: string; buffer: Buffer; de: "cliente" | "equipo" },
  subir: (b: Buffer, clave: string, tipo: string) => Promise<{ ok: true; storageKey: string } | { ok: false; reason: string }>
) {
  const ext = extensionValida(a.tipo, a.nombre)
  if (!ext) throw new ErrorEscanear(400, `Ese archivo no va aquí. Se aceptan: ${EXTENSIONES[a.tipo].join(", ").toUpperCase()}.`)
  if (a.buffer.length > MAX_MB_ESCANEO * 1024 * 1024) throw new ErrorEscanear(413, `El archivo pasa de ${MAX_MB_ESCANEO} MB. Exporta el escaneo simplificado o en ZIP.`)
  if (s.archivos.length >= MAX_ARCHIVOS) throw new ErrorEscanear(400, `Ya hay ${MAX_ARCHIVOS} archivos en esta solicitud.`)
  const id = nuevoId("arc").slice(0, 20)
  const limpio = a.nombre.replace(/[^\w.\- ]+/g, "_").slice(-80)
  const r = await subir(a.buffer, `escanear/${s.id}/${a.tipo}/${id}.${ext}`, TIPO_MIME[ext] || "b2/x-auto")
  if (!r.ok) throw new ErrorEscanear(502, "No se pudo guardar el archivo. Intenta de nuevo.")
  const archivo: Archivo = { id, tipo: a.tipo, nombre: limpio, clave: r.storageKey, tamano: a.buffer.length, de: a.de, creado: new Date().toISOString() }
  // Se vuelve a leer para no pisar otro archivo que se haya subido al mismo tiempo
  const actual = (await cargar(knex, s.id)) || s
  return guardar(knex, s.id, { archivos: [...actual.archivos, archivo] })
}
