// Panel del taller > Facturas: los clientes que pidieron CFDI de sus pedidos.
//   GET /vendor/hetna-facturas
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { REGIMENES, T_FACTURA, USOS_CFDI, asegurarTablaFacturas } from "../../../lib/facturas"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablaFacturas(knex)
  const filas = await knex(T_FACTURA).where({ seller_id: sellerId }).orderBy("created_at", "desc").limit(200)
  res.json({
    facturas: filas.map((f: any) => {
      const fiscal = typeof f.fiscal === "string" ? JSON.parse(f.fiscal) : f.fiscal
      return {
        id: f.id,
        display_id: f.display_id,
        total: f.total != null ? Number(f.total) : null,
        estado: f.estado,
        nota: f.nota,
        fiscal: {
          ...fiscal,
          regimen_nombre: REGIMENES[fiscal?.regimen] || "",
          uso_nombre: USOS_CFDI[fiscal?.uso_cfdi] || "",
        },
        tiene_pdf: Boolean(f.pdf_clave),
        tiene_xml: Boolean(f.xml_clave),
        emitida_at: f.emitida_at,
        created_at: f.created_at,
      }
    }),
  })
}
