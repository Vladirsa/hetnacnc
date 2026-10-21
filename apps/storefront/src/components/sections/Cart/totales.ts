import { HttpTypes } from "@medusajs/types"

// Las cuentas del resumen, calculadas sobre los renglones que se le pasen.
//
// Se suman aquí, en el navegador, y no se toma `cart.total` del backend. Es una
// decisión con costo y conviene tenerla a la vista: el backend sólo sabe
// cobrar el carrito completo, así que para que destildar un producto lo saque
// de la cuenta -- que es lo que cualquiera espera de una casilla -- las cuentas
// tienen que salir de los renglones elegidos.
//
// Por eso el panel dice "Estimación total" y no "Total": el número bueno es el
// que confirma la pasarela, ya con el envío y los impuestos de la dirección
// real. Y por eso el botón de continuar se encarga de que lo que quede en el
// carrito sea exactamente lo marcado: si la pantalla suma una cosa y el cobro
// es otra, la casilla es una mentira.
//
// Cada renglón ya trae sus propios totales calculados por Medusa (subtotal,
// descuento e impuesto por línea), así que esto suma números que hizo el
// backend; no se re-aplica ninguna promoción a mano.
export type Totales = {
  piezas: number
  listaArticulos: number
  subtotal: number
  descuentoArticulos: number
  cupon: number
  impuestos: number
  envio: number
  total: number
  ahorro: number
}

export const calcularTotales = (
  items: HttpTypes.StoreCartLineItem[],
  envio = 0
): Totales => {
  let piezas = 0
  let listaArticulos = 0
  let subtotal = 0
  let cupon = 0
  let impuestos = 0

  for (const item of items) {
    piezas += item.quantity
    const linea = item.subtotal ?? 0
    // Precio de lista: lo que costaría sin el descuento de catálogo. Si la
    // oferta no trae precio comparativo, cuenta con el suyo, así que este
    // número nunca queda por debajo del subtotal.
    listaArticulos += Math.max((item.compare_at_unit_price || 0) * item.quantity, linea)
    subtotal += linea
    cupon += item.discount_total ?? 0
    impuestos += item.tax_total ?? 0
  }

  const descuentoArticulos = Math.max(listaArticulos - subtotal, 0)

  return {
    piezas,
    listaArticulos,
    subtotal,
    descuentoArticulos,
    cupon,
    impuestos,
    envio,
    total: subtotal - cupon + impuestos + envio,
    ahorro: descuentoArticulos + cupon,
  }
}
