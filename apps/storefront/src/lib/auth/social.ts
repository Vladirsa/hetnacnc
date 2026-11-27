// Entrar con Google, Facebook o LinkedIn: clientes de la tienda y talleres (panel /seller).
// El backend activa cada red si tiene sus llaves (packages/api/medusa-config.ts).
export const REDES_SOCIALES = ["google", "facebook", "linkedin"] as const
export type RedSocial = (typeof REDES_SOCIALES)[number]
export const esRedSocial = (v: string): v is RedSocial => (REDES_SOCIALES as readonly string[]).includes(v)
export const NOMBRE_RED: Record<RedSocial, string> = { google: "Google", facebook: "Facebook", linkedin: "LinkedIn" }

// Cookies del viaje de ida y vuelta a la red (10 minutos)
export const COOKIE_ESTADO = "hetna_social_estado"
export const COOKIE_VOLVER = "hetna_social_volver"
// "taller": la entrada es al panel de vendedor (actor "member"), no a la tienda
export const COOKIE_PARA = "hetna_social_para"
export const PANEL_TALLER = "/seller"

// Dirección pública del sitio. Detrás de nginx la tienda se ve a sí misma como
// localhost:3000: redirigir con req.nextUrl.origin mandaba al cliente a localhost.
export const SITIO_PUBLICO = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")
