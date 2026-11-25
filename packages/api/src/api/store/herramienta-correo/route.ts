import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estaDeBaja, ligaBaja } from "../../../lib/baja"
import { T_ESTIMADO, asegurarTablaEstimado, guardarEstimado } from "../../../lib/estimados"
import { correoHerramientaHtml, validarHerramientaCorreo } from "../../../lib/herramienta-correo"
import { precioMaterialParaCotizar } from "../../../lib/materiales-precios"
import { precioDesglosado } from "../../../lib/precio-instantaneo"
import { leerConfigPrecios } from "../../../lib/precios-config"
import { sendEmail } from "../../../lib/resend"

// POST /store/herramienta-correo { email, acepta, herramienta, archivo, dxf?, precio?, servicio?, nombre? }
// "Mándamelo por correo" de las herramientas del Estudio (ver lib/herramienta-correo.ts).
// El precio lo calcula el servidor con el mismo motor de /store/precio-instantaneo.
// Topes: un correo por dirección y herramienta al día y tres por dirección al
// día, para que nadie use esto para llenar el buzón de otro.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  const b = (req.body || {}) as Record<string, unknown>
  if (b.sitio_web) return res.json({ ok: true }) // trampa para bots
  const v = validarHerramientaCorreo(b)
  if (!v.ok) return res.status(400).json({ message: v.mensaje })
  const d = v.datos
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaEstimado(knex)

  let precio: { minimo: number; maximo: number } | null = null
  if (d.precio) {
    try {
      const entrada: any = { ...d.precio }
      entrada.precio_material = await precioMaterialParaCotizar(req.scope, entrada.servicio, entrada.material, entrada.calibre)
      const { cfg } = await leerConfigPrecios(knex)
      const r = precioDesglosado(entrada, cfg)
      if (r.ok) precio = { minimo: r.precio.minimo, maximo: r.precio.maximo }
    } catch (e) {
      logger.warn(`[herramienta-correo] sin precio: ${(e as Error).message}`)
    }
  }

  const hoy = await knex(T_ESTIMADO)
    .where({ email: d.email })
    .where("created_at", ">", knex.raw("now() - interval '1 day'"))
    .select("herramienta")
    .catch(() => [] as any[])
  const yaEsta = hoy.some((f: any) => f.herramienta === d.herramienta)
  const guardar = () =>
    guardarEstimado(knex, {
      email: d.email,
      nombre: d.nombre,
      servicio: d.servicio,
      material: d.precio?.material || null,
      ancho: d.precio?.ancho,
      largo: d.precio?.largo,
      cantidad: d.precio?.cantidad,
      estimado_min: precio?.minimo,
      estimado_max: precio?.maximo,
      herramienta: d.herramienta,
    })
  // Sin avisar si ya se mandó o se dio de baja: el cliente ve "listo" igual
  if (yaEsta || hoy.length >= 3 || (await estaDeBaja(knex, d.email).catch(() => false))) {
    await guardar()
    return res.json({ ok: true })
  }
  const c = correoHerramientaHtml(d, precio)
  const r = await sendEmail({
    to: d.email,
    bajaUrl: ligaBaja(d.email),
    subject: c.asunto,
    html: c.html,
    ...(d.dxf ? { adjuntos: [{ nombre: `${d.archivo}.dxf`, contenido: new TextEncoder().encode(d.dxf) }] } : {}),
  })
  if (!r.sent) logger.info(`[herramienta-correo] no enviado: ${r.reason}`)
  await guardar()
  res.json({ ok: true, precio })
}
