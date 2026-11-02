import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { COTIZADOR_MODULE } from "../../../../modules/cotizador"
import CotizadorModuleService from "../../../../modules/cotizador/service"
import { resumenPlanUnificado } from "../../../../lib/plan-unificado"
import { esCuentaDeLaCasa, PLAN_DE_LA_CASA } from "../../../../lib/cuentas-casa"
import { costosDeTaller } from "../../../../lib/cotizador-config"

// Campos que el taller puede escribir. Quedan fuera a propósito:
// - folio_consecutivo: lo mueve sólo el workflow al emitir, si no se podría
//   reusar un folio ya enviado.
// - plan, plan_hasta, prueba_hasta, uso_mes, uso_n: son el cobro. Si el taller
//   pudiera escribirlos se regalaría un plan industrial y cupo infinito.
const DIAS_DE_PRUEBA = 14

const CAMPOS_EDITABLES = [
  "nombre_comercial",
  "nombre_contacto",
  "razon_social",
  "rfc",
  "direccion",
  "ciudad",
  "estado",
  "cp",
  "pais",
  "telefono",
  "whatsapp",
  "correo",
  "sitio_web",
  "logo_url",
  "moneda",
  "iva_pct",
  "vigencia_dias",
  "costo_hora_taller",
  "costo_hora_maquina",
  "costo_hora_operador",
  "margen_minimo",
  "margen_recomendado",
  "tarifas",
  "folio_prefijo",
  "terminos_estandar",
  "condiciones_pago_default",
  "dias_entrega_default",
  "firma_nombre",
  "firma_puesto",
] as const

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const cotizadorModuleService = req.scope.resolve<CotizadorModuleService>(COTIZADOR_MODULE)

  const [perfil] = await cotizadorModuleService.listTallerPerfils({ customer_id: customerId })
  // El plan de la app (si la cuenta está vinculada) manda: lib/plan-unificado.ts
  let plan = perfil ? await resumenPlanUnificado(req.scope, customerId, perfil) : null
  if (plan && (await esCuentaDeLaCasa(req.scope, customerId))) {
    plan = { ...plan, plan: PLAN_DE_LA_CASA, limite: null, prueba_dias: 0 }
  }

  res.json({
    perfil: perfil ?? null,
    // Lo que la pantalla necesita para decir "prueba, 8 días" o "3 de 10
    // cotizaciones del mes" sin tener que reimplementar la regla del plan.
    plan,
    // Los costos de referencia con los que cotiza quien no capturó los suyos.
    // Van aquí para que la pantalla de captura pueda mostrarlos como
    // sugerencia sin tener una copia propia que se desincronice: la verdad
    // sigue siendo cotizador-datos.json. Pasar {} devuelve justo la base,
    // porque costosDeTaller sólo pisa lo que el perfil trae capturado.
    costos_referencia: costosDeTaller({}),
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const cotizadorModuleService = req.scope.resolve<CotizadorModuleService>(COTIZADOR_MODULE)
  const body = (req.validatedBody || req.body || {}) as Record<string, unknown>

  const cambios: Record<string, unknown> = {}
  for (const campo of CAMPOS_EDITABLES) {
    if (body[campo] !== undefined) {
      cambios[campo] = body[campo]
    }
  }

  const [existente] = await cotizadorModuleService.listTallerPerfils({ customer_id: customerId })

  if (existente) {
    await cotizadorModuleService.updateTallerPerfils({ id: existente.id, ...cambios } as any)
    const perfil = await cotizadorModuleService.retrieveTallerPerfil(existente.id)
    return res.json({ perfil })
  }

  if (!cambios.nombre_comercial) {
    return res.status(400).json({ message: "nombre_comercial es requerido para crear el perfil del taller" })
  }

  // La prueba se otorga aquí, al abrir el perfil: es el mismo trato que da hoy
  // el esquema taller (14 días sin límite de cotizaciones). Va fuera de
  // CAMPOS_EDITABLES para que el taller no se la pueda extender solo.
  const pruebaHasta = new Date()
  pruebaHasta.setDate(pruebaHasta.getDate() + DIAS_DE_PRUEBA)

  const [perfil] = await cotizadorModuleService.createTallerPerfils([
    { customer_id: customerId, ...cambios, prueba_hasta: pruebaHasta } as any,
  ])
  res.status(201).json({ perfil })
}
