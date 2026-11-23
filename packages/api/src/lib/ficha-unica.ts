// Ficha única de cliente, taller y proveedor (Fase 3.1 de docs/analisis-sap-fase0.md).
//
// En el panel de HETNA se escribe un correo, un teléfono o un nombre y se ve en
// un solo lugar todo lo de esa persona o empresa, que hoy está repartido:
//   • Tienda: cuenta, pedidos, carritos sin terminar, créditos de diseño y su
//     reputación como comprador.
//   • Licitaciones y Escanear: lo que ha pedido.
//   • Taller: si vende en la tienda (saldos, propuestas, reseñas), si tiene la
//     app del Cotizador (plan) y si es proveedor de algún taller.
//   • WhatsApp: su número, si pidió no recibir mensajes y lo último que escribió.
// Y propone la siguiente acción con un mensaje listo; la persona del equipo
// decide y lo manda (nunca se manda solo).
//
// Es una vista: no copia ni guarda datos. Cada parte se lee por separado; si
// una falla, las demás se muestran igual y la falla queda anotada.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { STORE_URL, asegurarTablas, folioTexto } from "./licitacion"
import { NOMBRE_ESTADO, T_ESCANEAR, asegurarEscanear, folioEscanear } from "./escanear"
import { resumenSaldos } from "./saldos-talleres"
import { reputacionCliente } from "./trust"
import { T_WA, asegurarWhatsapp, normalizarNumero } from "./whatsapp"
import { T_MSG } from "./whatsapp-bot"
import { planEfectivo, supa, type Taller } from "./cotizador-crm"
import { supabaseListo } from "./cotizador-suscripciones"
import { escaparIlike, ordenesDeProveedor } from "./proveedor-panel"

// ---------------------------------------------------------------------
// Claves de búsqueda
// ---------------------------------------------------------------------

export const ultimos10 = (v: unknown) => String(v ?? "").replace(/\D/g, "").slice(-10)
const correoValido = (c: string) => /^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/.test(c)
const limpiaCorreo = (c: unknown) => {
  const e = String(c ?? "").trim().toLowerCase()
  return correoValido(e) ? e : ""
}

/** Qué escribió: un correo, un teléfono (10 dígitos o más) o un nombre. */
export function interpretarBusqueda(q: string): { tipo: "correo" | "telefono" | "nombre"; valor: string } | null {
  const t = String(q || "").trim()
  if (!t) return null
  if (t.includes("@")) {
    const e = limpiaCorreo(t)
    return e ? { tipo: "correo", valor: e } : null
  }
  const digitos = t.replace(/\D/g, "")
  if (digitos.length >= 10 && digitos.length >= t.replace(/[\s()+\-.]/g, "").length - 1) return { tipo: "telefono", valor: digitos.slice(-10) }
  return t.length >= 3 ? { tipo: "nombre", valor: t.slice(0, 80) } : null
}

const sinDuplicados = (xs: string[]) => [...new Set(xs.filter(Boolean))]
const SQL_10 = (col: string) => `right(regexp_replace(coalesce(${col}, ''), '\\D', '', 'g'), 10)`
const likeSeguro = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

// ---------------------------------------------------------------------
// Buscar: lista de personas o empresas que coinciden
// ---------------------------------------------------------------------

export type Candidato = { tipo: "cliente" | "taller" | "licitacion" | "cotizador"; nombre: string; email: string | null; telefono: string | null; detalle: string }

