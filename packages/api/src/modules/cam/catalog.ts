/**
 * Catálogo de servicios CAM que se venden en la tienda.
 *
 * Los precios reales se editan en el admin de Medusa (Productos). Aquí solo
 * viven los handles de los productos, los niveles de complejidad y las reglas
 * con las que el servidor elige el nivel según el trabajo calculado.
 */

export type CamService = "cam_3" | "cam_4" | "cam_5" | "post"
export type CamTier = "Básica" | "Media" | "Alta"

export const CAM_TIER_OPTION = "Complejidad"
export const CAM_TIERS: CamTier[] = ["Básica", "Media", "Alta"]

export const CAM_PRODUCT_HANDLES: Record<CamService | "review", string> = {
  cam_3: "servicio-cam-3-ejes",
  cam_4: "servicio-cam-4-ejes",
  cam_5: "servicio-cam-5-ejes",
  post: "posprocesador-personalizado",
  review: "revision-especialista-cam",
}

/**
 * Foto de cada servicio: un JPG 1080x1080 que sirve la tienda en
 * /productos/cam/<handle>.jpg (apps/storefront/public/productos/cam). La URL es
 * absoluta para que se vea igual en la tienda, el panel y los catálogos.
 */
export const camImageUrl = (key: CamService | "review") =>
  `${(process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")}/productos/cam/${CAM_PRODUCT_HANDLES[key]}.jpg`

/** Tienda (seller de Mercur) que vende los servicios CAM. */
export const camSellerHandle = () => (process.env.CAM_SELLER_HANDLE || "hetna-cnc").trim()

/** Servicios que se cobran por nivel de complejidad. */
export const TIERED_SERVICES: CamService[] = ["cam_3", "cam_4", "cam_5"]

export type CamJobStats = {
  minutes?: number
  points?: number
  triangles?: number
  collisions?: number
  adjusted?: number
  cut_length_m?: number
  gcode_lines?: number
}

/**
 * Umbrales para elegir el nivel. Ajusta estos números a tu forma de cobrar.
 * Se evalúan en orden: el primero que se cumple gana.
 */
export const TIER_RULES: { tier: CamTier; minutes: number; points: number; triangles: number }[] = [
  { tier: "Alta", minutes: 90, points: 60000, triangles: 500000 },
  { tier: "Media", minutes: 20, points: 15000, triangles: 100000 },
]

export function computeTier(stats: CamJobStats | null | undefined): CamTier {
  const s = stats ?? {}
  for (const rule of TIER_RULES) {
    if (
      (s.minutes ?? 0) > rule.minutes ||
      (s.points ?? 0) > rule.points ||
      (s.triangles ?? 0) > rule.triangles
    ) {
      return rule.tier
    }
  }
  return "Básica"
}

/** Estrategia del CAM Lab -> servicio que se cobra. */
export function serviceFromStrategy(kind: string | undefined): CamService {
  switch (kind) {
    case "top3":
      return "cam_3"
    case "rot4":
      return "cam_4"
    case "top5":
    case "rot5":
      return "cam_5"
    default:
      return "cam_3"
  }
}

/**
 * Precios de ejemplo (unidades mayores: 450 = $450.00) que usa el script de
 * carga inicial. Después cámbialos en el admin.
 */
export const SEED_PRICES: Record<string, Record<string, number[]>> = {
  mxn: { cam_3: [450, 850, 1500], cam_4: [900, 1600, 2800], cam_5: [1800, 3200, 5500], post: [1200], review: [600] },
  usd: { cam_3: [25, 49, 85], cam_4: [50, 90, 155], cam_5: [100, 180, 305], post: [65], review: [35] },
  eur: { cam_3: [23, 45, 79], cam_4: [46, 83, 143], cam_5: [92, 166, 281], post: [60], review: [32] },
}
