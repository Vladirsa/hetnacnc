// Panel de HETNA > Precios de la calculadora (lib/precios-config.ts).
//   GET   los ajustes guardados y los valores de fábrica, con ejemplos de precio
//   POST  guarda los ajustes (sólo números en rango; vacío = valor de fábrica)
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { configDeFabrica, MATERIALES, SERVICIOS } from "../../../lib/estimador-referencia"
import { precioInstantaneo } from "../../../lib/precio-instantaneo"
import { guardarConfigPrecios, leerConfigPrecios } from "../../../lib/precios-config"

const EJEMPLOS = [
  { nombre: "50 llaveros 5 × 3 cm, láser, MDF 3 mm", e: { servicio: "laser_co2", material: "MDF delgado (hasta 2.5mm)", ancho: 5, largo: 3, cantidad: 50 } },
  { nombre: "Pieza 60 × 40 cm, router, MDF 18 mm", e: { servicio: "router", material: "MDF 18mm", ancho: 60, largo: 40, cantidad: 1 } },
  { nombre: "Placa 30 × 30 cm, plasma, acero cal. 14", e: { servicio: "plasma", material: "Acero al carbón", calibre: "Lámina delgada (cal. 20 a 12)", ancho: 30, largo: 30, cantidad: 1 } },
  { nombre: "Cubo 5 cm, impresión 3D, PLA", e: { servicio: "impresion_3d", material: "PLA", calidad: "Pieza funcional", ancho: 5, largo: 5, alto: 5, cantidad: 1 } },
]

function ejemplos(cfg: any) {
  return EJEMPLOS.map((x) => {
    const r = precioInstantaneo(x.e as any, cfg)
    return { nombre: x.nombre, precio: r.ok ? r.resultado.pvRecomendado : null }
  })
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { cfg, actualizado } = await leerConfigPrecios(knex)
  res.json({
    guardado: cfg,
    fabrica: configDeFabrica(),
    actualizado,
    maquinas: SERVICIOS.map((s) => ({ clave: s.clave, nombre: s.nombre })),
    materiales: MATERIALES.map((m) => ({ nombre: m.nombre, unidad: m.unidad })),
    ejemplos: ejemplos(cfg),
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const cfg = await guardarConfigPrecios(knex, req.body, req.auth_context?.actor_id || null)
  res.json({ ok: true, guardado: cfg, ejemplos: ejemplos(cfg) })
}
