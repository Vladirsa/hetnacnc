// Distribuidores y referidos del Cotizador (supabase/referidos.sql de la app).
//
//   · codigos_promo: códigos que HETNA da a distribuidores de máquinas o para
//     promociones ("BAJIO90" = 90 días de HETNA Taller). El taller nuevo lo
//     escribe en la app (o entra por hetnacnc.com/distribuidores/<código>) y
//     recibe esos días de prueba.
//   · negocios.meses_a_favor: meses ganados por referidos por talleres que YA
//     pagan. La app no los puede aplicar sola (el cobro lo lleva Mercado Pago),
//     así que se ven aquí y HETNA los marca como aplicados.
//
// Todo va por la llave de servicio de Supabase del Cotizador (supa()).
import { supa } from "./cotizador-crm"

export type CodigoPromo = {
  codigo: string
  nombre: string
  dias_regalo: number
  activo: boolean
  usos: number
  max_usos: number | null
  vence: string | null
  created_at: string | null
}

const CODIGO = /^[A-Z0-9]{4,24}$/

export class ErrorDistribuidor extends Error {
  constructor(msg: string, public status = 400) { super(msg) }
}

const sinTabla = (e: unknown) => /codigos_promo|does not exist|42P01|PGRST205|referido|meses_a_favor/i.test((e as Error)?.message || "")

/** Público: lo que necesita la página del distribuidor. null si no existe o ya no vale. */
export async function codigoPublico(codigoCrudo: string) {
  const codigo = String(codigoCrudo || "").trim().toUpperCase()
  if (!CODIGO.test(codigo)) return null
  try {
    const [c] = await supa<CodigoPromo[]>(`/rest/v1/codigos_promo?codigo=eq.${codigo}&select=*&limit=1`)
    if (!c || !c.activo) return null
    if (c.vence && new Date(c.vence + "T23:59:59") < new Date()) return null
    if (c.max_usos != null && c.usos >= c.max_usos) return null
    return { codigo: c.codigo, nombre: c.nombre, dias: c.dias_regalo }
  } catch (e) {
    if (sinTabla(e)) return null
    throw e
  }
}

/** Panel: códigos, talleres con meses a favor y resumen de referidos. */
export async function panelDistribuidores() {
  let instalado = true
  const [codigos, conMeses, referidos] = await Promise.all([
    supa<CodigoPromo[]>(`/rest/v1/codigos_promo?select=*&order=created_at.desc&limit=500`).catch((e): CodigoPromo[] => { if (sinTabla(e)) { instalado = false; return [] } throw e }),
    supa<any[]>(`/rest/v1/negocios?select=id,nombre,correo,telefono,plan,meses_a_favor&meses_a_favor=gt.0&order=meses_a_favor.desc&limit=500`).catch((e): any[] => { if (sinTabla(e)) { instalado = false; return [] } throw e }),
    supa<any[]>(`/rest/v1/negocios?select=id,nombre,referido_por,referido_codigo,referido_premio,created_at&referido_codigo=not.is.null&order=created_at.desc&limit=2000`).catch((e): any[] => { if (sinTabla(e)) { instalado = false; return [] } throw e }),
  ])

  // Quién invitó a quién (talleres que más invitan)
  const ids = Array.from(new Set(referidos.map((r) => r.referido_por).filter(Boolean)))
  const nombres = new Map<string, string>()
  if (ids.length) {
    const filas = await supa<any[]>(`/rest/v1/negocios?select=id,nombre&id=in.(${ids.map(encodeURIComponent).join(",")})`).catch(() => [])
    for (const f of filas) nombres.set(f.id, f.nombre)
  }
  const porTaller = new Map<string, { id: string; nombre: string; invitados: number; completaron: number }>()
  for (const r of referidos) {
    if (!r.referido_por) continue
    const t = porTaller.get(r.referido_por) || { id: r.referido_por, nombre: nombres.get(r.referido_por) || "Taller", invitados: 0, completaron: 0 }
    t.invitados++
    if (r.referido_premio) t.completaron++
    porTaller.set(r.referido_por, t)
  }
  const codigosSet = new Set(codigos.map((c) => c.codigo))
  return {
    instalado,
    codigos,
    meses_a_favor: conMeses.map((n) => ({ id: n.id, nombre: n.nombre, correo: n.correo, telefono: n.telefono, plan: n.plan, meses: n.meses_a_favor })),
    referidos: {
      por_taller: [...porTaller.values()].sort((a, b) => b.invitados - a.invitados).slice(0, 50),
      por_distribuidor: referidos.filter((r) => !r.referido_por && codigosSet.has(r.referido_codigo)).length,
      total: referidos.filter((r) => r.referido_por).length,
      completaron: referidos.filter((r) => r.referido_por && r.referido_premio).length,
      ultimos: referidos.slice(0, 20).map((r) => ({
        nombre: r.nombre, codigo: r.referido_codigo, fecha: r.created_at,
        de: r.referido_por ? nombres.get(r.referido_por) || "Taller" : (codigos.find((c) => c.codigo === r.referido_codigo)?.nombre || "Distribuidor"),
        completo: !!r.referido_premio,
      })),
    },
  }
}

