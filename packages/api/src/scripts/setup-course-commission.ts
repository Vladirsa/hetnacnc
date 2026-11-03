// Aprovisiona las comisiones de HETNA en el motor de Mercur:
//   - general (sin reglas, se aplica a toda venta): COMISION_GENERAL
//   - máquinas CNC (sus categorías y subcategorías): COMISION_MAQUINAS
//   - Academia: categorías "Cursos" y "Libros y PDF": COMISION
// Mercur aplica la más específica: una categoría manda sobre la general. en el motor de comisiones de Mercur. Idempotente: se puede
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
const COMISION_GENERAL = 8
const COMISION_MAQUINAS = 5
// Categorías de máquinas (por handle); se incluyen sus subcategorías.
const MAQUINAS = ["maquinas-cnc", "routers-cnc", "laser-cnc", "plasma-cnc", "tornos-cnc", "impresoras-3d"]

const CATEGORIAS = [
  { nombre: "Cursos", handle: undefined as string | undefined, code: "cursos", descripcion: "Cursos en video de la Academia HETNA CNC" },
  { nombre: "Libros y PDF", handle: "libros-y-pdf", code: "libros", descripcion: "Libros, manuales y guías en PDF de la Academia HETNA CNC" },
]

export default async function setupCourseCommission({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(Modules.PRODUCT)
  const commissionService = container.resolve(MercurModules.COMMISSION) as any

  // --- Comisión general y de máquinas ---
  const asegurar = async (code: string, name: string, value: number, rules: { reference: string; reference_id: string }[], extra = {}) => {
    const [rate] = await commissionService.listCommissionRates({ code })
    if (!rate) {
      const nuevo = await commissionService.createCommissionRates({
        name,
        code,
        type: "percentage",
        value,
        is_enabled: true,
        include_tax: false,
        include_shipping: false,
        rules,
        ...extra,
      })
      logger.info(`Regla de comisión "${code}" creada: ${nuevo.id} (${value}%)`)
      return nuevo
    }
    if (Number(rate.value) !== value) {
      await commissionService.updateCommissionRates({ id: rate.id, value })
      logger.info(`Regla de comisión "${code}" cambiada de ${rate.value}% a ${value}%`)
    } else {
      logger.info(`Regla de comisión "${code}" ya existía: ${rate.id} (${value}%)`)
    }
    return rate
  }

  // Sólo puede haber una comisión global (is_default): si ya hay una, se usa esa.
  const [global] = await commissionService.listCommissionRates({ is_default: true })
  if (global && global.code !== "general") {
    if (Number(global.value) !== COMISION_GENERAL) {
      await commissionService.updateCommissionRates({ id: global.id, value: COMISION_GENERAL, is_enabled: true })
      logger.info(`Comisión global "${global.code}" cambiada de ${global.value}% a ${COMISION_GENERAL}%`)
    } else {
      logger.info(`Comisión global "${global.code}" ya existía (${COMISION_GENERAL}%)`)
    }
  } else {
    await asegurar("general", "Comisión general de ventas", COMISION_GENERAL, [], { is_default: true })
  }

  const todas = await productModuleService.listProductCategories({}, { take: 1000, select: ["id", "handle", "parent_category_id"] })
  const ids = new Set(todas.filter((c: any) => MAQUINAS.includes(c.handle)).map((c: any) => c.id))
  for (let cambio = true; cambio; ) {
    cambio = false
    for (const c of todas as any[]) if (c.parent_category_id && ids.has(c.parent_category_id) && !ids.has(c.id)) { ids.add(c.id); cambio = true }
  }
  if (ids.size) {
    const maq = await asegurar(
      "maquinas",
      "Comisión de máquinas CNC",
      COMISION_MAQUINAS,
      [...ids].map((id) => ({ reference: "product_category", reference_id: id }))
    )
    // Si se agregaron categorías nuevas, se suman a la regla
    const actuales = new Set(((await commissionService.listCommissionRules({ commission_rate_id: maq.id })) || []).map((r: any) => r.reference_id))
    const faltan = [...ids].filter((id) => !actuales.has(id))
    if (faltan.length && commissionService.createCommissionRules) {
      await commissionService.createCommissionRules(faltan.map((id) => ({ commission_rate_id: maq.id, reference: "product_category", reference_id: id })))
      logger.info(`Se agregaron ${faltan.length} categorías a "maquinas"`)
    }
    logger.info(`Máquinas: ${ids.size} categorías al ${COMISION_MAQUINAS}%`)
  } else {
    logger.warn(`✘ No se encontró ninguna categoría de máquinas (${MAQUINAS.join(", ")})`)
  }

  const prueba = await commissionService.getCommissionLines({
    currency_code: "mxn",
    seller_id: "sel_test",
    items: [{ id: "item_gen", subtotal: 1000, product: { id: "prod_gen", categories: [] } }],
  })
  logger.info(
    Number(prueba[0]?.rate) === COMISION_GENERAL
      ? `✔ General: ${COMISION_GENERAL}% de 1000 MXN = ${(1000 * COMISION_GENERAL) / 100} MXN`
      : `✘ General: el cálculo no dio lo esperado (${JSON.stringify(prueba)})`
  )
  const unaMaquina = [...ids][0]
  if (unaMaquina) {
    const pm = await commissionService.getCommissionLines({
      currency_code: "mxn",
      seller_id: "sel_test",
      items: [{ id: "item_maq", subtotal: 1000, product: { id: "prod_maq", categories: [{ id: unaMaquina }] } }],
    })
    logger.info(
      Number(pm[0]?.rate) === COMISION_MAQUINAS
        ? `✔ Máquinas: ${COMISION_MAQUINAS}% de 1000 MXN = ${(1000 * COMISION_MAQUINAS) / 100} MXN`
        : `✘ Máquinas: el cálculo no dio lo esperado (${JSON.stringify(pm)})`
    )
  }

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
