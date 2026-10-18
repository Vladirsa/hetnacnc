import { authenticate, MiddlewareRoute } from "@medusajs/framework/http"

// El documento público del cliente NO está aquí: vive en /cotizacion/:token,
// fuera de /store, porque Medusa exige x-publishable-api-key en todo /store/*
// y ese link se abre dando clic desde WhatsApp. Ver api/cotizacion/[token].
export const storeCotizadorMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET", "POST"],
    matcher: "/store/cotizador/perfil",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/cotizador/servicios",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["POST"],
    matcher: "/store/cotizador/calcular",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET", "POST"],
    matcher: "/store/cotizador/cotizaciones",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/cotizador/cotizaciones/:id",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["POST"],
    matcher: "/store/cotizador/cotizaciones/:id/enviar",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
