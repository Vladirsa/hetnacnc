// "Liberar pago" y reclamos de las compras de la tienda (productos físicos).
// Decisión del dueño, 25 nov 2026:
//
//   - Cuando el pedido llega, el cliente tiene dos botones en su compra:
//       "Todo bien, liberar pago"  -> el saldo del taller queda disponible al
//                                     instante (acepta que llegó bien).
//       "Tengo un problema"        -> motivo + explicación + fotos o video
//                                     (obligatorias, salvo "no me llegó"). El
//                                     pago se congela y se abre un reclamo.
//   - Si el cliente no hace nada, el pago se libera solo DIAS_LIBERACION (3)
//     días después de la entrega (lib/saldos-talleres.ts, liberarVencidos).
//   - Opción C: el cliente puede reclamar hasta DIAS_DEVOLUCION (7) días después
//     de la entrega. Si el pago ya se liberó (o ya se le pagó al taller) y el
//     reclamo procede, lo que se reembolsa se le descuenta al taller de sus
//     siguientes ventas (renglón negativo "reclamo:<id>" en su saldo, igual que
//     un sobrepeso).
//   - El taller tiene DIAS_HABILES_RESPUESTA (3) días hábiles para responder con
//     su evidencia. Si no responde, HETNA lo ve marcado y el caso se resuelve a
//     favor del cliente.
//   - HETNA decide: liberar al taller, reembolso total o reembolso parcial. La
//     guía de regreso la paga el taller si la culpa fue suya y el cliente si se
//     arrepintió.
//
// Los reembolsos al cliente los hace HETNA a mano en Mercado Pago o PayPal:
// esto registra, congela, descuenta y avisa. No mueve dinero solo.
// Después de "liberar pago" ya no hay reclamo por daño o faltantes: sólo por
// garantía (defecto de funcionamiento), como dice la política de devoluciones.
//
// La evidencia NO va a la carpeta pública: se guarda en la carpeta privada del
// servidor (HETNA_PRIVADO_DIR o ~/hetna-privado)/reclamos/<pedido>/ y sólo la
// entregan las rutas del cliente dueño del pedido, del taller y del admin.
import { randomBytes } from "crypto"
import { promises as fs } from "fs"
import os from "os"
import path from "path"

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { revisarMensaje } from "./chat-filtro"
import { T_GUIAS, asegurarTablaGuias } from "./guias"
import { CAMPOS_PAGO, pedidoPagado } from "./pago-pedido"
import {
  PREFIJO_RECLAMO,
  T_RECLAMO,
  T_SALDO,
  asegurarTablaSaldos,
  diasLiberacion,
  netoTaller,
  registrarVenta,
} from "./saldos-talleres"

export { T_RECLAMO }
export const T_EVIDENCIA = "hetna_reclamo_evidencia"

export const DIAS_DEVOLUCION = 7 // días naturales desde la entrega (política de devoluciones)
export const HORAS_REPORTE = 48 // daño, faltantes o distinto: se debe reportar en este plazo
export const DIAS_HABILES_RESPUESTA = 3 // plazo del taller para responder
export const DIAS_GARANTIA = 90 // después de liberar, sólo garantía, hasta este plazo
export const MAX_EVIDENCIAS = 8 // por persona y pedido
export const MAX_MB_EVIDENCIA = 15

export const MOTIVOS = {
  no_llego: { nombre: "No me llegó", guia: "taller" },
  danado: { nombre: "Llegó dañado o roto", guia: "taller" },
  incompleto: { nombre: "Llegó incompleto o faltan piezas", guia: "taller" },
  distinto: { nombre: "Es distinto a lo publicado", guia: "taller" },
  defecto: { nombre: "No funciona o tiene un defecto (garantía)", guia: "taller" },
  arrepentimiento: { nombre: "Ya no lo quiero (sin uso, en su empaque)", guia: "cliente" },
  otro: { nombre: "Otro problema", guia: "taller" },
} as const
export type Motivo = keyof typeof MOTIVOS
export const esMotivo = (m: unknown): m is Motivo => typeof m === "string" && m in MOTIVOS

