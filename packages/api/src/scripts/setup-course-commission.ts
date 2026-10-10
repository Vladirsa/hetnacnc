// Aprovisiona la categoría "Cursos" y su regla de comisión (30% plataforma /
// 70% instructor) en el motor de comisiones de Mercur. Idempotente: se puede
// correr varias veces sin duplicar nada (reusa lo que ya exista).
//
// Uso: desde packages/api, con la base de datos accesible:
//   npx medusa exec ./src/scripts/setup-course-commission.ts
//
// Ajusta el valor `value: 30` abajo si quieres otro % de comisión.
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"

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

  // 2) regla de comisión: 30% para la plataforma, 70% queda para el instructor
  const existentes = await commissionService.listCommissionRates({ code: "cursos" })
  let rate = existentes[0]
  if (!rate) {
    rate = await commissionService.createCommissionRates({
      name: "Comisión de Cursos (Academia)",
      code: "cursos",
      type: "percentage",
      value: 30,
      is_enabled: true,
      include_tax: false,
      include_shipping: false,
      rules: [{ reference: "product_category", reference_id: categoria.id }],
    })
    logger.info(`Regla de comisión "cursos" creada: ${rate.id} (30%)`)
  } else {
    logger.info(`Regla de comisión "cursos" ya existía: ${rate.id}`)
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
  const ok = linea && linea.rate === 30 && Number(linea.amount) === 300
  logger.info(ok ? "✔ VERIFICADO: 30% de 1000 MXN = 300 MXN de comisión, calculado por el motor real." : "✘ El cálculo no dio lo esperado, revisar.")
}
