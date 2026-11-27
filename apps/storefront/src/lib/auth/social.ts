// Entrar con Google, Facebook o LinkedIn (sólo clientes de la tienda).
// El backend activa cada red si tiene sus llaves (packages/api/medusa-config.ts).
export const REDES_SOCIALES = ["google", "facebook", "linkedin"] as const
export type RedSocial = (typeof REDES_SOCIALES)[number]
export const esRedSocial = (v: string): v is RedSocial => (REDES_SOCIALES as readonly string[]).includes(v)
export const NOMBRE_RED: Record<RedSocial, string> = { google: "Google", facebook: "Facebook", linkedin: "LinkedIn" }

// Cookies del viaje de ida y vuelta a la red (10 minutos)
export const COOKIE_ESTADO = "hetna_social_estado"
export const COOKIE_VOLVER = "hetna_social_volver"
