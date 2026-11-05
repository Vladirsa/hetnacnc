// Campaña "publica tu primer producto": a los talleres aprobados que todavía
// no tienen ni un producto les manda hasta 3 correos (al día 1, 4 y 10 de su
// alta), con la liga directa a /seller/publicar. En cuanto publican algo, deja
// de mandarles.
//
// El avance se guarda en el metadata del taller (aviso_primer_producto) para
// no repetir un correo. Es promocional: respeta la baja (lib/baja.ts) y lleva
// su liga para darse de baja.
//
// Variables:
//   PRIMER_PRODUCTO_APAGADO=1   apaga la campaña
//   PRIMER_PRODUCTO_TOPE=40     correos por corrida (por defecto 40)
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"

import { estaDeBaja, ligaBaja } from "./baja"
import { correosDeLaCasa } from "./cuentas-casa"
import { VENDOR_URL, boton, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"

const DIA = 86_400_000
// Días desde el alta en que toca cada correo
export const DIAS_CORREO = [1, 4, 10]

type Taller = {
  id: string
  name?: string | null
  email?: string | null
  status?: string | null
  created_at?: string | Date | null
  metadata?: Record<string, unknown> | null
}

type Avance = { n: number; ultimo?: string }

export const primerProductoApagado = () => ["1", "true", "si"].includes(String(process.env.PRIMER_PRODUCTO_APAGADO || "").toLowerCase())

const ASUNTOS = [
  "Tu tienda en HETNA ya está lista: publica tu primer producto en 2 minutos",
  "Los clientes ya buscan en HETNA. ¿Qué fabricas tú?",
  "Último recordatorio: tu tienda en HETNA sigue vacía",
]

function cuerpo(n: number, t: Taller): string {
  const nombre = esc(t.name || "tu taller")
  const p = (x: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.55">${x}</p>`
  const lista = (xs: string[]) =>
    `<ul style="margin:0 0 14px;padding-left:18px;color:#40403A;line-height:1.6">${xs.map((x) => `<li>${x}</li>`).join("")}</ul>`
  const liga = `${VENDOR_URL}/publicar`

  if (n === 0)
    return marco(
      "Publica tu primer producto en 2 minutos",
      p(`Hola: <strong>${nombre}</strong> ya tiene su tienda en HETNA CNC, pero todavía no tiene productos y los clientes no pueden comprarte.`) +
        p("Publicar es gratis y toma 2 minutos: una foto, el precio y listo.") +
        lista([
          "HETNA anuncia tus productos en Google, en el catálogo y en los correos de novedades.",
          "Sólo pagas comisión cuando vendes.",
          "Puedes vender piezas, refacciones, fresas, materiales, archivos DXF o STL, cursos y libros en PDF.",
        ]) +
        boton("Publicar mi primer producto", liga)
    )
  if (n === 1)
    return marco(
      "¿Qué fabricas tú?",
      p(`Hola de nuevo. La tienda de <strong>${nombre}</strong> sigue sin productos.`) +
        p("Ideas de lo que más se busca en HETNA para empezar:") +
        lista([
          "Letreros y letras en MDF o acrílico.",
          "Cajas, organizadores y llaveros cortados en láser.",
          "Piezas impresas en 3D y refacciones a la medida.",
          "Fresas, consumibles y material para otros talleres.",
        ]) +
        p("Con 3 productos o más tu tienda sale mejor posicionada.") +
        boton("Publicar ahora", liga)
    )
  return marco(
    "Tu tienda sigue vacía",
    p(`Éste es el último recordatorio: la tienda de <strong>${nombre}</strong> en HETNA todavía no tiene productos.`) +
      p("Publica uno hoy; es gratis y no cobramos nada hasta que vendas. Si necesitas ayuda, responde este correo o escríbenos por WhatsApp y te lo subimos juntos.") +
      boton("Publicar mi primer producto", liga)
  )
}

/** Los talleres abiertos sin ningún producto, con el correo que les toca hoy. */
export async function talleresSinProductos(container: MedusaContainer, ahora = new Date()) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "email", "status", "created_at", "metadata"],
    filters: { status: "open" } as any,
  })
  const casa = new Set(correosDeLaCasa().map((c) => c.toLowerCase()))
  const talleres = ((data || []) as unknown as Taller[]).filter((t) => t.email && !casa.has(t.email.toLowerCase()))
  if (!talleres.length) return []

  const { data: ofertas } = await query.graph({
    entity: "offer",
    fields: ["seller_id"],
    filters: { seller_id: talleres.map((t) => t.id) } as any,
  })
  const conProductos = new Set(((ofertas || []) as unknown as { seller_id?: string }[]).map((o) => o.seller_id))

  const pendientes: { taller: Taller; n: number }[] = []
  for (const t of talleres) {
    if (conProductos.has(t.id)) continue
    const avance = (t.metadata?.aviso_primer_producto as Avance | undefined) || { n: 0 }
    if (avance.n >= DIAS_CORREO.length) continue
    const alta = t.created_at ? new Date(t.created_at).getTime() : ahora.getTime()
    const dias = (ahora.getTime() - alta) / DIA
    if (dias < DIAS_CORREO[avance.n]) continue
    // Nunca dos correos con menos de 2 días de diferencia (talleres viejos que
    // entran a la campaña con varios correos "vencidos" a la vez)
    if (avance.ultimo && ahora.getTime() - new Date(avance.ultimo).getTime() < 2 * DIA) continue
    pendientes.push({ taller: t, n: avance.n })
  }
  return pendientes
}

export async function correrPrimerProducto(container: MedusaContainer, o: { probar?: boolean } = {}) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const sellers = container.resolve(MercurModules.SELLER) as any
  const tope = Math.max(1, Number(process.env.PRIMER_PRODUCTO_TOPE) || 40)
  const r = { enviados: 0, baja: 0, fallidos: 0, pendientes: 0 }

  const lista = await talleresSinProductos(container)
  r.pendientes = lista.length
  for (const { taller, n } of lista.slice(0, tope)) {
    if (o.probar) continue
    const correo = String(taller.email)
    const marcar = (avance: Avance) =>
      sellers.updateSellers({ id: taller.id, metadata: { ...(taller.metadata || {}), aviso_primer_producto: avance } })

    if (await estaDeBaja(knex, correo)) {
      // Se marca como terminado para no revisarlo cada día
      await marcar({ n: DIAS_CORREO.length, ultimo: new Date().toISOString() })
      r.baja++
      continue
    }
    const envio = await sendEmail({ to: correo, subject: ASUNTOS[n], html: cuerpo(n, taller), bajaUrl: ligaBaja(correo) })
    if (!envio.sent) {
      r.fallidos++
      if (envio.configuracion) break
      continue
    }
    await marcar({ n: n + 1, ultimo: new Date().toISOString() })
    r.enviados++
  }
  return r
}