export async function buscarCandidatos(scope: any, q: string): Promise<Candidato[]> {
  const b = interpretarBusqueda(q)
  if (!b) return []
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const out: Candidato[] = []
  const nombre = (f: any) => [f.first_name, f.last_name].filter(Boolean).join(" ") || f.company_name || f.email || "Cliente"

  // Clientes de la tienda
  try {
    let qc = knex("customer").whereNull("deleted_at").select("id", "email", "phone", "first_name", "last_name", "company_name", "created_at").limit(10)
    if (b.tipo === "correo") qc = qc.whereRaw("lower(email) = ?", [b.valor])
    else if (b.tipo === "telefono") qc = qc.whereRaw(`${SQL_10("phone")} = ?`, [b.valor])
    else qc = qc.where((w: any) => w.whereILike("first_name", likeSeguro(b.valor)).orWhereILike("last_name", likeSeguro(b.valor)).orWhereILike("company_name", likeSeguro(b.valor)).orWhereILike("email", likeSeguro(b.valor)))
    for (const f of await qc) out.push({ tipo: "cliente", nombre: nombre(f), email: f.email || null, telefono: f.phone || null, detalle: `Cliente de la tienda desde ${String(f.created_at).slice(0, 10)}` })
  } catch {}

  // Talleres que venden en la tienda
  try {
    let qs = knex("seller").whereNull("deleted_at").select("id", "name", "email", "phone", "status").limit(10)
    if (b.tipo === "correo") qs = qs.whereRaw("lower(email) = ?", [b.valor])
    else if (b.tipo === "telefono") qs = qs.whereRaw(`${SQL_10("phone")} = ?`, [b.valor])
    else qs = qs.where((w: any) => w.whereILike("name", likeSeguro(b.valor)).orWhereILike("email", likeSeguro(b.valor)))
    for (const f of await qs) out.push({ tipo: "taller", nombre: f.name || f.email || "Taller", email: f.email || null, telefono: f.phone || null, detalle: `Taller en la tienda (${f.status || "sin estado"})` })
  } catch {}

  // Contactos de licitaciones (compradores sin cuenta)
  try {
    await asegurarTablas(knex)
    let ql = knex("hetna_solicitud").select("folio", "contacto", "created_at").orderBy("created_at", "desc").limit(10)
    if (b.tipo === "correo") ql = ql.whereRaw("lower(contacto->>'email') = ?", [b.valor])
    else if (b.tipo === "telefono") ql = ql.whereRaw(`(${SQL_10("contacto->>'whatsapp'")} = ? or ${SQL_10("contacto->>'telefono'")} = ?)`, [b.valor, b.valor])
    else ql = ql.whereRaw("(contacto->>'nombre' ilike ? or contacto->>'empresa' ilike ?)", [likeSeguro(b.valor), likeSeguro(b.valor)])
    for (const f of await ql) {
      const c = f.contacto || {}
      out.push({ tipo: "licitacion", nombre: c.empresa || c.nombre || c.email || "Comprador", email: c.email || null, telefono: c.whatsapp || c.telefono || null, detalle: `Pidió ${folioTexto(f.folio)} el ${String(f.created_at).slice(0, 10)}` })
    }
  } catch {}

  // Talleres de la app del Cotizador
  if (supabaseListo()) {
    try {
      const filtro =
        b.tipo === "correo" ? `correo=ilike.${encodeURIComponent(escaparIlike(b.valor))}`
        : b.tipo === "telefono" ? `telefono=ilike.${encodeURIComponent(`*${b.valor.slice(-8)}*`)}`
        : `nombre=ilike.${encodeURIComponent(`*${escaparIlike(b.valor)}*`)}`
      const filas = await supa<any[]>(`/rest/v1/negocios?${filtro}&select=id,nombre,correo,telefono,plan&limit=10`)
      for (const f of filas || []) {
        if (b.tipo === "telefono" && ultimos10(f.telefono) !== b.valor) continue
        out.push({ tipo: "cotizador", nombre: f.nombre || f.correo || "Taller", email: f.correo || null, telefono: f.telefono || null, detalle: `Taller en la app del Cotizador (plan ${f.plan || "gratis"})` })
      }
    } catch {}
  }

  // Una persona puede salir varias veces (cliente y taller): se juntan por correo o teléfono
  const vistos = new Set<string>()
  return out.filter((c) => {
    const k = `${c.tipo}|${(c.email || "").toLowerCase()}|${ultimos10(c.telefono)}|${c.nombre}`
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  }).slice(0, 30)
}

// ---------------------------------------------------------------------
// La ficha
// ---------------------------------------------------------------------

