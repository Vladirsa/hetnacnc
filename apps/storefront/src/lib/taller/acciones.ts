"use server"

// HetNa Taller: cuentas de taller, limites del plan y cotizaciones.
// Todo se valida aqui en el servidor con la sesion del cliente de la tienda:
// el navegador nunca decide el plan, el limite ni el folio.

import { Pool } from "pg"

import { retrieveCustomer } from "@/lib/data/customer"

const LIMITE_GRATIS = 10
const ESTADOS = ["Enviada", "Aceptada", "Perdida"]
const PLANES_PAGO = ["taller", "pro", "industrial"]

const global_ = globalThis as unknown as { __hetnaTallerPool?: Pool }
const pool = (): Pool => {
  if (!global_.__hetnaTallerPool) {
    const url = process.env.HETNA_TALLER_DB
    if (!url) throw new Error("Falta HETNA_TALLER_DB en el .env de la tienda")
    global_.__hetnaTallerPool = new Pool({ connectionString: url, max: 4 })
  }
  return global_.__hetnaTallerPool
}

type Fila = Record<string, any>

const texto = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const numero = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const planEfectivo = (c: Fila): string => {
  const vigente = !c.plan_hasta || new Date(c.plan_hasta).getTime() > Date.now()
  if (PLANES_PAGO.includes(c.plan) && vigente) return c.plan
  if (new Date(c.prueba_hasta).getTime() > Date.now()) return "prueba"
  return "gratis"
}

// Mes actual en hora de Mexico, p. ej. "2026-09"
const mesActual = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" }).format(new Date())

const resumenCuenta = (c: Fila) => {
  const plan = planEfectivo(c)
  const usadas = c.uso_mes === mesActual() ? Number(c.uso_n) || 0 : 0
  const dias = Math.max(0, Math.ceil((new Date(c.prueba_hasta).getTime() - Date.now()) / 864e5))
  return {
    plan,
    usadas,
    limite: plan === "gratis" ? LIMITE_GRATIS : null,
    pruebaDias: plan === "prueba" ? dias : 0,
    correo: c.correo as string,
  }
}

const cliente = async () => {
  const c = await retrieveCustomer().catch(() => null)
  return c && c.id ? c : null
}

const aHistorial = (q: Fila) => ({
  id: q.id,
  folio: q.folio,
  fecha: new Date(q.creado).getTime(),
  cliente: q.cliente_nombre || "",
  tel: q.cliente_tel || "",
  servicio: q.servicio,
  tipo: q.tipo || "",
  archivo: q.archivo || "",
  cantidad: q.cantidad,
  opciones: q.opciones || [],
  elegida: q.elegida,
  mensaje: q.mensaje || "",
  estado: q.estado,
})

// Abre (o crea) la cuenta de taller del cliente con sesion iniciada
export async function tallerCargar() {
  const c = await cliente()
  if (!c) return { ok: false as const, motivo: "sin_sesion" }
  const nombre = [c.first_name, c.last_name].filter(Boolean).join(" ")
  await pool().query(
    `INSERT INTO taller.cuentas (customer_id, correo, nombre_contacto) VALUES ($1, $2, $3)
     ON CONFLICT (customer_id) DO NOTHING`,
    [c.id, c.email || null, nombre || null]
  )
  const { rows } = await pool().query(`SELECT * FROM taller.cuentas WHERE customer_id = $1`, [c.id])
  const cta = rows[0]
  const cuenta = resumenCuenta(cta)
  const desde = cuenta.plan === "gratis" ? "now() - interval '30 days'" : "'-infinity'::timestamptz"
  const hist = await pool().query(
    `SELECT * FROM taller.cotizaciones WHERE customer_id = $1 AND creado >= ${desde} ORDER BY creado DESC LIMIT 300`,
    [c.id]
  )
  return {
    ok: true as const,
    cuenta: { ...cuenta, nombreContacto: nombre },
    config: cta.config || {},
    historial: hist.rows.map(aHistorial),
  }
}

