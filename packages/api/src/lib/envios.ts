// Envíos HETNA: catálogo de códigos postales, cotizaciones guardadas y solicitudes de guía.
// HETNA revende guías de Skydropx con su propio saldo: el cliente paga a HETNA (Mercado Pago)
// y, ya pagado, se genera la guía.
import fs from "fs"
import os from "os"
import path from "path"

import { estadoPorCP } from "../modules/skydropx/client"
import { STORE_URL } from "./licitacion"

export const T_ENVIO_COT = "hetna_envio_cot"
export const T_ENVIO = "hetna_envio"

// ---------- Catálogo de códigos postales (SEPOMEX) ----------
type EntradaCP = { e: string; m: string; c: string; a: [string, string][] }
let catalogo: Record<string, EntradaCP> | null = null
let catalogoError = false

const archivoCP = () => process.env.HETNA_CP_FILE || path.join(os.homedir(), "hetna-data", "cp-mx.json")

const cargarCatalogo = () => {
  if (catalogo || catalogoError) return catalogo
  try {
    catalogo = JSON.parse(fs.readFileSync(archivoCP(), "utf8"))
  } catch {
    catalogoError = true // sin catálogo: se usa solo el estado según el C.P.
  }
  return catalogo
}

export type InfoCP = { cp: string; estado: string; municipio: string; ciudad: string; colonias: { nombre: string; tipo: string }[] }

export const hayCatalogo = () => Boolean(cargarCatalogo())

export const buscarCP = (cp: string): InfoCP | null => {
  if (!/^\d{5}$/.test(cp)) return null
  const cat = cargarCatalogo()
  if (!cat) return { cp, estado: estadoPorCP(cp), municipio: "", ciudad: "", colonias: [] }
  const e = cat[cp]
  if (!e) return null
  return { cp, estado: e.e, municipio: e.m, ciudad: e.c, colonias: e.a.map(([nombre, tipo]) => ({ nombre, tipo })) }
}

