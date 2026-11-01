// Aprovisiona la categoría "Cursos" y su regla de comisión (10% plataforma /
// 90% instructor) en el motor de comisiones de Mercur. Idempotente: se puede
// correr varias veces sin duplicar nada (reusa lo que ya exista).
//
// Uso: desde packages/api, con la base de datos accesible:
//   ./node_modules/.bin/medusa exec ./src/scripts/setup-course-commission.ts
//
// Cambia COMISION abajo si quieres otro %. Si la regla ya existe con otro
// valor, se actualiza.
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"

const COMISION = 10

export default async function setupCourseCommission({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(Modules.PRODUCT)
  const commissionService = container.resolve(MercurModules.COMMISSION) as any

  // 1) categoría "Cursos" (crea si no existe)
  let [categoria] = await productModuleService.listProductCategories({ name: "Cursos" })
  if (!categoria) {
    categoria = await productModuleService.createProductCategories({
      name: "Cursos",
      is_active: true,
      description: "Cursos en video de la Academia HETNA CNC",
    })
    logger.info(`Categoría "Cursos" creada: ${categoria.id}`)
  } else {
    logger.info(`Categoría "Cursos" ya existía: ${categoria.id}`)
  }

  // 2) regla de comisión: 10% para la plataforma, 90% queda para el instructor
  const existentes = await commissionService.listCommissionRates({ code: "cursos" })
  let rate = existentes[0]
  if (!rate) {
    rate = await commissionService.createCommissionRates({
      name: "Comisión de Cursos (Academia)",
      code: "cursos",
      type: "percentage",
      value: COMISION,
      is_enabled: true,
      include_tax: false,
      include_shipping: false,
      rules: [{ reference: "product_category", reference_id: categoria.id }],
    })
    logger.info(`Regla de comisión "cursos" creada: ${rate.id} (${COMISION}%)`)
  } else if (Number(rate.value) !== COMISION) {
    await commissionService.updateCommissionRates({ id: rate.id, value: COMISION })
    logger.info(`Regla de comisión "cursos" cambiada de ${rate.value}% a ${COMISION}%: ${rate.id}`)
  } else {
    logger.info(`Regla de comisión "cursos" ya existía: ${rate.id} (${COMISION}%)`)
  }

  // 3) verificación real: ¿la calculadora de comisiones de Mercur de verdad
  // encuentra esta regla para un producto de esa categoría, con el % correcto?
  const resultado = await commissionService.getCommissionLines({
    currency_code: "mxn",
    seller_id: "sel_test",
    items: [
      {
        id: "item_test_1",
        subtotal: 1000,
        product: { id: "prod_test_curso", categories: [{ id: categoria.id }] },
      },
    ],
  })
  logger.info(`Resultado del cálculo real de comisión: ${JSON.stringify(resultado, null, 2)}`)

  const linea = resultado[0]
  const esperado = (1000 * COMISION) / 100
  const ok = linea && Number(linea.rate) === COMISION && Number(linea.amount) === esperado
  logger.info(
    ok
      ? `✔ VERIFICADO: ${COMISION}% de 1000 MXN = ${esperado} MXN de comisión, calculado por el motor real.`
      : "✘ El cálculo no dio lo esperado, revisar."
  )
}