// Guarda tarifas, costos, materiales, logo y datos del taller
export async function tallerGuardarConfig(config: Fila) {
  const c = await cliente()
  if (!c) return { ok: false, motivo: "sin_sesion" }
  const json = JSON.stringify(config || {})
  if (json.length > 400_000) return { ok: false, motivo: "muy_grande", mensaje: "El logo es muy pesado. Usa una imagen más chica." }
  const t = (config && config.taller) || {}
  await pool().query(
    `UPDATE taller.cuentas SET config = $2::jsonb, nombre_taller = $3, whatsapp = $4, actualizado = now() WHERE customer_id = $1`,
    [c.id, json, texto(t.nombre, 120) || null, texto(t.whatsapp, 30) || null]
  )
  return { ok: true }
}

// Registra una cotizacion (guardar, enviar o PDF). Aqui se cuenta el limite del plan Gratis.
export async function tallerRegistrar(p: Fila) {
  const c = await cliente()
  if (!c) return { ok: false, motivo: "sin_sesion" }
  const db = await pool().connect()
  try {
    await db.query("BEGIN")
    const { rows } = await db.query(`SELECT * FROM taller.cuentas WHERE customer_id = $1 FOR UPDATE`, [c.id])
    if (!rows[0]) { await db.query("ROLLBACK"); return { ok: false, motivo: "sin_cuenta" } }
    const cta = rows[0]
    const antes = resumenCuenta(cta)
    if (antes.limite !== null && antes.usadas >= antes.limite) {
      await db.query("ROLLBACK")
      return { ok: false, motivo: "limite", cuenta: antes }
    }
    const n = cta.folio as number
    const hoy = new Date()
    const folio = `COT-${String(hoy.getFullYear()).slice(2)}${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(n).padStart(4, "0")}`
    const mes = mesActual()
    const upd = await db.query(
      `UPDATE taller.cuentas SET folio = folio + 1,
         uso_n = CASE WHEN uso_mes = $2 THEN uso_n + 1 ELSE 1 END, uso_mes = $2
       WHERE customer_id = $1 RETURNING *`,
      [c.id, mes]
    )
    const opciones = Array.isArray(p.opciones)
      ? p.opciones.slice(0, 3).map((o: Fila) => ({ n: texto(o.n, 20), t: numero(o.t) }))
      : []
    const mensaje = texto(p.mensaje, 4000).replace(/\{\{FOLIO\}\}/g, folio)
    const datos = JSON.stringify(p.datos || {}).slice(0, 20_000)
    const ins = await db.query(
      `INSERT INTO taller.cotizaciones
        (customer_id, folio, cliente_nombre, cliente_tel, servicio, tipo, archivo, cantidad, elegida, opciones, total_estandar, mensaje, datos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb) RETURNING *`,
      [
        c.id, folio, texto(p.cliente, 120) || null, texto(p.tel, 30) || null,
        texto(p.servicio, 80) || "Servicio", texto(p.tipo, 120) || null, texto(p.archivo, 200) || null,
        Math.max(1, Math.round(numero(p.cantidad))), ["economico", "estandar", "express"].includes(p.elegida) ? p.elegida : "estandar",
        JSON.stringify(opciones), numero(p.totalEstandar), mensaje, datos,
      ]
    )
    await db.query("COMMIT")
    const despues = resumenCuenta(upd.rows[0])
    return { ok: true, id: ins.rows[0].id as string, folio, cuenta: despues, registro: aHistorial(ins.rows[0]) }
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {})
    console.error("[taller] registrar", e)
    return { ok: false, motivo: "error", mensaje: "No se pudo guardar la cotización. Intenta de nuevo." }
  } finally {
    db.release()
  }
}

export async function tallerEstado(id: string, estado: string) {
  const c = await cliente()
  if (!c) return { ok: false, motivo: "sin_sesion" }
  if (!ESTADOS.includes(estado)) return { ok: false, motivo: "estado" }
  await pool().query(`UPDATE taller.cotizaciones SET estado = $3 WHERE id = $2 AND customer_id = $1`, [c.id, id, estado])
  return { ok: true }
}

export async function tallerBorrar(id: string) {
  const c = await cliente()
  if (!c) return { ok: false, motivo: "sin_sesion" }
  await pool().query(`DELETE FROM taller.cotizaciones WHERE id = $2 AND customer_id = $1`, [c.id, id])
  return { ok: true }
}
