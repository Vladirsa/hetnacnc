// Mandar la cotización por correo desde el Cotizador (pedido de Vlado, 24 nov 2026).
//
// La app arma el PDF con la plantilla que eligió el taller (Diseño de tu
// cotización) y lo manda aquí con el correo del cliente, el asunto y el
// mensaje. HETNA lo envía con Resend:
//   - De: "<nombre del taller>" <la dirección de RESEND_FROM_EMAIL>
//   - Responder a: el correo del taller (Configuración) o el de quien lo manda
//   - Adjunto: el PDF; botón "Ver y aceptar en línea" si la cotización tiene liga
//
// Cuidados (el correo sale con el dominio de HETNA):
//   - Sólo usuarios activos del taller con rol administrador o vendedor.
//   - La cotización tiene que ser del taller.
//   - El mensaje se escapa (sin HTML del usuario) y se recorta.
//   - Tope por taller: 20 por hora y 100 al día (Gratis: 10 al día).
//   - PDF de hasta 8 MB y que de verdad sea PDF.
// Es un correo de trabajo (el cliente pidió la cotización), no promoción:
// no lleva liga de baja.
import { ErrorSuscripcion, supa } from "./cotizador-suscripciones"
import { sendEmail } from "./resend"

const supaUrl = () => (process.env.COTIZADOR_SUPABASE_URL || "https://ldfmkfbhcbsbecfbzsny.supabase.co").replace(/\/$/, "")
const supaKey = () => process.env.COTIZADOR_SUPABASE_SERVICE_KEY || ""

export const ROLES_CORREO = ["administrador", "super_admin", "vendedor"]
export const MAX_PDF_MB = 8
export const POR_HORA = 20
export const POR_DIA = 100
export const POR_DIA_GRATIS = 10

const CORREO = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/
export const correoValido = (c: unknown) => typeof c === "string" && c.length <= 160 && CORREO.test(c.trim())

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")

const limpio = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, max)

/** Plan que paga: gratis también si la prueba ya venció. */
export function esGratis(plan: string | null | undefined, trialHasta?: string | null, ahora = new Date()) {
  const p = String(plan || "gratis")
  if (["taller", "pro", "premium", "industrial", "master"].includes(p)) return false
  if (["trial", "prueba"].includes(p) && trialHasta && new Date(trialHasta).getTime() > ahora.getTime()) return false
  return true
}

// ── Tope por taller (en memoria: se reinicia con el servidor, suficiente contra abusos) ──
const envios = new Map<string, number[]>()

/** ¿Puede mandar otro? Si sí, lo anota. Regresa el mensaje de error o null. */
export function revisarTope(negocioId: string, gratis: boolean, ahora = Date.now(), mapa = envios): string | null {
  const dia = 24 * 3_600_000
  const lista = (mapa.get(negocioId) || []).filter((t) => ahora - t < dia)
  const enHora = lista.filter((t) => ahora - t < 3_600_000).length
  const topeDia = gratis ? POR_DIA_GRATIS : POR_DIA
  if (lista.length >= topeDia) {
    return gratis
      ? `Llegaste a ${POR_DIA_GRATIS} correos hoy en el plan Gratis. Mañana puedes mandar más, o cambia de plan.`
      : `Llegaste a ${POR_DIA} correos hoy. Mañana puedes mandar más.`
  }
  if (enHora >= POR_HORA) return `Mandaste ${POR_HORA} correos en la última hora. Espera un rato y vuelve a intentar.`
  lista.push(ahora)
  mapa.set(negocioId, lista)
  return null
}

export type Datos = {
  taller: string
  logo?: string | null
  mensaje: string
  liga?: string | null
  folio: string
  gratis: boolean
}

