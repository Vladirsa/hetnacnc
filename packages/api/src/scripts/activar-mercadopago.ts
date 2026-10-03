// Activa Mercado Pago en las regiones en pesos (MXN) sin entrar al admin.
// Uso (en packages/api):
//   NODE_ENV=production ../../node_modules/.bin/medusa exec ./src/scripts/activar-mercadopago.ts
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

const ID_MP = "pp_mercadopago_mercadopago"

export default async function activarMercadoPago({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: proveedores } = await query.graph({
    entity: "payment_provider",
    fields: ["id", "is_enabled"],
  })
  logger.info(`Proveedores de pago registrados: ${proveedores.map((p: any) => p.id).join(", ") || "(ninguno)"}`)

  if (!proveedores.some((p: any) => p.id === ID_MP)) {
    logger.error(
      "Mercado Pago NO está registrado. Revisa que MERCADOPAGO_ACCESS_TOKEN esté en .env.production y reinicia la API."
    )
    return
  }

  const { data: regiones } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "payment_providers.id"],
  })

  const enPesos = regiones.filter((r: any) => (r.currency_code || "").toLowerCase() === "mxn")
  if (!enPesos.length) {
    logger.error(
      `No hay regiones en MXN. Regiones encontradas: ${regiones.map((r: any) => `${r.name} (${r.currency_code})`).join(", ")}`
    )
    return
  }

  for (const r of enPesos as any[]) {
    const actuales: string[] = (r.payment_providers || []).map((p: any) => p.id)
    if (actuales.includes(ID_MP)) {
      logger.info(`${r.name}: ya tenía Mercado Pago activo`)
      continue
    }
    const nuevos = [...actuales, ID_MP]
    await updateRegionsWorkflow(container).run({
      input: { selector: { id: r.id }, update: { payment_providers: nuevos } },
    })
    logger.info(`${r.name}: Mercado Pago activado -> ${nuevos.join(", ")}`)
  }
}
