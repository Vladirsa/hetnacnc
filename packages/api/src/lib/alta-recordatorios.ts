// Seguimiento automático del alta de talleres (complementa lib/primer-producto.ts):
//
//   1. Recordatorio de confirmar correo: al taller que se registró y no ha
//      confirmado su correo le reenvía la liga (nueva, vale 7 días) al día 1, 3
//      y 7 de su registro. Avance en metadata.aviso_confirmar.
//   2. Felicitación por su primer producto: cuando un taller publica algo por
//      primera vez le manda un correo con la liga de su perfil para compartirla.
//      Marca metadata.felicitado_primer_producto.
//   3. Resumen para el dueño por Telegram: quién está atorado y en qué paso,
//      con liga de WhatsApp cuando el taller dejó teléfono.
//
// Variables:
//   ALTA_RECORDATORIOS_APAGADO=1   apaga todo
//   ALTA_RECORDATORIOS_TOPE=40     correos por corrida
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"

import { ALTA_DESDE, type TallerAlta, correoConfirmado, mandarConfirmacion } from "./alta-taller"
import { estaDeBaja, ligaBaja } from "./baja"
import { correosDeLaCasa } from "./cuentas-casa"
import { STORE_URL, VENDOR_URL, boton, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"
import { mandarPrivado } from "./social-telegram"

const DIA = 86_400_000
/** Días desde el registro en que se reenvía la liga de confirmar. */
export const DIAS_CONFIRMAR = [1, 3, 7]

type Avance = { n: number; ultimo?: string }

export const altaRecordatoriosApagado = () =>
  ["1", "true", "si"].includes(String(process.env.ALTA_RECORDATORIOS_APAGADO || "").toLowerCase())

const diasDesde = (d: Date | string | null | undefined, ahora: Date) =>
  d ? (ahora.getTime() - new Date(d).getTime()) / DIA : 0

/** ¿Le toca hoy el recordatorio de confirmar? Devuelve el número de recordatorio o null. */
export function tocaConfirmar(t: TallerAlta, ahora = new Date()): number | null {
  if (!t.email || correoConfirmado(t)) return null
  if (t.status && !["pending", "pending_approval", "open"].includes(String(t.status))) return null
  if (t.created_at && new Date(t.created_at).getTime() < ALTA_DESDE().getTime()) return null
  const avance = (t.metadata?.aviso_confirmar as Avance | undefined) || { n: 0 }
  if (avance.n >= DIAS_CONFIRMAR.length) return null
  if (diasDesde(t.created_at, ahora) < DIAS_CONFIRMAR[avance.n]) return null
  if (avance.ultimo && diasDesde(avance.ultimo, ahora) < 0.9) return null
  return avance.n
}

/** El paso en el que va el taller, en palabras, o null si ya terminó el alta. */
export function pasoAtorado(t: TallerAlta, tieneProductos: boolean): string | null {
  if (!correoConfirmado(t)) return "no ha confirmado su correo"
  if (t.status !== "open") return "espera tu aprobación"
  if (!tieneProductos) return "aprobado, sin productos"
  return null
}

/** Liga de WhatsApp con un mensaje listo, o "" si no hay teléfono útil. */
export function ligaWhatsapp(telefono: string | null | undefined, nombre: string, paso: string): string {
  let n = String(telefono || "").replace(/\D/g, "")
  if (n.length === 10) n = `52${n}`
  if (n.length === 13 && n.startsWith("521")) n = `52${n.slice(3)}`
  if (n.length < 11 || n.length > 13) return ""
  const texto =
    paso === "no ha confirmado su correo"
      ? `Hola, soy Vladimir de HETNA CNC. Vi que registraron ${nombre} y falta confirmar su correo para activar el taller. ¿Les llegó el correo? Si quieren se lo reenvío.`
      : paso === "aprobado, sin productos"
        ? `Hola, soy Vladimir de HETNA CNC. ${nombre} ya está activo. ¿Les ayudo a subir su primer producto o servicio? Toma 2 minutos.`
        : `Hola, soy Vladimir de HETNA CNC. Recibimos el registro de ${nombre}. ¿Les ayudo a terminar de configurar su taller?`
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function correoFelicitacion(t: TallerAlta) {
  const perfil = `${STORE_URL}/mx/talleres/${encodeURIComponent(String(t.handle || t.id))}`
  const compartir = `https://wa.me/?text=${encodeURIComponent(`Ya pueden comprarnos y pedirnos cotización en HETNA CNC: ${perfil}`)}`
  const p = (x: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.55">${x}</p>`
  return marco(
    "¡Ya tienen su primer producto publicado!",
    p(`Felicidades, equipo de <strong>${esc(t.name || "su taller")}</strong>: su primer producto ya está en HETNA CNC y los clientes pueden comprarlo.`) +
      p("Tres cosas que ayudan a vender en las primeras semanas:") +
      `<ul style="margin:0 0 14px;padding-left:18px;color:#40403A;line-height:1.6">` +
      `<li><b>Compartan su perfil</b> en su WhatsApp, Facebook e Instagram: <a href="${esc(perfil)}" style="color:#C2560A">${esc(perfil)}</a></li>` +
      `<li><b>Suban 3 productos o más</b>: las tiendas con varios productos salen mejor posicionadas.</li>` +
      `<li><b>Verifiquen su WhatsApp</b> en su panel para enterarse al momento de las solicitudes de su zona.</li></ul>` +
      boton("Compartir mi perfil por WhatsApp", compartir) +
      `<p style="margin:16px 0 0;color:#40403A;line-height:1.5"><a href="${VENDOR_URL}/publicar" style="color:#C2560A;font-weight:700">Publicar otro producto →</a></p>`
  )
}

type Seller = TallerAlta

export async function correrAltaRecordatorios(container: MedusaContainer, o: { probar?: boolean; ahora?: Date } = {}) {
  const ahora = o.ahora || new Date()
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const sellers = container.resolve(MercurModules.SELLER) as any
  const tope = Math.max(1, Number(process.env.ALTA_RECORDATORIOS_TOPE) || 40)
  const r = { confirmar: 0, felicitados: 0, fallidos: 0, atorados: [] as string[] }

  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "handle", "email", "phone", "status", "created_at", "metadata"],
  })
  const casa = new Set(correosDeLaCasa().map((c) => c.toLowerCase()))
  const desde = ALTA_DESDE().getTime()
  const talleres = ((data || []) as unknown as Seller[]).filter(
    (t) => t.email && !casa.has(t.email.toLowerCase()) && (!t.created_at || new Date(t.created_at).getTime() >= desde)
  )
  if (!talleres.length) return r

  const { data: ofertas } = await query.graph({
    entity: "offer",
    fields: ["seller_id"],
    filters: { seller_id: talleres.map((t) => t.id) } as any,
  })
  const conProductos = new Set(((ofertas || []) as unknown as { seller_id?: string }[]).map((x) => x.seller_id))

  let enviados = 0
  const marcar = (t: Seller, extra: Record<string, unknown>) =>
    sellers.updateSellers({ id: t.id, metadata: { ...(t.metadata || {}), ...extra } })

  for (const t of talleres) {
    if (enviados >= tope) break
    // 1. Recordatorio de confirmar correo (transaccional: es la liga de su propio registro)
    const n = tocaConfirmar(t, ahora)
    if (n !== null) {
      if (o.probar) { r.confirmar++; continue }
      const envio: any = await mandarConfirmacion(t)
      if (envio?.sent === false && envio?.configuracion) break
      if (envio?.sent === false) { r.fallidos++; continue }
      await marcar(t, { aviso_confirmar: { n: n + 1, ultimo: ahora.toISOString() } })
      r.confirmar++
      enviados++
      continue
    }
    // 2. Felicitación por el primer producto (una sola vez)
    if (t.status === "open" && conProductos.has(t.id) && !t.metadata?.felicitado_primer_producto) {
      if (o.probar) { r.felicitados++; continue }
      if (await estaDeBaja(knex, String(t.email))) {
        await marcar(t, { felicitado_primer_producto: ahora.toISOString() })
        continue
      }
      const envio = await sendEmail({
        to: String(t.email),
        subject: `¡${t.name || "Su taller"} ya vende en HETNA CNC! Compartan su perfil`,
        html: correoFelicitacion(t),
        bajaUrl: ligaBaja(String(t.email)),
      })
      if (!envio.sent) {
        r.fallidos++
        if (envio.configuracion) break
        continue
      }
      await marcar(t, { felicitado_primer_producto: ahora.toISOString() })
      r.felicitados++
      enviados++
    }
  }

  // 3. Resumen de atorados (sólo los de los últimos 30 días, para no repetir eternamente)
  const lineas: string[] = []
  for (const t of talleres) {
    if (diasDesde(t.created_at, ahora) > 30) continue
    const paso = pasoAtorado(t, conProductos.has(t.id))
    if (!paso) continue
    const dias = Math.floor(diasDesde(t.created_at, ahora))
    const wa = ligaWhatsapp(t.phone, String(t.name || "su taller"), paso)
    const nombre = escHtml(String(t.name || t.email))
    lineas.push(`• <b>${nombre}</b> (${dias} d): ${paso}${wa ? ` — <a href="${escHtml(wa)}">WhatsApp</a>` : ` — ${escHtml(String(t.email))}`}`)
    r.atorados.push(`${t.name || t.email}: ${paso}`)
  }
  if (lineas.length && !o.probar) {
    const texto = `🧭 Talleres a medio registro (${lineas.length})\n\n${lineas.slice(0, 25).join("\n")}\n\nLos recordatorios por correo salen solos; el WhatsApp es para que tú les escribas si quieres.`
    await mandarPrivado(knex, { texto }).catch(() => undefined)
  }
  return r
}