/** Panel: crear, activar/desactivar o marcar un mes a favor como aplicado. */
export async function accionDistribuidores(b: any) {
  const accion = String(b?.accion || "")
  if (accion === "crear") {
    const codigo = String(b.codigo || "").trim().toUpperCase()
    const nombre = String(b.nombre || "").trim().slice(0, 80)
    const dias = Math.round(Number(b.dias) || 0)
    const max = b.max_usos === "" || b.max_usos == null ? null : Math.round(Number(b.max_usos))
    const vence = b.vence ? String(b.vence).slice(0, 10) : null
    if (!CODIGO.test(codigo)) throw new ErrorDistribuidor("El código debe tener de 4 a 24 letras o números, sin espacios.")
    if (!nombre) throw new ErrorDistribuidor("Escribe el nombre del distribuidor o la promoción.")
    if (dias < 1 || dias > 365) throw new ErrorDistribuidor("Los días de regalo van de 1 a 365.")
    if (max != null && (!Number.isFinite(max) || max < 1)) throw new ErrorDistribuidor("El tope de usos debe ser 1 o más (o vacío para sin tope).")
    if (vence && !/^\d{4}-\d{2}-\d{2}$/.test(vence)) throw new ErrorDistribuidor("Fecha de vencimiento inválida.")
    // Que no choque con el código de un taller
    const choca = await supa<any[]>(`/rest/v1/negocios?codigo_referido=eq.${codigo}&select=id&limit=1`).catch(() => [])
    if (choca.length) throw new ErrorDistribuidor("Ese código ya lo tiene un taller. Elige otro.")
    try {
      await supa(`/rest/v1/codigos_promo`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ codigo, nombre, dias_regalo: dias, max_usos: max, vence, activo: true }),
      })
    } catch (e) {
      if (/duplicate|23505/.test((e as Error).message)) throw new ErrorDistribuidor("Ese código ya existe.")
      throw e
    }
    return { ok: true, codigo }
  }
  if (accion === "activar" || accion === "desactivar") {
    const codigo = String(b.codigo || "").trim().toUpperCase()
    if (!CODIGO.test(codigo)) throw new ErrorDistribuidor("Código inválido.")
    await supa(`/rest/v1/codigos_promo?codigo=eq.${codigo}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ activo: accion === "activar" }),
    })
    return { ok: true }
  }
  if (accion === "mes_aplicado") {
    const id = String(b.negocio_id || "")
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErrorDistribuidor("Taller inválido.")
    const [n] = await supa<any[]>(`/rest/v1/negocios?id=eq.${id}&select=meses_a_favor&limit=1`)
    const actual = Number(n?.meses_a_favor) || 0
    if (actual < 1) throw new ErrorDistribuidor("Ese taller ya no tiene meses a favor.")
    // Sólo baja si nadie lo cambió mientras tanto
    await supa(`/rest/v1/negocios?id=eq.${id}&meses_a_favor=eq.${actual}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ meses_a_favor: actual - 1 }),
    })
    return { ok: true, quedan: actual - 1 }
  }
  throw new ErrorDistribuidor("Acción desconocida.")
}
