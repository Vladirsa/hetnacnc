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
