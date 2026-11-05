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

// Buscadores con IA (ChatGPT, Claude, Perplexity, Gemini, Copilot, Apple,
// Meta). Se nombran uno por uno con permiso explícito: varios hosting y
// Cloudflare los bloquean por defecto, y algunos sólo leen la regla con su
// nombre. Así HETNA puede aparecer cuando alguien le pregunta a una IA dónde
// comprar o fabricar algo de CNC en México.
const BUSCADORES_IA = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "GoogleOther",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
  "meta-externalagent",
  "Amazonbot",
  "DuckAssistBot",
  "MistralAI-User",
  "CCBot",
]

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVADAS },
      { userAgent: BUSCADORES_IA, allow: ["/", "/llms.txt"], disallow: PRIVADAS },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
