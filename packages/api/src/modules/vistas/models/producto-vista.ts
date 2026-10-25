import { model } from "@medusajs/framework/utils"

/**
 * Cuántas veces se vio la ficha de un producto, agregado por día.
 *
 * Una fila por producto y por día, NO una por visita. Con una fila por visita
 * la tabla crecería sin techo y para pintar una gráfica habría que agrupar
 * millones de renglones; así cada día de cada producto cuesta una fila y la
 * consulta del tablero es un SELECT directo.
 *
 * Tampoco se guarda quién vio: ni IP, ni cuenta, ni sesión. Para "qué productos
 * visitan y a cuáles conviene bajarles el precio" el conteo alcanza, y no
 * guardar datos personales que no se necesitan es la decisión correcta por
 * defecto.
 *
 * `seller_id` se copia aquí a propósito, en lugar de resolverlo después por la
 * oferta: el tablero del taller filtra por él en cada consulta, y un producto
 * puede cambiar de ofertas con el tiempo sin que eso deba reescribir su
 * historia de visitas.
 */
const ProductoVista = model
  .define("producto_vista", {
    id: model.id({ prefix: "pvis" }).primaryKey(),
    product_id: model.text(),
    seller_id: model.text().nullable(),
    // Día natural en UTC, formato YYYY-MM-DD. Texto y no fecha porque es una
    // llave de agrupación, no un instante: así no hay zonas horarias que
    // muevan un conteo de un día a otro.
    dia: model.text(),
    total: model.number().default(0),
  })
  .indexes([
    { on: ["product_id", "dia"], unique: true },
    { on: ["seller_id", "dia"] },
    { on: ["dia"] },
  ])

export default ProductoVista
