const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "HETNA CNC"
const BRAND_COLOR = "#142033"

function layout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#f4f4f4; padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
        <div style="background:${BRAND_COLOR};padding:20px 24px;">
          <span style="color:#ffffff;font-size:18px;font-weight:600;">${SITE_NAME}</span>
        </div>
        <div style="padding:24px;color:#1a1a1a;font-size:15px;line-height:1.5;">
          ${bodyHtml}
        </div>
        <div style="padding:16px 24px;color:#888;font-size:12px;">
          ${title}
        </div>
      </div>
    </div>
  `
}

export function welcomeEmailHtml({ name }: { name: string }): string {
  const greeting = name ? `Hola ${name}` : "Hola"
  return layout(
    "Recibiste este correo por crear una cuenta en " + SITE_NAME,
    `
      <h1 style="font-size:20px;margin:0 0 16px;">${greeting}, ¡bienvenido a ${SITE_NAME}!</h1>
      <p>Tu cuenta ya está lista. Aquí puedes cotizar y comprar piezas, máquinas y
      accesorios CNC directo con vendedores verificados en México.</p>
      <p style="margin-top:24px;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com"}"
           style="background:${BRAND_COLOR};color:#fff;padding:12px 20px;border-radius:4px;text-decoration:none;display:inline-block;">
          Explorar catálogo
        </a>
      </p>
    `
  )
}

export type AbandonedCartItem = { title: string; quantity: number }

export function abandonedCartEmailHtml({
  items,
  total,
  currencyCode,
  cartUrl,
}: {
  items: AbandonedCartItem[]
  total: number
  currencyCode: string
  cartUrl: string
}): string {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;">${i.title}</td><td style="padding:6px 0;text-align:right;">x${i.quantity}</td></tr>`
    )
    .join("")

  return layout(
    "Recibiste este correo porque dejaste productos en tu carrito en " + SITE_NAME,
    `
      <h1 style="font-size:20px;margin:0 0 16px;">Dejaste algo en tu carrito</h1>
      <p>Tus productos siguen disponibles. Termina tu compra antes de que se agote el stock:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>
      <p style="font-weight:600;">Total: ${total.toFixed(2)} ${currencyCode.toUpperCase()}</p>
      <p style="margin-top:24px;">
        <a href="${cartUrl}"
           style="background:${BRAND_COLOR};color:#fff;padding:12px 20px;border-radius:4px;text-decoration:none;display:inline-block;">
          Terminar mi compra
        </a>
      </p>
    `
  )
}

export function digitalDownloadEmailHtml({
  displayId,
  archivos,
  expiresAt,
  misDescargasUrl,
}: {
  displayId: number | string
  archivos: { titulo: string; url: string }[]
  expiresAt: string
  // Liga permanente a Mi cuenta > Mis descargas (null si la compra no tiene cuenta)
  misDescargasUrl: string | null
}): string {
  const expiraFecha = new Date(expiresAt).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string)

  return layout(
    "Recibiste este correo por comprar un producto digital en " + SITE_NAME,
    `
      <h1 style="font-size:20px;margin:0 0 16px;">¡Gracias por tu compra!</h1>
      <p>${archivos.length === 1 ? "Tu archivo ya está listo" : "Tus archivos ya están listos"} para descargar (pedido #${esc(String(displayId))}).</p>
      ${archivos
        .map(
          (a) => `
      <div style="border:1px solid #E7E4DC;border-radius:8px;padding:12px 14px;margin-top:12px;">
        <p style="margin:0 0 10px;font-weight:bold;">${esc(a.titulo)}</p>
        <a href="${a.url}"
           style="background:${BRAND_COLOR};color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;display:inline-block;">
          Descargar
        </a>
      </div>`
        )
        .join("")}
      <p style="color:#666;font-size:13px;margin-top:16px;">Estos botones funcionan hasta el ${expiraFecha}.
      ${
        misDescargasUrl
          ? `Después, bájalos cuando quieras desde <a href="${misDescargasUrl}" style="color:${BRAND_COLOR};">Mi cuenta &gt; Mis descargas</a>.`
          : "Si expiran, contáctanos y te generamos una liga nueva."
      }</p>
      <p style="color:#666;font-size:13px;">Te adjuntamos el comprobante de entrega en PDF, con la licencia de uso y recomendaciones antes de maquinar.</p>
    `
  )
}

export function quoteLeadEmailHtml({
  servicioNombre,
  estimadoMin,
  estimadoMax,
  whatsappUrl,
}: {
  servicioNombre: string
  estimadoMin: number
  estimadoMax: number
  whatsappUrl: string
}): string {
  return layout(
    "Recibiste este correo por pedir una cotización en " + SITE_NAME,
    `
      <h1 style="font-size:20px;margin:0 0 16px;">Tu estimado de ${servicioNombre}</h1>
      <p>Con los datos que nos diste, tu pieza costaría aproximadamente:</p>
      <p style="font-size:24px;font-weight:700;margin:12px 0;">
        $${estimadoMin.toFixed(0)} – $${estimadoMax.toFixed(0)} MXN
      </p>
      <p style="color:#666;font-size:13px;">Precio estimado, incluye IVA. El precio final puede variar según
      el archivo real de tu pieza, acabados y disponibilidad de material.</p>
      <p style="margin-top:24px;">
        <a href="${whatsappUrl}"
           style="background:${BRAND_COLOR};color:#fff;padding:12px 20px;border-radius:4px;text-decoration:none;display:inline-block;">
          Pedir cotización formal por WhatsApp
        </a>
      </p>
    `
  )
}

export type ProductoAResenar = { titulo: string; url: string }

