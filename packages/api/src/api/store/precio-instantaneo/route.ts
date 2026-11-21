import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { precioMaterialParaCotizar } from "../../../lib/materiales-precios"
import { precioDesglosado, type EntradaPrecio } from "../../../lib/precio-instantaneo"

// Precio desglosado y en vivo para las calculadoras públicas (/cotizar/*, guías):
// se llama mientras el cliente mueve material, medidas o cantidad. No guarda
// nada ni pide correo; el lead se registra en /store/quote-leads.
export const POST = async (req: MedusaRequest<EntradaPrecio>, res: MedusaResponse) => {
  const b: any = req.body || {}
  const entrada: EntradaPrecio = {
    servicio: String(b.servicio || ""),
    material: b.material ? String(b.material).slice(0, 80) : undefined,
    ancho: Math.min(10000, Number(b.ancho)),
    largo: Math.min(10000, Number(b.largo)),
    alto: b.alto != null ? Math.min(10000, Number(b.alto)) : undefined,
    calibre: b.calibre ? String(b.calibre).slice(0, 80) : undefined,
    calidad: b.calidad ? String(b.calidad).slice(0, 80) : undefined,
    cantidad: Math.min(10000, Math.max(1, Math.round(Number(b.cantidad) || 1))),
    // Del archivo del cliente, ya a la escala pedida (opcionales)
    corte_mm: Number(b.corte_mm) > 0 ? Math.min(5_000_000, Number(b.corte_mm)) : undefined,
    perforaciones: Number(b.perforaciones) > 0 ? Math.min(100_000, Number(b.perforaciones)) : undefined,
    volumen_cm3: Number(b.volumen_cm3) > 0 ? Math.min(1_000_000, Number(b.volumen_cm3)) : undefined,
  }
  entrada.precio_material = await precioMaterialParaCotizar(req.scope, entrada.servicio!, entrada.material, entrada.calibre)
  const r = precioDesglosado(entrada)
  if (!r.ok) return res.status(400).json({ message: r.mensaje })
  res.json(r.precio)
}