export type Ficha = {
  claves: { correos: string[]; telefonos: string[] }
  clientes: { id: string; nombre: string; email: string | null; telefono: string | null; creado: string; correo_verificado: boolean }[]
  pedidos: { cuantos: number; gastado: Record<string, number>; ultimo: string | null; recientes: { id: string; numero: number; estado: string; total: number; moneda: string; creado: string }[] }
  carritos: { id: string; email: string | null; total: number; moneda: string; actualizado: string; articulos: string[] }[]
  creditos: { saldo: number } | null
  reputacion: { promedio: number | null; evaluaciones: number } | null
  licitaciones: { folio: string; estado: string; creado: string; descripcion: string; propuestas: number; elegida: boolean }[]
  escanear: { id: string; folio: string; titulo: string; estado: string; nombre_estado: string; creado: string }[]
  talleres: { id: string; nombre: string; email: string | null; telefono: string | null; estado: string | null; saldos: Record<string, Record<string, number>>; propuestas: Record<string, number>; resenas: { promedio: number | null; cuantas: number } }[]
  cotizador: { id: string; nombre: string | null; correo: string | null; telefono: string | null; plan: string | null; plan_efectivo: string; trial_hasta: string | null; creado: string | null }[]
  proveedor: { talleres: string[]; ordenes: number; abiertas: number; por_confirmar: number } | null
  whatsapp: { numeros: { numero: string; quien: string | null; avisos: boolean; verificado: boolean }[]; mensajes: { numero: string; rol: string; texto: string; fecha: string }[] }
  errores: string[]
}

async function parte<T>(errores: string[], nombre: string, f: () => Promise<T>, vacio: T): Promise<T> {
  try {
    return await f()
  } catch (e) {
    errores.push(`${nombre}: ${String((e as Error)?.message || e).slice(0, 160)}`)
    return vacio
  }
}

