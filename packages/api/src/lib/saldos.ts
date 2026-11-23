// @ts-nocheck
// Saldos y recargas de las plataformas que se pagan por adelantado (por ahora
// Skydropx, que cobra cada guía de su saldo).
//
// Qué hace:
//   - Lee el saldo real de Skydropx (GET /finance/credits) y lo anota cada hora
//     a lo más (hetna_saldo_lectura). Con eso calcula cuánto se gasta al día y
//     para cuántos días alcanza.
//   - Si el saldo sube de una lectura a otra, es una RECARGA: la anota sola en
//     hetna_recarga para que el dueño le suba la nota de compra (factura o
//     comprobante) desde el Centro de control.
//   - Avisa en el Centro de control (y por correo) cuando hay que recargar, con
//     el monto sugerido, sin pasar nunca del tope (RECARGA_TOPE, $2,700).
//   - Avisa de los cargos extra que cobra Skydropx (sobrepesos, reexpediciones).
//
// Lo que NO hace: pagar solo. Skydropx no tiene forma de recargar por API (sólo
// se recarga en su página con tarjeta o transferencia), y un cargo automático a
// tu tarjeta sin que lo veas no conviene. Por eso: aviso a tiempo + botón que
// abre la recarga + la nota de compra guardada aquí.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { SkydropxClient } from "../modules/skydropx/client"
import { T_GUIAS } from "./guias"

export const T_LECTURA = "hetna_saldo_lectura"
export const T_RECARGA = "hetna_recarga"
const DIA = 86_400_000

export const TOPE = () => Number(process.env.RECARGA_TOPE ?? 2700)
const MINIMO = () => Number(process.env.SKYDROPX_SALDO_MINIMO ?? 800)
const DIAS_COLCHON = () => Number(process.env.SKYDROPX_DIAS_COLCHON ?? 10)
export const URL_RECARGA_SKYDROPX = process.env.SKYDROPX_URL_RECARGA || "https://pro.skydropx.com/"

let cliente = null
const skydropx = () =>
  process.env.SKYDROPX_CLIENT_ID && process.env.SKYDROPX_CLIENT_SECRET
    ? (cliente ??= new SkydropxClient({
        clientId: process.env.SKYDROPX_CLIENT_ID,
        clientSecret: process.env.SKYDROPX_CLIENT_SECRET,
        sandbox: process.env.SKYDROPX_SANDBOX === "true",
      }))
    : null

let listas = false
export async function asegurarTablasSaldos(knex) {
  if (listas) return
  if (!(await knex.schema.hasTable(T_LECTURA))) {
    await knex.schema.createTable(T_LECTURA, (t) => {
      t.increments("id")
      t.text("plataforma").notNullable().index()
      t.decimal("saldo", 12, 2).notNullable()
      t.timestamp("leido", { useTz: true }).notNullable().defaultTo(knex.fn.now()).index()
    })
  }
  if (!(await knex.schema.hasTable(T_RECARGA))) {
    await knex.schema.createTable(T_RECARGA, (t) => {
      t.increments("id")
      t.text("plataforma").notNullable().index()
      t.decimal("monto", 12, 2).notNullable()
      t.text("origen").notNullable().defaultTo("detectada") // detectada | manual
      t.text("comprobante_url")
      t.text("nota")
      t.timestamp("fecha", { useTz: true }).notNullable().defaultTo(knex.fn.now()).index()
    })
  }
  listas = true
}

// La respuesta de Skydropx puede venir plana o en formato JSON:API.
// Ojo: un campo que no viene NO es saldo 0 (antes Number("") daba 0 y el
// contador avisaba "te quedan $0" con saldo real de $352).
const numero = (v) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean" || typeof v === "object") return null
  const t = String(v).replace(/[^0-9.-]/g, "")
  if (!t || t === "-" || t === ".") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
// Nombres posibles del saldo, del más confiable al menos
const LLAVES_SALDO = ["balance", "available_balance", "available", "saldo", "credits", "credit", "current_balance", "amount", "total"]
export function saldoDe(j) {
  const raiz = Array.isArray(j?.data) ? j.data[0] : j?.data ?? j
  const lugares = [j, raiz, raiz?.attributes, j?.data?.attributes, raiz?.balance, j?.balance].filter((x) => x && typeof x === "object")
  for (const llave of LLAVES_SALDO) {
    for (const o of lugares) {
      const n = numero(o[llave])
      if (n !== null) return n
      // { balance: { amount: "352.17", currency: "MXN" } }
      if (o[llave] && typeof o[llave] === "object") {
        const m = numero(o[llave].amount ?? o[llave].value ?? o[llave].total)
        if (m !== null) return m
      }
    }
  }
  return null
}

