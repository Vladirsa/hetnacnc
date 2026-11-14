// Textos de correo del alta de clientes con número de afiliación (lib/afiliacion.ts).
import { CUPON_BIENVENIDA, MINIMO, MONTO, pesos } from "./cupones"
import { STORE_URL, boton, esc, marco } from "./licitacion"

export const DIAS_PRUEBA_TALLER = 14

const ligaTaller = `${STORE_URL}/mx/talleres/unete?utm_source=correo&utm_medium=afiliacion&utm_campaign=cliente_a_taller`

/** Bloque para el correo de «Recibimos tu solicitud». */
export function bloqueAfiliacion(d: { numero: string; ligaActivar: string | null }) {
  const cupon =
    `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">🎁 Con tu cuenta tienes <b>${pesos(MONTO())} de descuento</b> en tu primera compra de ${pesos(MINIMO())} o más con el cupón <b>${esc(CUPON_BIENVENIDA())}</b>.</p>`
  return (
    `<div style="margin:20px 0;padding:16px;border:2px solid #C2560A;border-radius:12px;background:#FDEEE1">` +
    `<p style="margin:0 0 6px;color:#142033;font-size:13px;text-transform:uppercase;letter-spacing:.08em">Tu número de afiliado HETNA</p>` +
    `<p style="margin:0 0 12px;color:#142033;font-size:26px;font-weight:800">${esc(d.numero)}</p>` +
    (d.ligaActivar
      ? `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">Tu cuenta ya está lista: sólo elige tu contraseña y verás tus solicitudes, propuestas y pedidos en un solo lugar.</p>` +
        boton("Activar mi cuenta", d.ligaActivar)
      : `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">Ya tienes cuenta con este correo: inicia sesión y verás esta solicitud en «Mis solicitudes».</p>`) +
    cupon +
    `</div>`
  )
}

/** Bienvenida al activar la cuenta desde la liga del correo. */
export function bienvenidaAfiliado(d: { nombre?: string | null; numero: string }) {
  return marco(
    "¡Bienvenido a HETNA CNC!",
    `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">${d.nombre ? `Hola ${esc(d.nombre)}:` : "Hola:"} tu cuenta quedó activa.</p>` +
      `<p style="margin:0 0 4px;color:#142033;font-size:13px;text-transform:uppercase;letter-spacing:.08em">Tu número de afiliado</p>` +
      `<p style="margin:0 0 16px;color:#142033;font-size:26px;font-weight:800">${esc(d.numero)}</p>` +
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">🎁 Usa el cupón <b>${esc(CUPON_BIENVENIDA())}</b> y llévate <b>${pesos(MONTO())} de descuento</b> en tu primera compra de ${pesos(MINIMO())} o más.</p>` +
      boton("Ir a mi cuenta", `${STORE_URL}/mx/user`) +
      `<hr style="border:0;border-top:1px solid #E7E4DC;margin:20px 0"/>` +
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">🛠️ <b>¿Tienes taller o máquinas CNC?</b> Regístralo gratis, recibe solicitudes de clientes de tu zona y prueba ${DIAS_PRUEBA_TALLER} días el Cotizador CNC sin límite.</p>` +
      `<p style="margin:0"><a href="${ligaTaller}" style="color:#C2560A;font-weight:bold">Registrar mi taller →</a></p>`
  )
}
