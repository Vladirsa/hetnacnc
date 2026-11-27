// GET /store/hetna-social -> { redes: ["google", "facebook", "linkedin"] } (las que tienen llaves en el servidor)
// La tienda sólo muestra los botones de estas redes.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const redes = [
    process.env.GOOGLE_LOGIN_ID && process.env.GOOGLE_LOGIN_SECRET ? "google" : null,
    process.env.FACEBOOK_LOGIN_ID && process.env.FACEBOOK_LOGIN_SECRET ? "facebook" : null,
    process.env.LINKEDIN_LOGIN_ID && process.env.LINKEDIN_LOGIN_SECRET ? "linkedin" : null,
  ].filter(Boolean)
  res.json({ redes })
}
