import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estaDeBaja, ligaBaja } from "../../../lib/baja"
import { asegurarTablaEstimado, guardarEstimado } from "../../../lib/estimados"
import { TOPES, T_ENVIOS, asegurarTablaEnvios, correoHerramientaHtml, validarHerramientaCorreo } from "../../../lib/herramienta-correo"
import { ipCliente } from "../../../lib/ip-cliente"
import { precioMaterialParaCotizar } from "../../../lib/materiales-precios"
import { precioDesglosado } from "../../../lib/precio-instantaneo"
import { leerConfigPrecios } from "../../../lib/precios-config"
import { sendEmail } from "../../../lib/resend"

// POST /store/herramienta-correo { email, acepta, herramienta, archivo, dxf?, precio?, servicio?, nombre? }
// "Mándamelo por correo" de las herramientas del Estudio (ver lib/herramienta-correo.ts).
// El precio lo calcula el servidor con el mismo motor de /store/precio-instantaneo.
// Topes al día (lib/herramienta-correo.ts TOPES): por dirección y herramienta,
// por dirección y por IP, para que nadie use esto para llenar el buzón de otro.
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

  // Topes del día, contados en su propia tabla. La fila se apunta antes de
  // mandar, así que dos peticiones al mismo tiempo no se brincan el tope.
  await asegurarTablaEnvios(knex)
  const ip = ipCliente(req as any)
  const [{ id: miEnvio }] = await knex(T_ENVIOS).insert({ email: d.email, herramienta: d.herramienta, ip }).returning("id")
  const desde = knex.raw("now() - interval '1 day'")
  const contar = async (q: any) => Number((await q.where("created_at", ">", desde).where("id", "<", miEnvio).count({ n: "*" }).first())?.n || 0)
  const [porCorreo, porHerramienta, porIp] = await Promise.all([
    contar(knex(T_ENVIOS).where({ email: d.email, enviado: true })),
    contar(knex(T_ENVIOS).where({ email: d.email, herramienta: d.herramienta, enviado: true })),
    contar(knex(T_ENVIOS).where({ ip })),
  ])
  const pasado = porCorreo >= TOPES.porCorreo || porHerramienta >= TOPES.porHerramienta || porIp >= TOPES.porIp
  // Sin avisar si ya se mandó, pasó el tope o se dio de baja: el cliente ve "listo" igual
  if (pasado || (await estaDeBaja(knex, d.email).catch(() => false))) {
    await knex(T_ENVIOS).where({ id: miEnvio }).update({ enviado: false })
    if (porIp < TOPES.porIp) await guardar()
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
  if (!r.sent) {
    logger.info(`[herramienta-correo] no enviado: ${r.reason}`)
    await knex(T_ENVIOS).where({ id: miEnvio }).update({ enviado: false })
  }
  await guardar()
  res.json({ ok: true })
}