// "Califica lo que compraste". El único correo de la tienda que no pide dinero:
// pide dos minutos. Vale la pena porque una ficha con reseñas vende y una en
// ceros compite nada más por precio -- y si nadie invita, nadie reseña solo.
//
// Cada producto va con su propio enlace, directo a su ficha. Un botón genérico
// a "mis pedidos" obliga a buscar, y lo que obliga a buscar no se hace.
export function reviewRequestEmailHtml({
  nombre,
  productos,
}: {
  nombre?: string | null
  productos: ProductoAResenar[]
}): string {
  const saludo = nombre ? `Hola ${nombre},` : "Hola,"

  const filas = productos
    .map(
      (p) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;">
           <a href="${p.url}" style="color:${BRAND_COLOR};text-decoration:none;font-weight:600;">${p.titulo}</a>
           <br/>
           <a href="${p.url}" style="color:#B34D07;font-size:13px;">Calificar este producto →</a>
         </td></tr>`
    )
    .join("")

  const cuantos = productos.length === 1 ? "tu compra" : "tus compras"

  return layout(
    "Recibiste este correo porque compraste en " + SITE_NAME,
    `
      <h1 style="font-size:20px;margin:0 0 16px;">¿Cómo te fue con ${cuantos}?</h1>
      <p>${saludo}</p>
      <p>
        Tu opinión le sirve a quien está decidiendo si le compra al mismo taller.
        Son dos minutos y ayuda más de lo que parece.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">${filas}</table>
      <p style="color:#666;font-size:13px;margin-top:20px;">
        Si algo salió mal con tu pedido, contéstanos este correo y lo vemos
        nosotros antes de que escribas nada público.
      </p>
    `
  )
}

export type ResumenParaCorreo = {
  dia: string
  moneda: string
  pedidos: number
  ingresos: number
  pedidos_sin_pagar: number
  clientes_nuevos: number
  carritos_abandonados: number
  valor_abandonado: number
  resenas_nuevas: number
  talleres: { nombre: string; pedidos: number; ingresos: number }[]
  pedidos_antier: number
  ingresos_antier: number
}

// El resumen de ayer, en un correo que se lee en diez segundos.
//
// Cada cifra va con su comparación contra el día anterior, porque un número
// solo no dice si fue buen día. Y se dice explícitamente que las visitas no
// están, en vez de dejar un hueco que parezca un cero.
export function resumenDiarioEmailHtml(r: ResumenParaCorreo): string {
  const dinero = (n: number) =>
    n.toLocaleString("es-MX", {
      style: "currency",
      currency: (r.moneda || "mxn").toUpperCase(),
      maximumFractionDigits: 0,
    })

  const compara = (hoy: number, ayer: number): string => {
    if (ayer === 0 && hoy === 0) return `<span style="color:#888;">igual que antier</span>`
    if (ayer === 0) return `<span style="color:#1F5B29;">antier no hubo</span>`
    const pct = Math.round(((hoy - ayer) / ayer) * 100)
    if (pct === 0) return `<span style="color:#888;">igual que antier</span>`
    const color = pct > 0 ? "#1F5B29" : "#9B3225"
    const signo = pct > 0 ? "+" : ""
    return `<span style="color:${color};">${signo}${pct}% vs antier</span>`
  }

  const fila = (etiqueta: string, valor: string, extra = "") =>
    `<tr>
       <td style="padding:7px 0;border-bottom:1px solid #eee;">${etiqueta}</td>
       <td style="padding:7px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700;">${valor}</td>
       <td style="padding:7px 0 7px 10px;border-bottom:1px solid #eee;font-size:12px;white-space:nowrap;">${extra}</td>
     </tr>`

  const desglose = r.talleres.length
    ? `<h2 style="font-size:15px;margin:22px 0 8px;">Por taller</h2>
       <table style="width:100%;border-collapse:collapse;">
         ${r.talleres
           .map(
             (t) =>
               `<tr>
                  <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">${t.nombre}</td>
                  <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;">${t.pedidos} ped.</td>
                  <td style="padding:6px 0 6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;">${dinero(t.ingresos)}</td>
                </tr>`
           )
           .join("")}
       </table>`
    : ""

  const sinPagar = r.pedidos_sin_pagar
    ? `<p style="margin:14px 0 0;color:#7A4A09;font-size:13px;">
         ${r.pedidos_sin_pagar} pedido${r.pedidos_sin_pagar === 1 ? "" : "s"} sin pago confirmado.
         Todavía no cuentan como venta.
       </p>`
    : ""

  return layout(
    `Resumen de ${r.dia} · ${SITE_NAME}`,
    `
      <h1 style="font-size:20px;margin:0 0 4px;">Ayer en ${SITE_NAME}</h1>
      <p style="color:#888;font-size:13px;margin:0 0 18px;">${r.dia}</p>

      <table style="width:100%;border-collapse:collapse;">
        ${fila("Pedidos pagados", String(r.pedidos), compara(r.pedidos, r.pedidos_antier))}
        ${fila("Ingresos", dinero(r.ingresos), compara(r.ingresos, r.ingresos_antier))}
        ${fila("Clientes nuevos", String(r.clientes_nuevos))}
        ${fila(
          "Carritos abandonados",
          String(r.carritos_abandonados),
          r.valor_abandonado > 0 ? `${dinero(r.valor_abandonado)} en juego` : ""
        )}
        ${fila("Reseñas nuevas", String(r.resenas_nuevas))}
      </table>

      ${sinPagar}
      ${desglose}

      <p style="color:#888;font-size:12px;margin-top:22px;border-top:1px solid #eee;padding-top:12px;">
        Las visitas y las fichas vistas no vienen aquí: ésas viven en GA4 y en el
        Pixel de Meta, no en la base de la tienda. Esto es lo que la tienda sabe
        de cierto.
      </p>
    `
  )
}
