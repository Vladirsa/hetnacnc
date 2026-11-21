import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { precioMaterialParaCotizar } from "../../../lib/materiales-precios"
import { precioDesglosado, type EntradaPrecio } from "../../../lib/precio-instantaneo"
import { tarifaDoblez } from "../../../lib/tarifa-doblez"

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
  // Lámina con dobleces (STEP, estrategia 3.1): se suma el doblez al precio de
  // referencia que ponen los talleres; sin talleres con precio, sólo se informa.
  const dobleces = Math.max(0, Math.min(200, Math.round(Number(b.dobleces) || 0)))
  if (dobleces && (entrada.servicio === "plasma" || entrada.servicio === "laser_co2")) {
    const p: any = r.precio
    const t = await tarifaDoblez(req.scope)
    if (t) {
      const extra = Math.round(dobleces * entrada.cantidad! * t.tarifa * 100) / 100
      const ivaPct = p.recomendado > 0 ? p.iva / p.recomendado : 0.16
      p.minimo = Math.round((p.minimo + extra) * 100) / 100
      p.recomendado = Math.round((p.recomendado + extra) * 100) / 100
      p.maximo = Math.round((p.maximo + extra) * 100) / 100
      p.iva = Math.round(p.recomendado * ivaPct * 100) / 100
      p.total = Math.round((p.recomendado + p.iva) * 100) / 100
      p.calculo = [...(p.calculo || []), `Dobleces: ${dobleces} por pieza × $${t.tarifa} (precio de referencia de ${t.talleres} ${t.talleres === 1 ? "taller" : "talleres"})`]
      p.doblez = { dobleces, tarifa: t.tarifa, talleres: t.talleres, total: extra }
    } else {
      p.calculo = [...(p.calculo || []), `Dobleces: ${dobleces} por pieza (el precio del doblez lo da cada taller)`]
      p.doblez = { dobleces, tarifa: null, talleres: 0, total: 0 }
    }
  }
  res.json(r.precio)
}
