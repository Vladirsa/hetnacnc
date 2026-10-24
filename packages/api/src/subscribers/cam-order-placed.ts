import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { markCamJobsPaidWorkflow } from "../workflows/cam/mark-cam-jobs-paid"

/** Cuando se coloca un pedido, sus trabajos CAM pasan a "pagado". */
export default async function camOrderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await markCamJobsPaidWorkflow(container).run({
    input: { order_id: data.id },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
