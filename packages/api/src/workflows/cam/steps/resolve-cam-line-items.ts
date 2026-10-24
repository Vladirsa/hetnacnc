import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  CAM_PRODUCT_HANDLES,
  camSellerHandle,
  CAM_TIER_OPTION,
  TIERED_SERVICES,
  type CamService,
} from "../../../modules/cam/catalog"

export type ResolveCamLineItemsInput = {
  job: {
    id: string
    service: string
    tier: string | null
    model_name: string
    controller: string | null
    kinematics: string | null
  }
  review: boolean
}

type VariantRow = {
  id: string
  options?: { value?: string | null; option?: { title?: string | null } | null }[] | null
}

type OfferRow = { id: string; variant_id: string; seller?: { handle?: string | null } | null }

/**
 * Elige la variante (nivel de complejidad) del producto de servicio y arma las
 * líneas del carrito con el id del trabajo en los metadatos.
 *
 * En Mercur cada línea del carrito va ligada a la OFERTA de una tienda (así se
 * parte el pedido por vendedor). Los servicios CAM los vende la tienda de
 * HETNA (handle `hetna-cnc`, o CAM_SELLER_HANDLE): se usa su oferta de la
 * variante elegida.
 */
export const resolveCamLineItemsStep = createStep(
  "resolve-cam-line-items",
  async (input: ResolveCamLineItemsInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const service = input.job.service as CamService
    const handles = [CAM_PRODUCT_HANDLES[service]]
    if (input.review) {
      handles.push(CAM_PRODUCT_HANDLES.review)
    }

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "handle", "status", "variants.id", "variants.options.value", "variants.options.option.title"],
      filters: { handle: handles },
    })

    const variantIds = products.flatMap((p) => ((p.variants ?? []) as VariantRow[]).map((v) => v.id))
    const { data: offers } = variantIds.length
      ? await query.graph({
          entity: "offer",
          fields: ["id", "variant_id", "seller.handle"],
          filters: { variant_id: variantIds },
        })
      : { data: [] as OfferRow[] }
    const sellerHandle = camSellerHandle()
    const offerFor = (variantId: string): string => {
      const rows = (offers as OfferRow[]).filter((o) => o.variant_id === variantId)
      const offer = rows.find((o) => o.seller?.handle === sellerHandle) ?? rows[0]
      if (!offer) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "El servicio CAM no tiene oferta de la tienda HETNA. Ejecuta el script seed-cam-services."
        )
      }
      return offer.id
    }

    const pick = (handle: string, tier: string | null): string => {
      const product = products.find((p) => p.handle === handle)
      if (!product || product.status !== "published") {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `El producto de servicio "${handle}" no existe o no está publicado. Ejecuta el script seed-cam-services.`
        )
      }
      const variants = (product.variants ?? []) as VariantRow[]
      if (tier) {
        const match = variants.find((v) =>
          (v.options ?? []).some(
            (o) => o?.option?.title === CAM_TIER_OPTION && o?.value === tier
          )
        )
        if (match) {
          return match.id
        }
      }
      if (!variants[0]) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, `"${handle}" no tiene variantes`)
      }
      return variants[0].id
    }

    const metadata = {
      cam_job_id: input.job.id,
      cam_model: input.job.model_name,
      cam_service: input.job.service,
      cam_tier: input.job.tier,
      cam_controller: input.job.controller,
      cam_kinematics: input.job.kinematics,
    }

    const line = (variantId: string, meta: Record<string, unknown>) => {
      const offerId = offerFor(variantId)
      return {
        variant_id: variantId,
        offer_id: offerId,
        quantity: 1,
        // Va con "Entrega digital" ($0): la oferta usa el perfil "Producto digital".
        requires_shipping: true,
        metadata: { ...meta, offer_id: offerId },
      }
    }

    const items = [
      line(
        pick(CAM_PRODUCT_HANDLES[service], TIERED_SERVICES.includes(service) ? input.job.tier : null),
        metadata
      ),
    ]
    if (input.review) {
      items.push(line(pick(CAM_PRODUCT_HANDLES.review, null), { ...metadata, cam_addon: "review" }))
    }

    return new StepResponse(items)
  }
)
