import { MedusaResponse } from "@medusajs/framework/http"

import { VendorRequest } from "./vendor-request"
import { actividadEnForo } from "../../../lib/foro-actividad"
import { rankingDeTalleres } from "../../../lib/tablero-ranking"
import { saludDelTaller } from "../../../lib/tablero-salud"
import {
  candidatosADescuento,
  catalogoDelTaller,
  cotizadorDelTaller,
  mesDeMexico,
  productosMasVistos,
  resenasDelTaller,
  ventasDelTaller,
  vistasDelTaller,
} from "../../../lib/tablero-taller"
import { TABLERO_MODULE } from "../../../modules/tablero"
import type TableroModuleService from "../../../modules/tablero/service"

// GET /vendor/tablero
//
// Todo lo que pinta el tablero del taller en una sola llamada. Son siete
// consultas a fuentes distintas; pedirlas una por una desde el navegador
// serían siete viajes y una pantalla que se arma a pedazos.
//
// Las piezas que pueden fallar solas (foro, cotizador, vistas) ya devuelven su
// propio valor vacío en vez de lanzar: el taller tiene que poder ver sus
// ventas aunque el foro ande caído.
export const GET = async (req: VendorRequest, res: MedusaResponse) => {
  const sellerId = req.seller_context!.seller_id

  const [ventas, vistas, catalogo, salud] = await Promise.all([
    ventasDelTaller(req.scope, sellerId),
    vistasDelTaller(req.scope, sellerId),
    catalogoDelTaller(req.scope, sellerId),
    saludDelTaller(req.scope, sellerId),
  ])

  // Las reseñas cuelgan de los productos, así que primero hay que saber
  // cuáles son suyos.
  const productoIds = [...new Set([...catalogo.keys(), ...ventas.por_producto.keys()])]

  const [resenas, foro, cotizador, ranking, meta] = await Promise.all([
    resenasDelTaller(req.scope, productoIds),
    actividadEnForo(sellerId),
    cotizadorDelTaller(req.scope, sellerId),
    rankingDeTalleres(req.scope, sellerId),
    metaDelMes(req, sellerId),
  ])

  const moneda = ventas.moneda || "mxn"

  res.json({
    moneda,
    mes: mesDeMexico(),
    ventas: {
      ventana_dias: ventas.ventana_dias,
      total_pedidos: ventas.total_pedidos,
      ingresos_totales: ventas.ingresos_totales,
      por_dia: ventas.por_dia,
      pedidos_mes: ventas.pedidos_mes,
      ingresos_mes: ventas.ingresos_mes,
      ticket_promedio: ventas.total_pedidos
        ? Math.round(ventas.ingresos_totales / ventas.total_pedidos)
        : 0,
      ingresos_previos: salud.previos.ingresos,
      pedidos_previos: salud.previos.pedidos,
    },
    por_enviar: salud.por_enviar,
    stock: salud.stock,
    reputacion: salud.reputacion,
    meta,
    vistas: {
      total: vistas.total,
      productos: productosMasVistos(vistas.por_producto, ventas.por_producto, catalogo),
      // Conversión del taller completo: de cada cien que entran a una ficha,
      // cuántas terminan en una pieza vendida.
      conversion: vistas.total
        ? Number(
            (
              [...ventas.por_producto.values()].reduce((s, p) => s + p.cantidad, 0) / vistas.total
            ).toFixed(4)
          )
        : null,
    },
    descuentos: candidatosADescuento(vistas.por_producto, ventas.por_producto, catalogo),
    productos_top: [...ventas.por_producto.entries()]
      .map(([producto_id, p]) => ({ producto_id, ...p }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10),
    resenas,
    foro,
    cotizador,
    ranking,
    catalogo_total: catalogo.size,
  })
}

async function metaDelMes(req: VendorRequest, sellerId: string) {
  const mes = mesDeMexico()
  const servicio = req.scope.resolve<TableroModuleService>(TABLERO_MODULE)

  const filas = await servicio.listTallerMetas({ seller_id: sellerId, mes })
  const fila = filas?.[0]

  return {
    mes,
    objetivo: fila ? Number(fila.meta_ingresos) || 0 : 0,
    puesta: Boolean(fila),
  }
}
