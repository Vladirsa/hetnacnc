// Correo semanal "Completa tus datos" a los talleres (pedido de Vlado, 23 nov 2026).
//
// Los filtros de la tienda (/mx/categories: estado del taller, tipo de taller,
// material) y las páginas "Talleres CNC en <estado>" sólo muestran lo que el
// taller llenó. El panel ya avisa qué falta (apps/vendor/src/lib/datos-faltantes.tsx),
// pero sólo lo ve quien entra al panel; este correo trae de vuelta a los demás.
//
// Reglas (las mismas del aviso del panel; si cambian aquí, cambian allá):
//   - Perfil: estado y ciudad, máquinas (no a proveedores), materiales que
//     trabaja y si emite factura.
//   - Cada producto: foto; material y medida (no a servicios); tipo de producto
//     y tiempo de entrega (sólo productos físicos).
//
// A quién y cuándo:
//   - Talleres abiertos (aprobados) con correo, que no sean cuentas de la casa.
//   - Con al menos un producto: los que no tienen ninguno reciben la campaña de
//     "publica tu primer producto" (lib/primer-producto.ts) y no se les junta otra.
//   - Máximo un correo cada 7 días. Si después de 4 correos no ha llenado nada
//     (le faltan las mismas cosas o más), se deja de mandar hasta que cambie algo.
//   - Es promocional: respeta la baja (lib/baja.ts) y lleva su liga para darse de baja.
//
// El avance se guarda en el metadata del taller (aviso_datos_faltantes).
//
// Variables:
//   DATOS_FALTANTES_APAGADO=1   apaga el correo
//   DATOS_FALTANTES_TOPE=60     correos por corrida (por defecto 60)
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"

import { estaDeBaja, ligaBaja } from "./baja"
import { correosDeLaCasa } from "./cuentas-casa"
import { leerFicha } from "./ficha-extendida"
import { VENDOR_URL, boton, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"

const DIA = 86_400_000
export const CADA_DIAS = 7
export const MAX_SIN_AVANCE = 4

type Producto = { id: string; title?: string | null; thumbnail?: string | null; status?: string | null; metadata?: Record<string, any> | null }
type Taller = {
  id: string
  name?: string | null
  email?: string | null
  status?: string | null
  metadata?: Record<string, any> | null
  products?: (Producto | null)[] | null
}
export type Avance = { n: number; ultimo?: string; faltan?: number }
export type FaltaProducto = { id: string; titulo: string; falta: string[] }

export const datosFaltantesApagado = () => ["1", "true", "si"].includes(String(process.env.DATOS_FALTANTES_APAGADO || "").toLowerCase())

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const verdadero = (v: unknown) => v === true || v === "true"

export const esDigital = (m: Record<string, any> | null | undefined) => verdadero(m?.producto_digital)
export const esServicio = (m: Record<string, any> | null | undefined) =>
  !!m?.hetna_cam_service || verdadero(m?.producto_servicio) || verdadero(m?.producto_creditos_3d)

/** Lo que le falta a un producto (mismas reglas que el aviso del panel). */
export function faltantesProducto(p: Producto): string[] {
  const m = p.metadata || {}
  const f = leerFicha(m) as Record<string, any>
  const falta: string[] = []
  if (!p.thumbnail) falta.push("foto")
  if (esServicio(m)) return falta
  if (!texto(f.material)) falta.push("material")
  if (!texto(f.medida_principal) && !texto(f.medidas)) falta.push("medida")
  if (!esDigital(m)) {
    if (!texto(f.tipo_producto)) falta.push("tipo de producto")
    if (!texto(f.entrega) && !texto(f.tiempo_produccion)) falta.push("tiempo de entrega")
  }
  return falta
}

/** Lo que le falta al perfil público (metadata.perfil del taller). */
export function faltantesPerfil(perfil: Record<string, any> | null | undefined): string[] {
  const p = perfil || {}
  const falta: string[] = []
  if (!texto(p.estado) || !texto(p.ciudad)) falta.push("estado y ciudad")
  if (p.tipo_cuenta !== "proveedor" && !(Array.isArray(p.maquinas) && p.maquinas.length)) falta.push("máquinas")
  if (!(Array.isArray(p.materiales) && p.materiales.length)) falta.push("materiales que trabajas")
  if (!["si", "no"].includes(p.factura)) falta.push("si emites factura")
  return falta
}

const productosVivos = (t: Taller) =>
  (t.products || []).filter((p): p is Producto => !!p && p.status !== "rejected" && !p.metadata?.es_curso)

/** Qué le falta a un taller: perfil y productos con huecos. */
export function faltantesTaller(t: Taller): { perfil: string[]; productos: FaltaProducto[]; total: number } {
  const perfil = faltantesPerfil(t.metadata?.perfil)
  const productos = productosVivos(t)
    .map((p) => ({ id: p.id, titulo: String(p.title || "Producto"), falta: faltantesProducto(p) }))
    .filter((p) => p.falta.length)
  return { perfil, productos, total: perfil.length + productos.reduce((n, p) => n + p.falta.length, 0) }
}

/** ¿Le toca correo hoy? null = no. */
export function tocaCorreo(t: Taller, faltan: number, ahora = new Date()): Avance | null {
  if (!faltan) return null
  if (!productosVivos(t).length) return null // le toca la campaña de primer producto
  const a = (t.metadata?.aviso_datos_faltantes as Avance | undefined) || { n: 0 }
  if (a.ultimo && ahora.getTime() - new Date(a.ultimo).getTime() < CADA_DIAS * DIA - 6 * 3_600_000) return null
  // Ya se le insistió varias veces y no llenó nada: se espera a que cambie algo
  if (a.n >= MAX_SIN_AVANCE && a.faltan !== undefined && faltan >= a.faltan) return null
  // Si llenó algo, la cuenta de insistencias vuelve a empezar
  const n = a.faltan !== undefined && faltan < a.faltan ? 0 : a.n
  return { n, ultimo: a.ultimo, faltan: a.faltan }
}

// El botón del marco no deja aire abajo: sin esto el texto siguiente queda pegado
const ESPACIO = `<div style="height:16px;line-height:16px">&nbsp;</div>`

const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`)

export function asunto(f: ReturnType<typeof faltantesTaller>): string {
  if (f.perfil.length && f.productos.length) return "Te faltan datos en HETNA: así no sales en los filtros de búsqueda"
  if (f.perfil.length) return `A tu perfil en HETNA le falta ${f.perfil[0]}`
  return f.productos.length === 1
    ? `A "${f.productos[0].titulo.slice(0, 50)}" le faltan datos para salir en los filtros`
    : `A ${f.productos.length} de tus productos les faltan datos para salir en los filtros`
}

export function cuerpoCorreo(t: Taller, f: ReturnType<typeof faltantesTaller>): string {
  const p = (x: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.55">${x}</p>`
  const nombre = esc(t.name || "tu taller")
  const partes: string[] = [
    p(`Hola: en HETNA los clientes buscan por <strong>estado del taller, tipo de máquina y material</strong>. Lo que <strong>${nombre}</strong> no tenga lleno no aparece en esos filtros ni en las páginas de "Talleres CNC en tu estado" que salen en Google.`),
  ]
  if (f.perfil.length) {
    partes.push(p(`<strong>Tu perfil:</strong> falta ${esc(lista(f.perfil))}.`))
    partes.push(boton("Completar mi perfil", `${VENDOR_URL}/perfil-taller`) + ESPACIO)
  }
  if (f.productos.length) {
    const muestra = f.productos.slice(0, 8)
    partes.push(
      p(`<strong>Tus productos:</strong>`) +
        `<ul style="margin:0 0 14px;padding-left:18px;color:#40403A;line-height:1.6">${muestra
          .map((x) => `<li><a href="${VENDOR_URL}/ficha?abrir=${encodeURIComponent(x.id)}" style="color:#B34D07;font-weight:600">${esc(x.titulo)}</a>: falta ${esc(x.falta.join(", "))}</li>`)
          .join("")}${f.productos.length > muestra.length ? `<li>y ${f.productos.length - muestra.length} más…</li>` : ""}</ul>`
    )
    partes.push(boton("Completar mis productos", `${VENDOR_URL}/ficha`) + ESPACIO)
  }
  partes.push(p("Toma unos minutos y en tu panel ves el avance. Cuando todo esté completo, dejamos de mandarte este aviso."))
  return marco("Completa tus datos para que te encuentren", partes.join(""))
}

