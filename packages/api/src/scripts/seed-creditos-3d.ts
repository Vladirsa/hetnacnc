// Crea los paquetes de créditos para los servicios 3D (escaneo profesional
// vía Meshroom en RunPod) como productos normales del catálogo. No hay
// módulo de "producto" nuevo para esto: credit-delivery.ts (subscribers
// order-placed-credit-delivery / payment-captured-credit-delivery) detecta
// cualquier producto con metadata.producto_creditos_3d === true y acredita
// metadata.creditos_otorgados × cantidad comprada al wallet del cliente.
//
// Regla de negocio confirmada: 10 créditos = 1 escaneo profesional. Los
// paquetes más grandes dan créditos de regalo (ej. "compra 20, te doy 25")
// para incentivar la compra en volumen.
//
// IMPORTANT: los precios de abajo son una PROPUESTA inicial, no están
// validados contra el costo real de GPU por escaneo en RunPod. Ajusta
// PAQUETES antes de correr esto en producción, o edita los precios después
// desde el panel admin — este script no vuelve a tocar un producto que ya
// exista (detecta por handle).
//
// Uso: desde packages/api, con la base de datos accesible:
//   ./node_modules/.bin/medusa exec ./src/scripts/seed-creditos-3d.ts
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"
import { createProductsWorkflow } from "@mercurjs/core/workflows"

const PAQUETES = [
  {
    handle: "creditos-3d-basico",
    title: "Paquete Básico — 10 créditos 3D",
    descripcion: "10 créditos = 1 escaneo 3D profesional (fotos → STL/OBJ).",
    creditos_pagados: 10,
    creditos_otorgados: 10,
    precio_mxn: 249,
  },
  {
    handle: "creditos-3d-estandar",
    title: "Paquete Estándar — 20 créditos 3D + 5 de regalo",
    descripcion: "Compra 20 créditos y te damos 25: 2 escaneos y medio al precio de 2.",
    creditos_pagados: 20,
    creditos_otorgados: 25,
    precio_mxn: 449,
  },
  {
    handle: "creditos-3d-pro",
    title: "Paquete Pro — 50 créditos 3D + 15 de regalo",
    descripcion: "Compra 50 créditos y te damos 65: el mejor precio por escaneo para talleres frecuentes.",
    creditos_pagados: 50,
    creditos_otorgados: 65,
    precio_mxn: 999,
  },
] as const

export default async function seedCreditos3d({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(Modules.PRODUCT)
  const sellerService = container.resolve(MercurModules.SELLER) as any

  const [seller] = await sellerService.listSellers({}, { take: 1 })
  if (!seller) {
    logger.error("No hay ningún seller en la plataforma. Crea uno primero (puede ser tu propia cuenta de HETNA CNC).")
    return
  }

  const existentes = await productModuleService.listProducts({
    handle: PAQUETES.map((p) => p.handle),
  })
  const handlesExistentes = new Set(existentes.map((p: any) => p.handle))

  const nuevos = PAQUETES.filter((p) => !handlesExistentes.has(p.handle))
  if (nuevos.length === 0) {
    logger.info("Los 3 paquetes de créditos 3D ya existen, no se crea nada.")
    return
  }

  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      created_by: "seed-script",
      products: nuevos.map((paquete) => ({
        title: paquete.title,
        handle: paquete.handle,
        description: paquete.descripcion,
        status: "published" as any,
        seller_ids: [seller.id],
        metadata: {
          producto_creditos_3d: true,
          creditos_otorgados: paquete.creditos_otorgados,
        },
        variants: [
          {
            title: `${paquete.creditos_pagados} créditos`,
            prices: [{ currency_code: "mxn", amount: paquete.precio_mxn }],
          } as any,
        ],
      })) as any,
    },
  })

  for (const product of products) {
    logger.info(`✔ Paquete de créditos creado: ${product.title} (${product.id}, ${product.handle})`)
  }

  if (handlesExistentes.size > 0) {
    logger.info(`(${handlesExistentes.size} paquete(s) ya existían y no se tocaron.)`)
  }
}