export const ESTADOS_RECLAMO = {
  abierto: "Esperando respuesta del taller",
  respondido: "En revisión de HETNA",
  resuelto: "Resuelto",
} as const
export type EstadoReclamo = keyof typeof ESTADOS_RECLAMO

export const DECISIONES = {
  liberar: "Se liberó el pago al taller",
  reembolso_total: "Reembolso total al cliente",
  reembolso_parcial: "Reembolso parcial al cliente",
} as const
export type Decision = keyof typeof DECISIONES
export const esDecision = (d: unknown): d is Decision => typeof d === "string" && d in DECISIONES

const knexDe = (c: MedusaContainer) => c.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
const r2 = (n: number) => Math.round(n * 100) / 100
const DIA = 24 * 60 * 60 * 1000

export const folioReclamo = (folio: number | string | null | undefined) => `REC-${String(folio ?? 0).padStart(5, "0")}`
export const ORDER_VALIDO = /^order_[A-Za-z0-9]+$/

let listas = false
export async function asegurarTablasReclamo(knex: any) {
  if (listas) return
  if (!(await knex.schema.hasTable(T_RECLAMO))) {
    await knex.schema.createTable(T_RECLAMO, (t: any) => {
      t.text("id").primary()
      t.specificType("folio", "serial")
      t.text("order_id").notNullable().unique()
      t.integer("display_id")
      t.text("seller_id").notNullable().index()
      t.text("customer_id").notNullable().index()
      t.text("motivo").notNullable()
      t.text("detalle").notNullable()
      t.text("estado").notNullable().index()
      t.timestamp("entregado_en", { useTz: true })
      t.integer("horas_desde_entrega")
      // Estado del saldo del taller al abrir: si ya estaba pagado, lo que proceda se descuenta
      t.text("saldo_estado_previo")
      t.timestamp("responder_antes", { useTz: true })
      t.text("respuesta_taller")
      t.timestamp("respondido_en", { useTz: true })
      t.boolean("taller_no_respondio").notNullable().defaultTo(false)
      t.text("decision")
      t.decimal("monto_reembolso", 12, 2)
      t.text("guia_paga") // taller | cliente
      t.decimal("costo_guia", 12, 2)
      t.decimal("descontado_taller", 12, 2)
      t.text("decision_nota")
      t.timestamp("decidido_en", { useTz: true })
      t.text("decidido_por")
      t.timestamp("creado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("actualizado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasTable(T_EVIDENCIA))) {
    await knex.schema.createTable(T_EVIDENCIA, (t: any) => {
      t.text("id").primary()
      t.text("order_id").notNullable().index()
      // vacío mientras está "suelta" (subida pero sin enviar el reclamo o la respuesta)
      t.text("reclamo_id").index()
      t.text("autor").notNullable() // cliente | taller
      t.text("autor_id").notNullable()
      t.text("archivo").notNullable()
      t.text("mime").notNullable()
      t.integer("tamano").notNullable()
      t.timestamp("creado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listas = true
}

// ── Plazos ──────────────────────────────────────────────────────────────────

/** Suma días hábiles (lunes a viernes, hora de la Ciudad de México). */
export function sumarDiasHabiles(desde: Date, n: number): Date {
  let f = new Date(desde.getTime())
  let quedan = n
  while (quedan > 0) {
    f = new Date(f.getTime() + DIA)
    const dia = new Date(f.getTime() - 6 * 60 * 60 * 1000).getUTCDay()
    if (dia !== 0 && dia !== 6) quedan--
  }
  return f
}

/** Qué puede hacer el cliente con su pedido ahora. Puro: sin base de datos.
 *  `enviado`: el pedido ya salió del taller (o la guía o el cliente marcaron la entrega). */
export function opcionesCliente(
  f: { estado: string; digital: boolean; entregado_en: Date | string | null; aceptado_en: Date | string | null } | null,
  o: { enviado: boolean; hayReclamo: boolean },
  ahora = Date.now()
): { puede_liberar: boolean; motivos: Motivo[] } {
  const nada = { puede_liberar: false, motivos: [] as Motivo[] }
  if (!f || f.digital || o.hayReclamo) return nada
  const entregado = f.entregado_en ? new Date(f.entregado_en).getTime() : null
  const todos = Object.keys(MOTIVOS) as Motivo[]
  if (f.aceptado_en) {
    // Liberó el pago: aceptó que llegó bien. Sólo queda la garantía.
    const desde = entregado ?? new Date(f.aceptado_en).getTime()
    return { puede_liberar: false, motivos: ahora <= desde + DIAS_GARANTIA * DIA ? ["defecto"] : [] }
  }
  const puede_liberar = f.estado === "pendiente" && (o.enviado || entregado != null)
  if (entregado == null) return { puede_liberar, motivos: todos }
  if (ahora <= entregado + DIAS_DEVOLUCION * DIA) return { puede_liberar, motivos: todos }
  if (ahora <= entregado + DIAS_GARANTIA * DIA) return { puede_liberar, motivos: ["defecto"] }
  return { puede_liberar, motivos: [] }
}

/** Cuánto se le descuenta al taller con la decisión de HETNA. Puro.
 *  `saldo`: estado de su renglón de saldo (pagado = ya se le transfirió). */
export function calcularDecision(
  d: { decision: Decision; monto?: number | null; guiaPaga: "taller" | "cliente"; costoGuia?: number | null },
  saldo: { estado: string; productos: any; envio: any; comision: any; envio_al_taller: boolean | null }
): { estadoSaldo: "disponible" | "retenido" | null; descuento: number; monto: number } {
  const neto = netoTaller(saldo)
  const cobrado = r2((Number(saldo.productos) || 0) + (Number(saldo.envio) || 0))
  const guia = d.guiaPaga === "taller" ? r2(Math.max(0, Number(d.costoGuia) || 0)) : 0
  const yaPagado = saldo.estado === "pagado"
  if (d.decision === "liberar") {
    return { estadoSaldo: yaPagado ? null : "disponible", descuento: guia, monto: 0 }
  }
  if (d.decision === "reembolso_total") {
    // Lo retenido no se le paga. Si ya se le pagó, se le descuenta lo que recibió.
    return { estadoSaldo: yaPagado ? null : "retenido", descuento: r2((yaPagado ? neto : 0) + guia), monto: cobrado }
  }
  const monto = r2(Math.min(Math.max(0, Number(d.monto) || 0), cobrado))
  return { estadoSaldo: yaPagado ? null : "disponible", descuento: r2(monto + guia), monto }
}

// ── Evidencia en la carpeta privada ─────────────────────────────────────────

const FORMATOS: { mime: string; ext: string; firma: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", firma: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", firma: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", firma: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { mime: "video/quicktime", ext: "mov", firma: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" && b.subarray(8, 10).toString("latin1") === "qt" },
  { mime: "video/mp4", ext: "mp4", firma: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" },
  { mime: "video/webm", ext: "webm", firma: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
]
// El formato se decide por los primeros bytes, no por lo que diga el navegador
export const formatoEvidencia = (b: Buffer) => FORMATOS.find((f) => b.length > 16 && f.firma(b)) ?? null

const raiz = () => path.join(process.env.HETNA_PRIVADO_DIR || path.join(os.homedir(), "hetna-privado"), "reclamos")
const carpetaDe = (orderId: string) => {
  if (!ORDER_VALIDO.test(orderId)) throw new Error("Pedido no válido")
  return path.join(raiz(), orderId)
}
const rutaDe = (orderId: string, archivo: string) => {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp|mov|mp4|webm)$/.test(archivo)) throw new Error("Archivo no válido")
  return path.join(carpetaDe(orderId), archivo)
}

export class ErrorReclamo extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

/** Todo el trato va dentro de HETNA: sin correos, redes, ligas ni "búscame en…".
 *  Los números largos sí pasan: son guías de envío y números de pedido. */
export function revisarContacto(texto: string) {
  const r = revisarMensaje(texto)
  if (r.motivos.some((m) => m !== "telefono")) {
    throw new ErrorReclamo("Quita correos, redes sociales, ligas o datos de contacto: todo se resuelve dentro de HETNA.")
  }
}

export async function guardarEvidencia(
  knex: any,
  d: { orderId: string; autor: "cliente" | "taller"; autorId: string; contenido: Buffer }
) {
  await asegurarTablasReclamo(knex)
  const formato = formatoEvidencia(d.contenido)
  if (!formato) throw new ErrorReclamo("Sube una foto (JPG, PNG o WEBP) o un video (MP4, MOV o WEBM).")
  if (d.contenido.length > MAX_MB_EVIDENCIA * 1024 * 1024) throw new ErrorReclamo(`El archivo pesa más de ${MAX_MB_EVIDENCIA} MB.`, 413)
  const ya = await knex(T_EVIDENCIA).where({ order_id: d.orderId, autor: d.autor, autor_id: d.autorId }).count({ n: "*" }).first()
  if (Number(ya?.n || 0) >= MAX_EVIDENCIAS) throw new ErrorReclamo(`Puedes subir hasta ${MAX_EVIDENCIAS} archivos.`)
  const id = randomBytes(16).toString("hex")
  const archivo = `${id}.${formato.ext}`
  await fs.mkdir(carpetaDe(d.orderId), { recursive: true, mode: 0o700 })
  await fs.writeFile(rutaDe(d.orderId, archivo), d.contenido, { mode: 0o600 })
  const fila = { id: `evi_${id}`, order_id: d.orderId, reclamo_id: null, autor: d.autor, autor_id: d.autorId, archivo, mime: formato.mime, tamano: d.contenido.length }
  await knex(T_EVIDENCIA).insert(fila)
  return { id: fila.id, mime: fila.mime, tamano: fila.tamano }
}

export async function leerEvidencia(knex: any, orderId: string, id: string) {
  await asegurarTablasReclamo(knex)
  if (!/^evi_[a-f0-9]{32}$/.test(id)) return null
  const f = await knex(T_EVIDENCIA).where({ id, order_id: orderId }).first()
  if (!f) return null
  const datos = await fs.readFile(rutaDe(orderId, f.archivo)).catch(() => null)
  return datos ? { mime: f.mime as string, datos, autor: f.autor as string, autor_id: f.autor_id as string, reclamo_id: f.reclamo_id as string | null } : null
}

/** Borra lo que se subió y nunca se envió (más de un día suelto). */
export async function limpiarEvidenciaSuelta(knex: any): Promise<number> {
  await asegurarTablasReclamo(knex)
  const viejas = await knex(T_EVIDENCIA).whereNull("reclamo_id").where("creado", "<", new Date(Date.now() - DIA)).select("id", "order_id", "archivo").limit(500)
  for (const f of viejas) {
    await fs.rm(rutaDe(f.order_id, f.archivo), { force: true }).catch(() => undefined)
    await knex(T_EVIDENCIA).where({ id: f.id }).del()
  }
  return viejas.length
}

// Respuesta de un archivo privado: nunca en caché ni interpretado como página
export function encabezadosEvidencia(mime: string) {
  return {
    "Content-Type": mime,
    "Content-Disposition": "inline",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  }
}

// ── Lo que ve cada quien ────────────────────────────────────────────────────

export async function evidenciasDe(knex: any, reclamoId: string) {
  return (await knex(T_EVIDENCIA).where({ reclamo_id: reclamoId }).orderBy("creado", "asc").select("id", "autor", "mime", "tamano", "creado")) as {
    id: string
    autor: "cliente" | "taller"
    mime: string
    tamano: number
    creado: string
  }[]
}

export function vistaReclamo(r: any, evidencias: Awaited<ReturnType<typeof evidenciasDe>>) {
  const decision = r.decision as Decision | null
  return {
    id: r.id as string,
    folio: folioReclamo(r.folio),
    order_id: r.order_id as string,
    display_id: r.display_id as number | null,
    motivo: r.motivo as Motivo,
    motivo_nombre: MOTIVOS[r.motivo as Motivo]?.nombre || r.motivo,
    detalle: r.detalle as string,
    estado: r.estado as EstadoReclamo,
    estado_nombre: ESTADOS_RECLAMO[r.estado as EstadoReclamo] || r.estado,
    creado: r.creado,
    entregado_en: r.entregado_en,
    horas_desde_entrega: r.horas_desde_entrega,
    responder_antes: r.responder_antes,
    respuesta_taller: r.respuesta_taller,
    respondido_en: r.respondido_en,
    taller_no_respondio: Boolean(r.taller_no_respondio),
    decision,
    decision_nombre: decision ? DECISIONES[decision] : null,
    monto_reembolso: r.monto_reembolso != null ? Number(r.monto_reembolso) : null,
    guia_paga: r.guia_paga,
    decision_nota: r.decision_nota,
    decidido_en: r.decidido_en,
    evidencias,
  }
}

// ── Acciones ────────────────────────────────────────────────────────────────

/** Pedido del cliente con su saldo (se registra si faltaba). null si no es suyo. */
export async function pedidoDelCliente(c: MedusaContainer, orderId: string, customerId: string) {
  if (!ORDER_VALIDO.test(orderId)) return null
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "customer_id", "email", "status", "currency_code", "fulfillments.id", "fulfillments.canceled_at", ...CAMPOS_PAGO],
    filters: { id: orderId },
  })
  const o = data[0] as any
  // Mismo resultado si no existe o es de otro cliente: no se revela qué pedidos hay
  if (!o || o.customer_id !== customerId) return null
  const knex = knexDe(c)
  await asegurarTablaSaldos(knex)
  await asegurarTablasReclamo(knex)
  if (o.status !== "canceled" && pedidoPagado(o)) await registrarVenta(c, orderId).catch(() => false)
  const saldo = await knex(T_SALDO).where({ order_id: orderId }).first()
  const reclamo = await knex(T_RECLAMO).where({ order_id: orderId }).first()
  return { pedido: o, saldo: saldo || null, reclamo: reclamo || null }
}

/** ¿El pedido ya salió del taller? (tiene un envío preparado que no se canceló;
 *  igual que el antiguo "Ya lo recibí", que salía desde "fulfilled"). */
const salio = (o: any) => ((o?.fulfillments || []) as any[]).some((f) => f && !f.canceled_at)

export async function estadoParaCliente(c: MedusaContainer, orderId: string, customerId: string) {
  const p = await pedidoDelCliente(c, orderId, customerId)
  if (!p) return null
  const knex = knexDe(c)
  const valido = p.pedido.status !== "canceled" && pedidoPagado(p.pedido)
  const op = valido
    ? opcionesCliente(p.saldo, { enviado: salio(p.pedido), hayReclamo: Boolean(p.reclamo) })
    : { puede_liberar: false, motivos: [] as Motivo[] }
  return {
    order_id: orderId,
    fisico: Boolean(p.saldo && !p.saldo.digital),
    saldo_estado: p.saldo?.estado ?? null,
    entregado_en: p.saldo?.entregado_en ?? null,
    se_libera_en: p.saldo?.estado === "pendiente" ? p.saldo?.disponible_en ?? null : null,
    aceptado_en: p.saldo?.aceptado_en ?? null,
    devolucion_hasta: p.saldo?.entregado_en ? new Date(new Date(p.saldo.entregado_en).getTime() + DIAS_DEVOLUCION * DIA) : null,
    dias_liberacion: diasLiberacion(),
    ...op,
    motivos: op.motivos.map((m) => ({ id: m, nombre: MOTIVOS[m].nombre })),
    reclamo: p.reclamo ? vistaReclamo(p.reclamo, await evidenciasDe(knex, p.reclamo.id)) : null,
  }
}

/** "Todo bien, liberar pago": el saldo del taller queda disponible al instante. */
export async function liberarPorComprador(c: MedusaContainer, orderId: string, customerId: string) {
  const p = await pedidoDelCliente(c, orderId, customerId)
  if (!p) throw new ErrorReclamo("No encontramos ese pedido.", 404)
  if (p.pedido.status === "canceled") throw new ErrorReclamo("Ese pedido está cancelado.", 409)
  const op = opcionesCliente(p.saldo, { enviado: salio(p.pedido), hayReclamo: Boolean(p.reclamo) })
  if (!op.puede_liberar) {
    if (p.reclamo) throw new ErrorReclamo("Este pedido tiene un reclamo abierto: HETNA lo está revisando.", 409)
    if (p.saldo?.aceptado_en || p.saldo?.estado === "disponible" || p.saldo?.estado === "pagado")
      throw new ErrorReclamo("El pago de este pedido ya se liberó al taller.", 409)
    throw new ErrorReclamo("Todavía no puedes liberar este pago: el pedido no ha salido del taller.", 409)
  }
  const knex = knexDe(c)
  await asegurarTablaGuias(knex)
  const guia = await knex(T_GUIAS).where({ order_id: orderId }).first("order_id")
  const ahora = new Date()
  const n = await knex(T_SALDO)
    .where({ order_id: orderId, estado: "pendiente" })
    .whereNull("aceptado_en")
    .update({
      estado: "disponible",
      disponible_en: ahora,
      aceptado_en: ahora,
      entregado_en: p.saldo.entregado_en || ahora,
      entregado_por: p.saldo.entregado_por || "comprador",
      // Si HETNA hizo la guía, el envío que pagó el cliente cubre esa guía
      envio_al_taller: !guia,
      actualizado: knex.fn.now(),
    })
  if (!n) throw new ErrorReclamo("El pago de este pedido ya se liberó o está en revisión.", 409)
  return { pedido: p.pedido }
}

/** "Tengo un problema": abre el reclamo, liga la evidencia y congela el pago. */
export async function abrirReclamo(
  c: MedusaContainer,
  d: { orderId: string; customerId: string; motivo: unknown; detalle: unknown; evidencias: unknown }
) {
  const motivo = d.motivo
  if (!esMotivo(motivo)) throw new ErrorReclamo("Elige qué pasó con tu pedido.")
  const detalle = String(d.detalle || "").trim().slice(0, 2000)
  if (detalle.length < 15) throw new ErrorReclamo("Explica qué pasó (al menos una frase completa).")
  revisarContacto(detalle)
  const ids = Array.isArray(d.evidencias) ? (d.evidencias as unknown[]).filter((x): x is string => typeof x === "string").slice(0, MAX_EVIDENCIAS) : []

  const p = await pedidoDelCliente(c, d.orderId, d.customerId)
  if (!p) throw new ErrorReclamo("No encontramos ese pedido.", 404)
  if (p.reclamo) throw new ErrorReclamo("Ya reportaste un problema con este pedido y HETNA lo está revisando.", 409)
  if (p.pedido.status === "canceled" || !pedidoPagado(p.pedido)) throw new ErrorReclamo("Este pedido no tiene un pago activo.", 409)
  const op = opcionesCliente(p.saldo, { enviado: salio(p.pedido), hayReclamo: false })
  if (!op.motivos.includes(motivo)) {
    throw new ErrorReclamo(
      p.saldo?.aceptado_en
        ? "Ya liberaste el pago de este pedido: sólo puedes reportar una falla de garantía."
        : `Pasó el plazo de ${DIAS_DEVOLUCION} días para este tipo de reclamo. Si es una falla de funcionamiento, elige «garantía».`,
      409
    )
  }

  const knex = knexDe(c)
  const evidencias = ids.length
    ? await knex(T_EVIDENCIA).whereIn("id", ids).where({ order_id: d.orderId, autor: "cliente", autor_id: d.customerId }).whereNull("reclamo_id").select("id")
    : []
  if (motivo !== "no_llego" && !evidencias.length) {
    throw new ErrorReclamo("Sube al menos una foto o video que muestre el problema.")
  }

  const ahora = new Date()
  const entregado = p.saldo.entregado_en ? new Date(p.saldo.entregado_en) : null
  const id = `rec_${randomBytes(12).toString("hex")}`
  const filas = await knex(T_RECLAMO)
    .insert({
      id,
      order_id: d.orderId,
      display_id: p.pedido.display_id ?? null,
      seller_id: p.saldo.seller_id,
      customer_id: d.customerId,
      motivo,
      detalle,
      estado: "abierto",
      entregado_en: entregado,
      horas_desde_entrega: entregado ? Math.round((ahora.getTime() - entregado.getTime()) / 36e5) : null,
      saldo_estado_previo: p.saldo.estado,
      responder_antes: sumarDiasHabiles(ahora, DIAS_HABILES_RESPUESTA),
    })
    .onConflict("order_id")
    .ignore()
    .returning("*")
  const r = filas?.[0]
  if (!r) throw new ErrorReclamo("Ya reportaste un problema con este pedido y HETNA lo está revisando.", 409)
  if (evidencias.length) {
    await knex(T_EVIDENCIA).whereIn("id", evidencias.map((e: any) => e.id)).whereNull("reclamo_id").update({ reclamo_id: id })
  }
  // Se congela lo que todavía no se le paga al taller
  await knex(T_SALDO)
    .where({ order_id: d.orderId })
    .whereIn("estado", ["pendiente", "disponible"])
    .update({ estado: "retenido", motivo: `Reclamo ${folioReclamo(r.folio)} del cliente: ${MOTIVOS[motivo].nombre}`.slice(0, 300), actualizado: knex.fn.now() })
  return { reclamo: r, pedido: p.pedido, saldo: p.saldo }
}

/** El taller responde con su versión y su evidencia. */
export async function responderReclamo(
  c: MedusaContainer,
  d: { id: string; sellerId: string; respuesta: unknown; evidencias: unknown }
) {
  const knex = knexDe(c)
  await asegurarTablasReclamo(knex)
  const r = await knex(T_RECLAMO).where({ id: d.id, seller_id: d.sellerId }).first()
  if (!r) throw new ErrorReclamo("No encontramos ese reclamo.", 404)
  if (r.estado === "resuelto") throw new ErrorReclamo("Este reclamo ya se resolvió.", 409)
  if (r.respuesta_taller) throw new ErrorReclamo("Ya respondiste este reclamo. Si tienes algo más, escríbenos por mensaje.", 409)
  const respuesta = String(d.respuesta || "").trim().slice(0, 3000)
  if (respuesta.length < 15) throw new ErrorReclamo("Escribe tu versión de lo que pasó (al menos una frase completa).")
  revisarContacto(respuesta)
  const ids = Array.isArray(d.evidencias) ? (d.evidencias as unknown[]).filter((x): x is string => typeof x === "string").slice(0, MAX_EVIDENCIAS) : []
  const n = await knex(T_RECLAMO)
    .where({ id: r.id })
    .whereNull("respuesta_taller")
    .whereNot("estado", "resuelto")
    .update({ respuesta_taller: respuesta, respondido_en: new Date(), estado: "respondido", actualizado: knex.fn.now() })
  if (!n) throw new ErrorReclamo("Ya respondiste este reclamo.", 409)
  if (ids.length) {
    await knex(T_EVIDENCIA)
      .whereIn("id", ids)
      .where({ order_id: r.order_id, autor: "taller", autor_id: d.sellerId })
      .whereNull("reclamo_id")
      .update({ reclamo_id: r.id })
  }
  return knex(T_RECLAMO).where({ id: r.id }).first()
}

/** HETNA decide. Mueve el saldo del taller y, si procede, le descuenta. */
export async function decidirReclamo(
  c: MedusaContainer,
  d: { id: string; decision: unknown; monto?: unknown; guiaPaga?: unknown; costoGuia?: unknown; nota?: unknown; adminId?: string | null }
) {
  if (!esDecision(d.decision)) throw new ErrorReclamo("Elige la decisión.")
  const decision = d.decision
  const nota = String(d.nota || "").trim().slice(0, 2000)
  if (nota.length < 10) throw new ErrorReclamo("Escribe la explicación que verán el cliente y el taller.")
  const knex = knexDe(c)
  await asegurarTablasReclamo(knex)
  await asegurarTablaSaldos(knex)
  const r = await knex(T_RECLAMO).where({ id: d.id }).first()
  if (!r) throw new ErrorReclamo("No encontramos ese reclamo.", 404)
  if (r.estado === "resuelto") throw new ErrorReclamo("Este reclamo ya se resolvió.", 409)
  const saldo = await knex(T_SALDO).where({ order_id: r.order_id }).first()
  if (!saldo) throw new ErrorReclamo("Este pedido no tiene renglón de saldo.", 409)
  const guiaPaga = d.guiaPaga === "cliente" ? "cliente" : d.guiaPaga === "taller" ? "taller" : MOTIVOS[r.motivo as Motivo]?.guia || "taller"
  const monto = Number(d.monto)
  if (decision === "reembolso_parcial" && !(monto > 0)) throw new ErrorReclamo("Escribe el monto del reembolso parcial.")
  const calc = calcularDecision({ decision, monto, guiaPaga, costoGuia: Number(d.costoGuia) || 0 }, saldo)
  const folio = folioReclamo(r.folio)
  await asegurarTablaGuias(knex)

  await knex.transaction(async (trx: any) => {
    const n = await trx(T_RECLAMO)
      .where({ id: r.id })
      .whereNot("estado", "resuelto")
      .update({
        estado: "resuelto",
        decision,
        monto_reembolso: calc.monto || null,
        guia_paga: guiaPaga,
        costo_guia: Number(d.costoGuia) > 0 ? r2(Number(d.costoGuia)) : null,
        descontado_taller: calc.descuento || null,
        decision_nota: nota,
        decidido_en: new Date(),
        decidido_por: d.adminId || null,
        actualizado: trx.fn.now(),
      })
    if (!n) throw new ErrorReclamo("Este reclamo ya se resolvió.", 409)
    if (calc.estadoSaldo === "disponible") {
      const guia = await trx(T_GUIAS).where({ order_id: r.order_id }).first("order_id")
      await trx(T_SALDO)
        .where({ order_id: r.order_id })
        .whereIn("estado", ["pendiente", "disponible", "retenido"])
        .update({
          estado: "disponible",
          disponible_en: new Date(),
          envio_al_taller: !guia,
          motivo: decision === "liberar" ? null : `Reclamo ${folio}: reembolso parcial descontado aparte`.slice(0, 300),
          actualizado: trx.fn.now(),
        })
    } else if (calc.estadoSaldo === "retenido") {
      await trx(T_SALDO)
        .where({ order_id: r.order_id })
        .whereIn("estado", ["pendiente", "disponible", "retenido"])
        .update({ estado: "retenido", motivo: `Reclamo ${folio}: reembolso total al cliente`.slice(0, 300), actualizado: trx.fn.now() })
    }
    if (calc.descuento > 0) {
      const partes = [
        decision === "reembolso_total" && saldo.estado === "pagado" ? "reembolso total (ya pagado)" : "",
        decision === "reembolso_parcial" ? `reembolso parcial ${calc.monto.toFixed(2)}` : "",
        guiaPaga === "taller" && Number(d.costoGuia) > 0 ? `guía de regreso ${r2(Number(d.costoGuia)).toFixed(2)}` : "",
      ].filter(Boolean)
      await trx(T_SALDO)
        .insert({
          order_id: `${PREFIJO_RECLAMO}${r.id}`,
          seller_id: saldo.seller_id,
          display_id: saldo.display_id ?? null,
          moneda: saldo.moneda || "mxn",
          productos: -calc.descuento,
          envio: 0,
          comision: 0,
          envio_al_taller: false,
          digital: false,
          estado: "disponible",
          disponible_en: new Date(),
          motivo: `Reclamo ${folio} (pedido #${saldo.display_id ?? "—"}): ${partes.join(" + ")}`.slice(0, 300),
        })
        .onConflict("order_id")
        .ignore()
    }
  })
  return { reclamo: await knex(T_RECLAMO).where({ id: r.id }).first(), calc, saldo }
}

/** Reclamos en los que al taller se le acabó el plazo sin responder. Se marcan
 *  una vez (para avisar a HETNA) y se devuelven. */
export async function marcarSinRespuesta(knex: any) {
  await asegurarTablasReclamo(knex)
  return knex(T_RECLAMO)
    .where({ estado: "abierto", taller_no_respondio: false })
    .whereNull("respuesta_taller")
    .where("responder_antes", "<", new Date())
    .update({ taller_no_respondio: true, actualizado: knex.fn.now() })
    .returning(["id", "folio", "order_id", "display_id", "seller_id", "motivo"])
}