/** Talleres con datos faltantes a los que toca mandar correo hoy. */
export async function talleresConFaltantes(container: MedusaContainer, ahora = new Date()) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "email", "status", "metadata", "products.id", "products.title", "products.thumbnail", "products.status", "products.metadata"],
    filters: { status: "open" } as any,
  })
  const casa = new Set(correosDeLaCasa().map((c) => c.toLowerCase()))
  const out: { taller: Taller; faltan: ReturnType<typeof faltantesTaller>; avance: Avance }[] = []
  for (const t of (data || []) as unknown as Taller[]) {
    if (!t.email || casa.has(t.email.toLowerCase())) continue
    const f = faltantesTaller(t)
    const avance = tocaCorreo(t, f.total, ahora)
    if (avance) out.push({ taller: t, faltan: f, avance })
  }
  return out
}

export async function correrDatosFaltantes(container: MedusaContainer, o: { probar?: boolean } = {}) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const sellers = container.resolve(MercurModules.SELLER) as any
  const tope = Math.max(1, Number(process.env.DATOS_FALTANTES_TOPE) || 60)
  const r = { enviados: 0, baja: 0, fallidos: 0, pendientes: 0 }

  const lista = await talleresConFaltantes(container)
  r.pendientes = lista.length
  for (const { taller, faltan, avance } of lista.slice(0, tope)) {
    if (o.probar) continue
    const correo = String(taller.email)
    const marcar = (a: Avance) => sellers.updateSellers({ id: taller.id, metadata: { ...(taller.metadata || {}), aviso_datos_faltantes: a } })

    if (await estaDeBaja(knex, correo)) {
      // Se marca como "ya se insistió" para no revisarlo con cada corrida
      await marcar({ n: MAX_SIN_AVANCE, ultimo: new Date().toISOString(), faltan: faltan.total })
      r.baja++
      continue
    }
    const envio = await sendEmail({ to: correo, subject: asunto(faltan), html: cuerpoCorreo(taller, faltan), bajaUrl: ligaBaja(correo) })
    if (!envio.sent) {
      r.fallidos++
      if (envio.configuracion) break
      continue
    }
    await marcar({ n: avance.n + 1, ultimo: new Date().toISOString(), faltan: faltan.total })
    r.enviados++
    // También por WhatsApp si el taller lo verificó (respeta BAJA): ahí sí lo lee
    if (faltan.perfil.length) {
      const { avisarWhatsapp } = require("./whatsapp")
      await avisarWhatsapp(
        knex,
        { sellerIds: [taller.id] },
        {
          titulo: "Su perfil en HETNA está casi listo",
          cuerpo: `Le falta: ${faltan.perfil.join(", ")}. Con el perfil al 100 % sale en los filtros y en las páginas de talleres de su estado, y le llegan más solicitudes que encajan con lo que hace.`,
          url: "/seller/perfil-taller",
        }
      ).catch(() => 0)
    }
  }
  return r
}