/** HTML del correo: sobrio, con el nombre/logo del taller. */
export function htmlCorreo(d: Datos): string {
  const parrafos = d.mensaje
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;line-height:1.55;color:#1E2329">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("")
  const logo =
    d.logo && /^https:\/\//.test(d.logo)
      ? `<img src="${esc(d.logo)}" alt="" height="44" style="display:block;max-height:44px;max-width:160px;margin:0 0 10px">`
      : ""
  const boton = d.liga
    ? `<p style="margin:18px 0"><a href="${esc(d.liga)}" style="display:inline-block;background:#142033;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:8px">Ver y aceptar la cotización en línea</a></p>`
    : ""
  const pie = d.gratis
    ? `<p style="margin:14px 0 0;font-size:11px;color:#9A9A92;text-align:center">Enviado con el Cotizador gratis de HETNA CNC · <a href="https://hetnacnc.com/cotizador" style="color:#9A9A92">hetnacnc.com/cotizador</a></p>`
    : ""
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#F4F5F7;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E3E5E8;border-radius:12px;padding:24px">
${logo}<p style="margin:0 0 16px;font-size:13px;color:#6B7280"><strong style="color:#142033;font-size:15px">${esc(d.taller)}</strong><br>Cotización ${esc(d.folio)}</p>
${parrafos}${boton}
<p style="margin:16px 0 0;font-size:12px;color:#6B7280">Adjuntamos la cotización en PDF. Para cualquier duda, responde a este correo.</p>
</div>${pie}</body></html>`
}

/** El archivo de verdad es un PDF (empieza con %PDF). */
export const esPdf = (b: Buffer | undefined) => !!b && b.length > 4 && b.subarray(0, 5).toString("latin1").startsWith("%PDF")

async function usuarioDelTaller(token: string | undefined) {
  if (!token) throw new ErrorSuscripcion("Inicia sesión en el Cotizador.", 401)
  const r = await fetch(`${supaUrl()}/auth/v1/user`, {
    headers: { apikey: supaKey(), Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) throw new ErrorSuscripcion("Tu sesión expiró. Vuelve a iniciar sesión.", 401)
  const user = (await r.json()) as { id: string; email?: string }
  const fila = (
    await supa<any[]>(`/rest/v1/usuarios_negocio?user_id=eq.${user.id}&activo=eq.true&select=negocio_id,rol&order=id.desc&limit=1`)
  )[0]
  if (!fila) throw new ErrorSuscripcion("Tu cuenta no tiene taller.", 403)
  if (!ROLES_CORREO.includes(fila.rol)) throw new ErrorSuscripcion("Tu rol no puede mandar cotizaciones. Pídeselo al administrador o a ventas.", 403)
  const n = (await supa<any[]>(`/rest/v1/negocios?id=eq.${fila.negocio_id}&select=id,nombre,plan,trial_hasta&limit=1`))[0]
  if (!n) throw new ErrorSuscripcion("No encontramos tu taller.", 404)
  return { correoUsuario: user.email || "", negocio: n }
}

/**
 * POST /api/cotizador-correo (multipart): archivo `pdf` y campos
 * cotizacion_id, para, asunto, mensaje.
 */
export async function enviarCotizacionPorCorreo(
  token: string | undefined,
  campos: Record<string, unknown>,
  pdf: { buffer: Buffer; originalname?: string } | undefined
) {
  const para = limpio(campos.para, 160).toLowerCase()
  if (!correoValido(para)) throw new ErrorSuscripcion("Escribe un correo válido del cliente.")
  const id = limpio(campos.cotizacion_id, 40)
  if (!/^[0-9a-fA-F-]{8,40}$|^\d{1,12}$/.test(id)) throw new ErrorSuscripcion("Guarda la cotización antes de mandarla por correo.")
  if (!pdf?.buffer?.length || !esPdf(pdf.buffer)) throw new ErrorSuscripcion("No llegó el PDF de la cotización. Vuelve a intentar.")
  if (pdf.buffer.length > MAX_PDF_MB * 1024 * 1024) throw new ErrorSuscripcion(`El PDF pesa más de ${MAX_PDF_MB} MB.`)

  const { correoUsuario, negocio } = await usuarioDelTaller(token)
  const cot = (
    await supa<any[]>(`/rest/v1/cotizaciones?id=eq.${encodeURIComponent(id)}&negocio_id=eq.${negocio.id}&select=id,folio,token_publico&limit=1`)
  )[0]
  if (!cot) throw new ErrorSuscripcion("No encontramos esa cotización en tu taller.", 404)

  const cfg =
    (
      await supa<any[]>(`/rest/v1/configuracion_empresa?negocio_id=eq.${negocio.id}&select=nombre_comercial,correo,logo_url&limit=1`).catch(
        () => []
      )
    )[0] || {}
  const taller = limpio(cfg.nombre_comercial || negocio.nombre || "Tu taller", 80)
  const gratis = esGratis(negocio.plan, negocio.trial_hasta)
  const tope = revisarTope(String(negocio.id), gratis)
  if (tope) throw new ErrorSuscripcion(tope, 429)

  const folio = limpio(cot.folio || "Cotización", 40)
  const asunto = limpio(campos.asunto, 150) || `Cotización ${folio} de ${taller}`
  const mensaje = limpio(campos.mensaje, 3000) || `Hola, te compartimos la cotización ${folio}.`
  const liga = /^[A-Za-z0-9]{16,40}$/.test(String(cot.token_publico || "")) ? `https://hetnacnc.com/c/${cot.token_publico}` : null
  const responderA = correoValido(cfg.correo) ? String(cfg.correo).trim() : correoValido(correoUsuario) ? correoUsuario : undefined
  const nombre = (limpio(pdf.originalname, 80) || `${folio}.pdf`).replace(/[^\w.\- ]/g, "_").replace(/(\.pdf)?$/i, ".pdf")

  const envio = await sendEmail({
    to: para,
    subject: asunto.replace(/[\r\n]/g, " "),
    html: htmlCorreo({ taller, logo: cfg.logo_url, mensaje, liga, folio, gratis }),
    adjuntos: [{ nombre, contenido: pdf.buffer }],
    de: taller,
    responderA,
  })
  if (!envio.sent) {
    throw new ErrorSuscripcion("No se pudo mandar el correo en este momento. Intenta de nuevo en unos minutos.", 502)
  }
  return { ok: true, enviada_a: para }
}
