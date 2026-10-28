import { MetadataRoute } from "next"

// Zonas privadas (cuenta, carrito, pago, mensajes) no se rastrean: no aportan a
// Google y gastan su tiempo de rastreo en páginas que piden iniciar sesión.
const PRIVADAS = [
  "/api/",
  "/*/user",
  "/*/cart",
  "/*/checkout",
  "/*/mensajes",
  "/*/favoritos",
  "/*/taller/",
  "/*/login",
  "/*/register",
  "/*/reset-password",
]

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVADAS }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