export async function armarFicha(scope: any, entrada: { correo?: string | null; telefono?: string | null }): Promise<Ficha> {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as any
  const errores: string[] = []
  let correos = sinDuplicados([limpiaCorreo(entrada.correo)])
  let telefonos = sinDuplicados([ultimos10(entrada.telefono)].filter((t) => t.length === 10))
  if (!correos.length && !telefonos.length) throw new Error("Escribe un correo o un teléfono de 10 dígitos.")

  const buscarClientes = async () => {
    const filas = await knex("customer").whereNull("deleted_at")
      .where((w: any) => {
        if (correos.length) w.orWhereRaw(`lower(email) in (${correos.map(() => "?").join(",")})`, correos)
        if (telefonos.length) w.orWhereRaw(`${SQL_10("phone")} in (${telefonos.map(() => "?").join(",")})`, telefonos)
      })
      .select("id", "email", "phone", "first_name", "last_name", "company_name", "created_at", "metadata").limit(10)
    return filas as any[]
  }
  const buscarTalleres = async () =>
    (await knex("seller").whereNull("deleted_at")
      .where((w: any) => {
        if (correos.length) w.orWhereRaw(`lower(email) in (${correos.map(() => "?").join(",")})`, correos)
        if (telefonos.length) w.orWhereRaw(`${SQL_10("phone")} in (${telefonos.map(() => "?").join(",")})`, telefonos)
      })
      .select("id", "name", "email", "phone", "status").limit(5)) as any[]

  // Un salto: con el correo se encuentra el teléfono y al revés (sin seguir más
  // allá, para no juntar a personas distintas).
  let filasClientes = await parte(errores, "Clientes", buscarClientes, [])
  let filasTalleres = await parte(errores, "Talleres", buscarTalleres, [])
  const masCorreos = [...filasClientes, ...filasTalleres].map((f) => limpiaCorreo(f.email))
  const masTels = [...filasClientes, ...filasTalleres].map((f) => ultimos10(f.phone)).filter((t) => t.length === 10)
  const nuevosC = sinDuplicados([...correos, ...masCorreos]).slice(0, 5)
  const nuevosT = sinDuplicados([...telefonos, ...masTels]).slice(0, 5)
  if (nuevosC.length !== correos.length || nuevosT.length !== telefonos.length) {
    correos = nuevosC
    telefonos = nuevosT
    filasClientes = await parte(errores, "Clientes", buscarClientes, filasClientes)
    filasTalleres = await parte(errores, "Talleres", buscarTalleres, filasTalleres)
  }
  const idsClientes = filasClientes.map((f) => String(f.id))
  const idsTalleres = filasTalleres.map((f) => String(f.id))

  const clientes = filasClientes.map((f) => {
    const md = typeof f.metadata === "string" ? JSON.parse(f.metadata || "{}") : f.metadata || {}
    return {
      id: String(f.id),
      nombre: [f.first_name, f.last_name].filter(Boolean).join(" ") || f.company_name || f.email || "Cliente",
      email: f.email || null,
      telefono: f.phone || null,
      creado: f.created_at ? new Date(f.created_at).toISOString() : "",
      correo_verificado: md?.correo_verificado === true,
    }
  })

  const [pedidos, carritos, creditos, reputacion, licitaciones, escanear, talleres, cotizador, proveedor, whatsapp] = await Promise.all([
    parte(errores, "Pedidos", async () => {
      if (!idsClientes.length && !correos.length) return { cuantos: 0, gastado: {}, ultimo: null, recientes: [] }
      const filtros = idsClientes.length ? { customer_id: idsClientes } : { email: correos }
      const { data } = await query.graph({ entity: "order", fields: ["id", "display_id", "status", "total", "currency_code", "created_at"], filters: filtros, pagination: { take: 200, order: { created_at: "DESC" } } })
      const ordenes = (data || []).filter((o: any) => o.status !== "canceled" && o.status !== "draft")
      const gastado: Record<string, number> = {}
      for (const o of ordenes) gastado[o.currency_code] = Math.round(((gastado[o.currency_code] || 0) + Number(o.total || 0)) * 100) / 100
      const recientes = (data || []).slice(0, 8).map((o: any) => ({ id: o.id, numero: o.display_id, estado: o.status, total: Number(o.total || 0), moneda: o.currency_code, creado: new Date(o.created_at).toISOString() }))
      return { cuantos: ordenes.length, gastado, ultimo: ordenes[0] ? new Date(ordenes[0].created_at).toISOString() : null, recientes }
    }, { cuantos: 0, gastado: {}, ultimo: null, recientes: [] }),

    parte(errores, "Carritos", async () => {
      if (!correos.length && !idsClientes.length) return []
      const { data } = await query.graph({
        entity: "cart",
        fields: ["id", "email", "customer_id", "currency_code", "total", "updated_at", "items.title", "items.quantity"],
        filters: { completed_at: null, ...(idsClientes.length ? { customer_id: idsClientes } : { email: correos }) },
        pagination: { take: 20, order: { updated_at: "DESC" } },
      })
      const hace30 = Date.now() - 30 * 86400_000
      return (data || [])
        .filter((c: any) => (c.items || []).length && new Date(c.updated_at).getTime() > hace30)
        .map((c: any) => ({ id: c.id, email: c.email || null, total: Number(c.total || 0), moneda: c.currency_code, actualizado: new Date(c.updated_at).toISOString(), articulos: (c.items || []).map((i: any) => `${i.quantity}× ${i.title}`).slice(0, 6) }))
    }, []),

    parte(errores, "Créditos", async () => {
      if (!idsClientes.length) return null
      const r = await knex("credit_balance").whereIn("customer_id", idsClientes).whereNull("deleted_at").sum({ s: "balance" }).first()
      return { saldo: Number(r?.s || 0) }
    }, null),

    parte(errores, "Reputación", async () => {
      if (!idsClientes.length && !correos.length) return null
      const r = await reputacionCliente(knex, { clienteId: idsClientes[0] || null, email: correos[0] || null })
      return { promedio: r.promedio, evaluaciones: r.evaluaciones }
    }, null),

    parte(errores, "Licitaciones", async () => {
      await asegurarTablas(knex)
      const filas = await knex("hetna_solicitud as s")
        .where((w: any) => {
          if (correos.length) w.orWhereRaw(`lower(s.contacto->>'email') in (${correos.map(() => "?").join(",")})`, correos)
          if (telefonos.length) {
            const marcas = telefonos.map(() => "?").join(",")
            w.orWhereRaw(`${SQL_10("s.contacto->>'whatsapp'")} in (${marcas}) or ${SQL_10("s.contacto->>'telefono'")} in (${marcas})`, [...telefonos, ...telefonos])
          }
        })
        .select("s.id", "s.folio", "s.estado", "s.created_at", "s.trabajo", "s.propuesta_elegida",
          knex.raw("(select count(*) from hetna_propuesta p where p.solicitud_id = s.id) as propuestas"))
        .orderBy("s.created_at", "desc").limit(15)
      return filas.map((f: any) => {
        const t = typeof f.trabajo === "string" ? JSON.parse(f.trabajo || "{}") : f.trabajo || {}
        return { folio: folioTexto(f.folio), estado: f.estado, creado: new Date(f.created_at).toISOString(), descripcion: String(t.descripcion || "").slice(0, 140), propuestas: Number(f.propuestas || 0), elegida: !!f.propuesta_elegida }
      })
    }, []),

    parte(errores, "Escanear", async () => {
      if (!idsClientes.length) return []
      await asegurarEscanear(knex)
      const filas = await knex(T_ESCANEAR).whereIn("customer_id", idsClientes).select("id", "folio", "titulo", "estado", "creado").orderBy("creado", "desc").limit(10)
      return filas.map((f: any) => ({ id: f.id, folio: folioEscanear(f.folio), titulo: f.titulo, estado: f.estado, nombre_estado: (NOMBRE_ESTADO as any)[f.estado] || f.estado, creado: new Date(f.creado).toISOString() }))
    }, []),

    parte(errores, "Taller en la tienda", async () =>
      Promise.all(filasTalleres.map(async (t) => {
        const [saldos, props, resenas] = await Promise.all([
          resumenSaldos(knex, String(t.id)).catch(() => ({})),
          knex("hetna_propuesta").where({ seller_id: t.id }).select("estado").count({ n: "*" }).groupBy("estado").catch(() => []),
          knex("hetna_resena_taller").where({ seller_id: t.id }).avg({ p: "promedio" }).count({ n: "*" }).first().catch(() => null),
        ])
        return {
          id: String(t.id), nombre: t.name || t.email || "Taller", email: t.email || null, telefono: t.phone || null, estado: t.status || null,
          saldos: saldos as Record<string, Record<string, number>>,
          propuestas: Object.fromEntries((props as any[]).map((p) => [p.estado, Number(p.n)])),
          resenas: { promedio: (resenas as any)?.n ? Math.round(Number((resenas as any).p) * 10) / 10 : null, cuantas: Number((resenas as any)?.n || 0) },
        }
      })), []),

    parte(errores, "Cotizador", async () => {
      if (!supabaseListo()) return []
      const filas: any[] = []
      const BASE = "id,nombre,correo,telefono,plan,plan_estado,plan_renueva,plan_vence,pago_proveedor,trial_hasta,created_at"
      for (const c of correos) filas.push(...((await supa<any[]>(`/rest/v1/negocios?correo=ilike.${encodeURIComponent(escaparIlike(c))}&select=${BASE}&limit=5`)) || []))
      for (const t of telefonos) {
        const r = (await supa<any[]>(`/rest/v1/negocios?telefono=ilike.${encodeURIComponent(`*${t.slice(-8)}*`)}&select=${BASE}&limit=10`)) || []
        filas.push(...r.filter((f) => ultimos10(f.telefono) === t))
      }
      // Ligados desde la tienda (Mi taller en la app)
      if (idsClientes.length) {
        const v = await knex("hetna_cotizador_vinculo").whereIn("customer_id", idsClientes).select("negocio_id").catch(() => [])
        const ids = (v as any[]).map((x) => x.negocio_id).filter((x) => /^[0-9a-f-]{36}$/i.test(String(x)))
        if (ids.length) filas.push(...((await supa<any[]>(`/rest/v1/negocios?id=in.(${ids.join(",")})&select=${BASE}`)) || []))
      }
      const vistos = new Set<string>()
      return filas.filter((f) => !vistos.has(f.id) && vistos.add(f.id)).map((f) => ({
        id: f.id, nombre: f.nombre, correo: f.correo, telefono: f.telefono, plan: f.plan,
        plan_efectivo: planEfectivo(f as Taller), trial_hasta: f.trial_hasta || null, creado: f.created_at || null,
      }))
    }, []),

    parte(errores, "Proveedor", async () => {
      if (!supabaseListo() || !correos.length) return null
      const talleres = new Set<string>()
      let ordenes = 0, abiertas = 0, porConfirmar = 0
      for (const c of correos) {
        const r = await ordenesDeProveedor(c)
        if (!r.es_proveedor) continue
        for (const o of r.ordenes) {
          ordenes++
          talleres.add(o.taller)
          if (o.estado === "enviada" || o.estado === "parcial") {
            abiertas++
            if (!o.confirmada_en) porConfirmar++
          }
        }
      }
      return ordenes || talleres.size ? { talleres: [...talleres], ordenes, abiertas, por_confirmar: porConfirmar } : null
    }, null),

    parte(errores, "WhatsApp", async () => {
      await asegurarWhatsapp(knex)
      const numeros = sinDuplicados(telefonos.map((t) => normalizarNumero(t) || ""))
      const filas = await knex(T_WA).where((w: any) => {
        if (numeros.length) w.orWhereIn("numero", numeros)
        if (idsClientes.length) w.orWhereIn("customer_id", idsClientes)
        if (idsTalleres.length) w.orWhereIn("seller_id", idsTalleres)
      }).select("numero", "quien", "avisos", "verificado_en").limit(10)
      const todos = sinDuplicados([...numeros, ...filas.map((f: any) => String(f.numero))])
      const lista = todos.map((n) => {
        const f = filas.find((x: any) => String(x.numero) === n)
        return { numero: n, quien: f?.quien || null, avisos: f ? f.avisos !== false : true, verificado: !!f?.verificado_en }
      })
      let mensajes: Ficha["whatsapp"]["mensajes"] = []
      if (todos.length) {
        const m = await knex(T_MSG).whereIn("numero", todos).select("numero", "rol", "texto", "created_at").orderBy("created_at", "desc").limit(15).catch(() => [])
        mensajes = (m as any[]).map((x) => ({ numero: String(x.numero), rol: x.rol, texto: String(x.texto || "").slice(0, 400), fecha: new Date(x.created_at).toISOString() }))
      }
      return { numeros: lista, mensajes }
    }, { numeros: [], mensajes: [] }),
  ])

  return { claves: { correos, telefonos }, clientes, pedidos, carritos, creditos, reputacion, licitaciones, escanear, talleres, cotizador, proveedor, whatsapp, errores }
}