let cache = null // { saldo, leido }
export async function leerSaldoSkydropx(): Promise<number | null> {
  const c = skydropx()
  if (!c) return null
  if (cache && Date.now() - cache.leido < 5 * 60_000) return cache.saldo
  const j = await c.req("GET", "/finance/credits")
  const saldo = saldoDe(j)
  if (saldo !== null) cache = { saldo, leido: Date.now() }
  // Si cambia el formato, que se vea en el log qué llegó (sin datos sensibles: sólo llaves)
  else console.warn("[saldos] No encontré el saldo en la respuesta de Skydropx /finance/credits. Llaves:", JSON.stringify(Object.keys(j?.data?.attributes || j?.data || j || {})))
  return saldo
}

// Cargos extra (sobrepesos, reexpediciones…) de la primera página
export async function cargosExtraSkydropx(): Promise<{ monto: number; fecha: string | null; concepto: string }[]> {
  const c = skydropx()
  if (!c) return []
  const j = await c.req("GET", "/finance/extra-charges?page=1")
  const lista = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : []
  return lista.map((x) => {
    const a = x?.attributes || x || {}
    return {
      monto: numero(a.amount ?? a.total ?? a.charge) || 0,
      fecha: a.created_at || a.date || null,
      concepto: String(a.concept || a.description || a.charge_type || a.type || "Cargo extra"),
    }
  })
}

/**
 * Lee el saldo, lo anota (máximo una vez por hora), detecta recargas y calcula
 * el gasto diario. Devuelve null si Skydropx no está configurado.
 */
export async function estadoSaldoSkydropx(container) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablasSaldos(knex)
  const saldo = await leerSaldoSkydropx()
  if (saldo === null) return null

  // Lecturas falsas en $0 de antes de corregir saldoDe: si TODAS las anotadas son
  // 0 y ahora hay saldo, se borran para que no cuente como una recarga.
  if (saldo > 0) {
    const real = await knex(T_LECTURA).where({ plataforma: "skydropx" }).where("saldo", "<>", 0).first()
    if (!real) await knex(T_LECTURA).where({ plataforma: "skydropx", saldo: 0 }).del()
  }
  const ultima = await knex(T_LECTURA).where({ plataforma: "skydropx" }).orderBy("leido", "desc").first()
  if (!ultima || Date.now() - new Date(ultima.leido).getTime() > 60 * 60_000) {
    await knex(T_LECTURA).insert({ plataforma: "skydropx", saldo })
    // Subió más de $50 desde la lectura anterior: alguien recargó
    const antes = ultima ? Number(ultima.saldo) : null
    if (antes !== null && saldo - antes > 50) {
      await knex(T_RECARGA).insert({ plataforma: "skydropx", monto: Math.round((saldo - antes) * 100) / 100, origen: "detectada" })
    }
  }

  // Gasto diario: lo que costaron las guías de los últimos 14 días
  let gastoDia = 0
  if (await knex.schema.hasTable(T_GUIAS)) {
    const [{ g }] = await knex(T_GUIAS)
      .whereIn("estado", ["lista", "entregada"])
      .where("creado", ">", new Date(Date.now() - 14 * DIA))
      .sum({ g: "costo" })
    gastoDia = (Number(g) || 0) / 14
  }
  const dias = gastoDia > 0 ? saldo / gastoDia : null
  const objetivo = Math.max(MINIMO(), gastoDia * DIAS_COLCHON())
  const sugerida = Math.min(TOPE(), Math.max(500, Math.ceil((objetivo - saldo) / 100) * 100))
  const recargar = saldo < MINIMO() || (dias !== null && dias < 3)

  return {
    plataforma: "skydropx",
    saldo,
    gasto_dia: Math.round(gastoDia * 100) / 100,
    dias_restantes: dias === null ? null : Math.floor(dias),
    minimo: MINIMO(),
    tope: TOPE(),
    recargar,
    sugerida: recargar ? sugerida : 0,
    url_recarga: URL_RECARGA_SKYDROPX,
  }
}

export async function listarRecargas(container, limite = 30) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablasSaldos(knex)
  return knex(T_RECARGA).orderBy("fecha", "desc").limit(limite)
}

export async function guardarRecarga(container, datos: { id?: number; plataforma?: string; monto?: number; comprobante_url?: string; nota?: string }) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablasSaldos(knex)
  const limpio = {
    ...(datos.comprobante_url !== undefined ? { comprobante_url: String(datos.comprobante_url || "").slice(0, 500) || null } : {}),
    ...(datos.nota !== undefined ? { nota: String(datos.nota || "").slice(0, 500) || null } : {}),
  }
  if (datos.id) {
    await knex(T_RECARGA).where({ id: datos.id }).update(limpio)
    return knex(T_RECARGA).where({ id: datos.id }).first()
  }
  const monto = Number(datos.monto)
  if (!(monto > 0)) throw new Error("Escribe el monto de la recarga.")
  const [fila] = await knex(T_RECARGA)
    .insert({ plataforma: String(datos.plataforma || "otra").slice(0, 40), monto, origen: "manual", ...limpio })
    .returning("*")
  return fila
}
