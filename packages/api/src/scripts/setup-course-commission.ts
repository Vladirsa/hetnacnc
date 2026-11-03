// Aprovisiona las categorías de la Academia ("Cursos" y "Libros y PDF") y su
// regla de comisión (10% plataforma / 90% instructor) en el motor de comisiones de Mercur. Idempotente: se puede
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

const CATEGORIAS = [
  { nombre: "Cursos", handle: undefined as string | undefined, code: "cursos", descripcion: "Cursos en video de la Academia HETNA CNC" },
  { nombre: "Libros y PDF", handle: "libros-y-pdf", code: "libros", descripcion: "Libros, manuales y guías en PDF de la Academia HETNA CNC" },
]

export default async function setupCourseCommission({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(Modules.PRODUCT)
  const commissionService = container.resolve(MercurModules.COMMISSION) as any

  for (const c of CATEGORIAS) {
    // 1) la categoría (se crea si no existe)
    let [categoria] = await productModuleService.listProductCategories({ name: c.nombre })
    if (!categoria) {
      categoria = await productModuleService.createProductCategories({
        name: c.nombre,
        ...(c.handle ? { handle: c.handle } : {}),
        is_active: true,
        description: c.descripcion,
      })
      logger.info(`Categoría "${c.nombre}" creada: ${categoria.id}`)
    } else {
      logger.info(`Categoría "${c.nombre}" ya existía: ${categoria.id}`)
    }

    // 2) regla de comisión: 10% para la plataforma, 90% para el taller
    const existentes = await commissionService.listCommissionRates({ code: c.code })
    let rate = existentes[0]
    if (!rate) {
      rate = await commissionService.createCommissionRates({
        name: `Comisión de ${c.nombre} (Academia)`,
        code: c.code,
        type: "percentage",
        value: COMISION,
        is_enabled: true,
        include_tax: false,
        include_shipping: false,
        rules: [{ reference: "product_category", reference_id: categoria.id }],
      })
      logger.info(`Regla de comisión "${c.code}" creada: ${rate.id} (${COMISION}%)`)
    } else if (Number(rate.value) !== COMISION) {
      await commissionService.updateCommissionRates({ id: rate.id, value: COMISION })
      logger.info(`Regla de comisión "${c.code}" cambiada de ${rate.value}% a ${COMISION}%: ${rate.id}`)
    } else {
      logger.info(`Regla de comisión "${c.code}" ya existía: ${rate.id} (${COMISION}%)`)
    }

    // 3) verificación real con el motor de comisiones de Mercur
    const resultado = await commissionService.getCommissionLines({
      currency_code: "mxn",
      seller_id: "sel_test",
      items: [{ id: "item_test_1", subtotal: 1000, product: { id: "prod_test", categories: [{ id: categoria.id }] } }],
    })
    const linea = resultado[0]
    const esperado = (1000 * COMISION) / 100
    const ok = linea && Number(linea.rate) === COMISION && Number(linea.amount) === esperado
    logger.info(
      ok
        ? `✔ ${c.nombre}: ${COMISION}% de 1000 MXN = ${esperado} MXN de comisión, calculado por el motor real.`
        : `✘ ${c.nombre}: el cálculo no dio lo esperado (${JSON.stringify(resultado)}).`
    )
  }
}