// ---------------------------------------------------------------------
// Siguiente acción
// ---------------------------------------------------------------------

export type Accion = {
  clave: string
  prioridad: number // más alto, más arriba
  titulo: string
  motivo: string
  /** Mensaje listo para mandar; null = acción interna (no se le escribe a nadie). */
  mensaje: string | null
  asunto?: string
  whatsapp: string | null // número 52XXXXXXXXXX, sólo si no pidió BAJA
  correo: string | null
  liga?: string // página del panel donde se hace
}

const dias = (desde: string | null | undefined, ahora: number) => (desde ? (ahora - new Date(desde).getTime()) / 86400_000 : Infinity)
const pesos = (n: number, moneda = "mxn") => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}${moneda.toLowerCase() === "mxn" ? "" : ` ${moneda.toUpperCase()}`}`

/** Reglas sencillas sobre la ficha; el equipo decide si manda el mensaje. */
export function siguientesAcciones(f: Ficha, ahora = Date.now()): Accion[] {
  const out: Accion[] = []
  const nombre = (f.clientes[0]?.nombre || f.talleres[0]?.nombre || f.cotizador[0]?.nombre || "").split(" ")[0]
  const hola = nombre ? `Hola ${nombre}, ` : "Hola, "
  // WhatsApp sólo a un número que no pidió BAJA
  const wa = f.whatsapp.numeros.find((n) => n.avisos)?.numero || null
  const bajaWa = f.whatsapp.numeros.length > 0 && f.whatsapp.numeros.every((n) => !n.avisos)
  const correo = f.claves.correos[0] || null
  const acc = (a: Omit<Accion, "whatsapp" | "correo">): Accion => ({ ...a, whatsapp: a.mensaje ? wa : null, correo: a.mensaje ? correo : null })

  if (bajaWa) {
    out.push({ clave: "baja_whatsapp", prioridad: 100, titulo: "Pidió no recibir WhatsApp", motivo: "Escribió BAJA. Si hay que contactarle, que sea por correo.", mensaje: null, whatsapp: null, correo: null })
  }

  // Carrito sin terminar (entre 1 hora y 14 días, y sin un pedido después)
  const carrito = f.carritos.find((c) => {
    const d = dias(c.actualizado, ahora)
    return c.total > 0 && d >= 1 / 24 && d <= 14 && (!f.pedidos.ultimo || new Date(f.pedidos.ultimo).getTime() < new Date(c.actualizado).getTime())
  })
  if (carrito) {
    out.push(acc({
      clave: "carrito", prioridad: 90, titulo: `Carrito sin terminar de ${pesos(carrito.total, carrito.moneda)}`,
      motivo: `Lo dejó hace ${Math.max(1, Math.round(dias(carrito.actualizado, ahora)))} día(s): ${carrito.articulos.slice(0, 3).join(", ")}.`,
      asunto: "Tu carrito en HETNA CNC",
      mensaje: `${hola}vimos que dejaste en tu carrito ${carrito.articulos.slice(0, 2).join(" y ")}. ¿Te ayudamos con alguna duda de medidas, material o envío para terminar tu pedido? ${STORE_URL}/mx/cart`,
    }))
  }

  // Escanear: render esperando aprobación
  const render = f.escanear.find((e) => e.estado === "render_listo")
  if (render) {
    out.push(acc({
      clave: "render", prioridad: 85, titulo: `Render de ${render.folio} esperando su aprobación`, motivo: render.titulo,
      asunto: `Tu render de ${render.folio} está listo`,
      mensaje: `${hola}el render de tu pieza "${render.titulo}" (${render.folio}) ya está listo. Revísalo y apruébalo o pide ajustes aquí: ${STORE_URL}/mx/user/escanear/${render.id}`,
    }))
  }

  // Licitación abierta
  for (const l of f.licitaciones.filter((x) => x.estado === "abierta").slice(0, 2)) {
    const d = dias(l.creado, ahora)
    if (l.propuestas === 0 && d >= 2) {
      out.push({ clave: `licitacion_sin_${l.folio}`, prioridad: 80, titulo: `${l.folio} sin propuestas`, motivo: `Lleva ${Math.round(d)} días abierta sin ninguna propuesta: invita talleres que hagan ese trabajo.`, mensaje: null, whatsapp: null, correo: null, liga: "/dashboard/solicitudes" })
    } else if (l.propuestas > 0 && !l.elegida && d >= 3) {
      out.push(acc({
        clave: `licitacion_elegir_${l.folio}`, prioridad: 75, titulo: `${l.folio}: tiene ${l.propuestas} propuesta(s) y no ha elegido`, motivo: l.descripcion,
        asunto: `Propuestas para tu trabajo ${l.folio}`,
        mensaje: `${hola}tu trabajo ${l.folio} ya tiene ${l.propuestas} propuesta(s) de talleres. ¿Te ayudamos a comparar precio y tiempo para elegir? ${STORE_URL}/mx/trabajos/${l.folio}`,
      }))
    }
  }

  // Taller con dinero disponible para pagarle
  for (const t of f.talleres) {
    for (const [moneda, s] of Object.entries(t.saldos || {})) {
      if ((s.disponible || 0) > 0) {
        out.push({ clave: `pagar_${t.id}_${moneda}`, prioridad: 70, titulo: `Pagarle ${pesos(s.disponible, moneda)} a ${t.nombre}`, motivo: "Tiene saldo disponible (ventas ya liberadas).", mensaje: null, whatsapp: null, correo: null, liga: "/dashboard/pagos-talleres" })
      }
    }
  }

  // Cotizador: prueba por vencer o plan gratis
  for (const n of f.cotizador) {
    const vence = n.trial_hasta ? (new Date(n.trial_hasta).getTime() - ahora) / 86400_000 : null
    if (n.plan_efectivo === "prueba" && vence !== null && vence <= 5) {
      out.push(acc({
        clave: `prueba_${n.id}`, prioridad: 65, titulo: `Su prueba del Cotizador vence en ${Math.max(0, Math.ceil(vence))} día(s)`, motivo: n.nombre || "",
        asunto: "Tu prueba del Cotizador HETNA está por terminar",
        mensaje: `${hola}tu prueba del Cotizador HETNA para ${n.nombre || "tu taller"} termina pronto. Si te ha servido, elige tu plan para no perder tus cotizaciones y pedidos: ${STORE_URL}/cotizador/`,
      }))
    } else if (n.plan_efectivo === "gratis" && dias(n.creado, ahora) >= 14) {
      out.push(acc({
        clave: `gratis_${n.id}`, prioridad: 40, titulo: "Usa el Cotizador en plan gratis", motivo: `${n.nombre || "Su taller"} lleva ${Math.round(dias(n.creado, ahora))} días en el plan gratis.`,
        asunto: "Lo que te falta del Cotizador HETNA",
        mensaje: `${hola}¿cómo te ha ido con el Cotizador HETNA? Con un plan pagado tienes cotizaciones sin límite, inventario, costos reales y factura. Si quieres, te ayudamos a configurarlo: ${STORE_URL}/cotizador/`,
      }))
    }
  }

  // Proveedor con órdenes sin confirmar
  if (f.proveedor && f.proveedor.por_confirmar > 0) {
    out.push(acc({
      clave: "proveedor", prioridad: 60, titulo: `${f.proveedor.por_confirmar} orden(es) de compra sin confirmar`, motivo: `Talleres: ${f.proveedor.talleres.slice(0, 3).join(", ")}.`,
      asunto: "Órdenes de compra por confirmar",
      mensaje: `${hola}tienes ${f.proveedor.por_confirmar} orden(es) de compra de talleres esperando tu confirmación y fecha de entrega: ${STORE_URL}/mx/user/proveedor`,
    }))
  }

  // Cliente que ya compró y lleva tiempo sin volver
  const d = dias(f.pedidos.ultimo, ahora)
  if (f.pedidos.cuantos > 0 && d >= 90 && !carrito) {
    out.push(acc({
      clave: "volver", prioridad: 30, titulo: `No compra desde hace ${Math.round(d)} días`, motivo: `Ha hecho ${f.pedidos.cuantos} pedido(s).`,
      asunto: "¿Tienes un proyecto nuevo?",
      mensaje: `${hola}hace tiempo que no te vemos por HETNA CNC. ¿Tienes algún proyecto nuevo? Podemos cotizarte el corte, el material o el diseño: ${STORE_URL}/mx/cotizar`,
    }))
  }

  return out.sort((a, b) => b.prioridad - a.prioridad)
}

/** Ligas listas para el botón (WhatsApp con el texto o correo con asunto). */
export function ligasAccion(a: Accion) {
  return {
    whatsapp: a.mensaje && a.whatsapp ? `https://wa.me/${a.whatsapp}?text=${encodeURIComponent(a.mensaje)}` : null,
    correo: a.mensaje && a.correo ? `mailto:${a.correo}?subject=${encodeURIComponent(a.asunto || "HETNA CNC")}&body=${encodeURIComponent(a.mensaje)}` : null,
  }
}