// ---------- Tablas ----------
let listo = false
export const asegurarTablasEnvio = async (knex: any) => {
  if (listo) return
  if (!(await knex.schema.hasTable(T_ENVIO_COT))) {
    await knex.schema.createTable(T_ENVIO_COT, (t: any) => {
      t.text("id").primary() // id de la cotización de Skydropx
      t.jsonb("datos").notNullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasTable(T_ENVIO))) {
    await knex.schema.createTable(T_ENVIO, (t: any) => {
      t.text("id").primary()
      t.increments("folio", { primaryKey: false })
      t.text("customer_id").notNullable().index()
      t.text("cotizacion_id").notNullable()
      t.text("tarifa_id").notNullable()
      t.jsonb("tarifa").notNullable()
      t.jsonb("origen").notNullable()
      t.jsonb("destino").notNullable()
      t.jsonb("paquete").notNullable()
      t.text("contenido").notNullable()
      t.decimal("precio", 12, 2).notNullable()
      t.text("estado").notNullable().defaultTo("pendiente_pago") // pendiente_pago | pagado | guia_generada | cancelado
      t.text("pago_url").nullable()
      t.text("pago_id").nullable()
      t.text("pago_estado").nullable()
      t.jsonb("guia").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  // Protección del envío (llegó después): valor declarado y lo que se cobró por ella.
  // `precio` es siempre el total cobrado (envío + protección).
  if (!(await knex.schema.hasColumn(T_ENVIO, "proteccion_valor"))) {
    await knex.schema.alterTable(T_ENVIO, (t: any) => {
      t.decimal("proteccion_valor", 12, 2).nullable()
      t.decimal("proteccion_costo", 12, 2).nullable()
    })
  }
  listo = true
}

// ---------- Protección del envío (SOS Protección de Skydropx) ----------
// NO es un seguro: es el mecanismo de compensación de Skydropx (política del
// 25 de junio de 2025). Cubre daño, faltante, extravío y robo hasta el valor
// declarado, con tope de $100,000 MXN; el reembolso llega en créditos a la
// cuenta de Skydropx de HETNA y HETNA se lo regresa al cliente.
// Skydropx cobra por tramos según el valor declarado; aquí se aproxima con un
// porcentaje (en octubre de 2026: $670 por $60,000 = 1.12%) más el margen de
// HETNA (20% de fábrica). La guía de Envíos HETNA se genera a mano: el aviso de
// pago le dice a HETNA que active la protección ANTES de la recolección (después
// del primer movimiento ya no se puede contratar). Todo se ajusta por variables.
const num = (v: unknown, defecto: number) => {
  const n = Number(v)
  return v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? n : defecto
}

export const configProteccion = () => ({
  tasa: num(process.env.PROTECCION_SOS_TASA, 670 / 60000),
  minimo: num(process.env.PROTECCION_SOS_MINIMO, 0),
  margen: num(process.env.PROTECCION_MARGEN, 0.2),
  valorMinimo: num(process.env.PROTECCION_VALOR_MIN, 500),
  valorMaximo: num(process.env.PROTECCION_VALOR_MAX, 100000),
})

// Lo que paga el cliente por proteger `valor` pesos (ya con el margen de HETNA)
export const costoProteccion = (valor: number) => {
  const p = configProteccion()
  return Math.round(Math.max(p.minimo, valor * p.tasa) * (1 + p.margen) * 100) / 100
}

// Lo que ve la tienda para calcular en vivo (sin separar costo y margen)
export const proteccionPublica = () => {
  const p = configProteccion()
  return { tasa: p.tasa * (1 + p.margen), minimo: p.minimo * (1 + p.margen), valorMinimo: p.valorMinimo, valorMaximo: p.valorMaximo }
}

// Una cotización se puede solicitar durante estas horas; después hay que volver a cotizar.
export const VIGENCIA_HORAS = 12

export const folioEnvio = (n: number | string) => `ENV-${String(n).padStart(5, "0")}`

// Tipos de empaque que acepta el formulario
export const EMPAQUES = ["Caja de cartón", "Sobre", "Tubo", "Bolsa o paquete blando", "Tarima o bulto"] as const

// ---------- Mercado Pago ----------
const MP_API = "https://api.mercadopago.com"
const mpToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || ""

export const crearPagoEnvio = async (p: { envioId: string; folio: string; titulo: string; monto: number; email?: string; retorno: string }) => {
  if (!mpToken()) return null
  const r = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mpToken()}`, "Content-Type": "application/json", "X-Idempotency-Key": `env-${p.envioId}` },
    body: JSON.stringify({
      items: [{ id: p.folio, title: p.titulo.slice(0, 250), quantity: 1, unit_price: Math.round(p.monto * 100) / 100, currency_id: "MXN" }],
      payer: p.email ? { email: p.email } : undefined,
      external_reference: `envio:${p.envioId}`,
      back_urls: { success: p.retorno, failure: p.retorno, pending: p.retorno },
      auto_return: "approved",
      statement_descriptor: "HETNA CNC",
      notification_url: process.env.MP_WEBHOOK_ENVIO_URL || `${STORE_URL}/api/mp-envio`,
    }),
  })
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const d = (await r.json()) as { id: string; init_point: string; sandbox_init_point?: string }
  return { id: d.id, url: (mpToken().startsWith("TEST-") && d.sandbox_init_point) || d.init_point }
}

// ---------- Validación de datos de contacto ----------
export type Contacto = { nombre: string; telefono: string; email: string; calle: string; referencias?: string; empresa?: string }

export const limpiarContacto = (c: any): Contacto | string => {
  const s = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max)
  const out: Contacto = {
    nombre: s(c?.nombre, 80),
    telefono: s(c?.telefono, 20).replace(/\D/g, ""),
    email: s(c?.email, 120).toLowerCase(),
    calle: s(c?.calle, 150),
    referencias: s(c?.referencias, 150),
    empresa: s(c?.empresa, 80),
  }
  if (out.nombre.length < 3) return "Escribe el nombre completo."
  if (out.telefono.length !== 10) return "El teléfono debe tener 10 dígitos."
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) return "Revisa el correo electrónico."
  if (out.calle.length < 5) return "Escribe la calle y el número."
  return out
}
