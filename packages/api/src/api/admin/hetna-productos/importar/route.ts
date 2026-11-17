// POST /admin/hetna-productos/importar  (multipart: archivo = plantilla llena; modo = "revisar" | "importar")
//   revisar  → lee y revisa todo, no cambia nada: errores por renglón y qué se crearía/actualizaría.
//   importar → vuelve a revisar y, si no hay errores (o solo_validos=1), crea/actualiza productos y ofertas.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ErrorImportar, importar, revisar } from "../../../../lib/importar-productos/importar"
import { leerPlantilla } from "../../../../lib/importar-productos/plantilla"
import { listaDeArchivos } from "../../../cam-multipart"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const a = listaDeArchivos(req as any)[0]
  if (!a || !/\.xlsx$/i.test(a.originalname)) return res.status(400).json({ message: "Sube la plantilla llena en formato .xlsx." })
  const cuerpo = (req.body || {}) as Record<string, unknown>
  const modo = cuerpo.modo === "importar" ? "importar" : "revisar"
  const soloValidos = cuerpo.solo_validos === "1" || cuerpo.solo_validos === "true"
  try {
    const lectura = await leerPlantilla(a.buffer)
    const plan = await revisar(req.scope, lectura)
    const resumen = {
      renglones: lectura.renglones,
      productos: lectura.productos.length,
      crear: plan.pasos.filter((p) => p.accion === "crear").map((p) => ({ handle: p.producto.handle, nombre: p.producto.nombre, variantes: p.producto.variantes.length, categoria: p.categoria_nombre, estado: p.producto.estado })),
      actualizar: plan.pasos.filter((p) => p.accion === "actualizar").map((p) => ({ handle: p.producto.handle, nombre: p.producto.nombre, variantes: p.producto.variantes.length, categoria: p.categoria_nombre, estado: p.producto.estado })),
      errores: plan.errores,
      avisos: plan.avisos,
    }
    if (modo === "revisar") return res.json({ modo, ...resumen })
    if (plan.errores.length && !soloValidos) return res.status(400).json({ modo, ...resumen, message: "El archivo tiene errores. Corrígelos o importa sólo los productos sin errores." })
    if (!plan.pasos.length) return res.status(400).json({ modo, ...resumen, message: "No hay productos para importar." })
    const r = await importar(req.scope, plan)
    res.json({ modo, ...resumen, resultados: r.resultados, avisos: [...plan.avisos, ...r.avisos] })
  } catch (e) {
    if (e instanceof ErrorImportar) return res.status(409).json({ message: e.message })
    req.scope.resolve("logger").error(`[importar-productos] ${(e as Error).message}`)
    res.status(500).json({ message: `No se pudo importar: ${(e as Error).message}` })
  }
}
