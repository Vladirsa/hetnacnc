import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PORTADAS_MODULE, PortadasModuleService } from "../../../../modules/portadas"

const MAX_PORTADAS = 8

// GET /store/hetna/portadas — portadas visibles ahora mismo en la tienda.
// Se publican solas al llegar su fecha de inicio y se quitan solas al vencer.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const portadas = req.scope.resolve<PortadasModuleService>(PORTADAS_MODULE)
  const ahora = new Date()

  const lista = await portadas.listPortadas(
    { activa: true, estado: "aprobada" },
    { order: { orden: "ASC", created_at: "DESC" }, take: 100 }
  )

  const visibles = lista
    .filter((p) => {
      const inicia = p.inicia_en ? new Date(p.inicia_en) : null
      const termina = p.termina_en ? new Date(p.termina_en) : null
      return (!inicia || inicia <= ahora) && (!termina || termina >= ahora)
    })
    // Las portadas pagadas por vendedores van primero; las de HETNA rellenan el resto
    .sort((a, b) => Number(b.origen === "vendedor") - Number(a.origen === "vendedor"))
    .slice(0, MAX_PORTADAS)
    .map((p) => ({
      id: p.id,
      etiqueta: p.etiqueta,
      titulo: p.titulo,
      texto: p.texto,
      imagen_url: p.imagen_url,
      boton1_texto: p.boton1_texto,
      boton1_url: p.boton1_url,
      boton2_texto: p.boton2_texto,
      boton2_url: p.boton2_url,
    }))

  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ portadas: visibles })
}
