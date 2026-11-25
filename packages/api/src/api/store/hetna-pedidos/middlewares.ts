import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

import { leerMultipart } from "../../cam-multipart"
import { MAX_MB_EVIDENCIA } from "../../../lib/reclamos-pedido"

const cliente = authenticate("customer", ["session", "bearer"])

export const storeHetnaPedidosMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/hetna-pedidos/:id/recibido",
    middlewares: [cliente],
  },
  // "Liberar pago" y reclamos (lib/reclamos-pedido.ts)
  { method: ["POST"], matcher: "/store/hetna-pedidos/:id/liberar", middlewares: [cliente] },
  { method: ["GET", "POST"], matcher: "/store/hetna-pedidos/:id/reclamo", middlewares: [cliente] },
  {
    method: ["POST"],
    matcher: "/store/hetna-pedidos/:id/evidencia",
    middlewares: [cliente, leerMultipart({ campos: { archivo: 1 }, maxMb: MAX_MB_EVIDENCIA, forma: "lista" })],
  },
  { method: ["GET"], matcher: "/store/hetna-pedidos/:id/evidencia/:archivo", middlewares: [cliente] },
]
