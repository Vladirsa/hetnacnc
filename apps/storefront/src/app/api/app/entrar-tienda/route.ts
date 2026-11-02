// Entrar a la app del taller (Android y web) con la cuenta de hetnacnc.com.
//
// POST { email, password }
//   200 { token_hash, tipo: "magiclink" }   la app lo cambia por una sesión en
//        Supabase (POST /auth/v1/verify { type: "magiclink", token_hash }) y
//        queda con la sesión de su taller, sin otra contraseña
//        (lib/services/entrar_tienda.dart del repo Cotizador).
//   200 { activar: { taller, telefono } }   la cuenta aún no tiene taller en la
//        app: se manda otra vez con { ..., taller, telefono } para crearlo
//        (14 días de prueba) y entrar.
//   200 { confirmar: correo }                el correo de la tienda no está
//        confirmado: al confirmarlo (liga del registro) vuelve a intentar.
//   401 correo o contraseña incorrectos · 429 demasiados intentos
//
// Es lo mismo que el botón "Cotizador" de la tienda (lib/cotizador-vinculo.ts,
// entradaCotizador / activarCotizador), pero con correo y contraseña en lugar
// de la sesión del navegador. La contraseña sólo pasa a Medusa para validarla;
// no se guarda en ningún lado.
import { excedido, json, opciones } from "@/lib/app-movil/cors"
import { ipDe } from "@/lib/seguridad/ip-cliente"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

// Freno contra adivinar contraseñas: por correo, además del límite por IP.
const fallos = new Map<string, number[]>()
const VENTANA = 15 * 60_000
const MAX_FALLOS = 5
const bloqueado = (correo: string) => (fallos.get(correo) || []).filter((t) => Date.now() - t < VENTANA).length >= MAX_FALLOS
const anotarFallo = (correo: string) =>
  fallos.set(correo, [...(fallos.get(correo) || []).filter((t) => Date.now() - t < VENTANA), Date.now()])

type Cuerpo = { email?: string; password?: string; taller?: string; telefono?: string }

export const OPTIONS = (req: Request) => opciones(req)

export async function POST(req: Request) {
  if (excedido(req, "entrar-tienda", 10)) {
    return json(req, { message: "Demasiados intentos. Espera un minuto." }, 429)
  }
  const b = (await req.json().catch(() => ({}))) as Cuerpo
  const correo = String(b.email || "").trim().toLowerCase()
  const clave = String(b.password || "")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || !clave) {
    return json(req, { message: "Escribe tu correo y tu contraseña de hetnacnc.com." }, 400)
  }
  if (bloqueado(correo)) {
    return json(req, { message: "Demasiados intentos con este correo. Espera 15 minutos o cambia tu contraseña en hetnacnc.com." }, 429)
  }
  const ip = ipDe(req.headers) || ""

  // 1) Correo y contraseña contra la cuenta de la tienda
  let token = ""
  try {
    const r = await fetch(`${BACKEND}/auth/customer/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(ip ? { "x-forwarded-for": ip } : {}) },
      body: JSON.stringify({ email: correo, password: clave }),
      cache: "no-store",
    })
    const d = (await r.json().catch(() => ({}))) as { token?: string }
    token = r.ok && typeof d.token === "string" ? d.token : ""
  } catch {
    return json(req, { message: "No pudimos conectar con hetnacnc.com. Intenta de nuevo." }, 502)
  }
  if (!token) {
    anotarFallo(correo)
    return json(req, { message: "Correo o contraseña incorrectos." }, 401)
  }

  // 2) Entrar (o crear su taller) en la app
  const quiereActivar = typeof b.taller === "string" && b.taller.trim().length > 1
  const cuerpo = quiereActivar
    ? { accion: "activar", taller: b.taller!.trim().slice(0, 120), telefono: String(b.telefono || "").trim().slice(0, 30) }
    : { accion: "entrar" }
  let d: Record<string, any> = {}
  let status = 502
  try {
    const r = await fetch(`${BACKEND}/store/cotizador-vinculo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PK,
        authorization: `Bearer ${token}`,
        ...(ip ? { "x-forwarded-for": ip } : {}),
      },
      body: JSON.stringify(cuerpo),
      cache: "no-store",
    })
    status = r.status
    d = (await r.json().catch(() => ({}))) as Record<string, any>
  } catch {
    return json(req, { message: "No pudimos conectar con hetnacnc.com. Intenta de nuevo." }, 502)
  }

  // Correo sin confirmar: el middleware de la tienda responde 403
  if (status === 403) {
    return json(req, {
      confirmar: correo,
      message: `Primero confirma tu correo ${correo} con la liga que te mandamos al registrarte (búscala también en spam). Si no te llegó, pide otra en hetnacnc.com, en Mi cuenta.`,
    })
  }
  if (status >= 400) return json(req, { message: d.message || "No se pudo entrar. Intenta de nuevo." }, status)

  if (typeof d.url === "string") {
    // La liga de un solo uso trae el token: https://<supabase>/auth/v1/verify?token=...&type=magiclink
    let tokenHash = ""
    try {
      tokenHash = new URL(d.url).searchParams.get("token") || ""
    } catch {
      tokenHash = ""
    }
    if (!tokenHash) return json(req, { message: "No se pudo preparar la entrada. Intenta de nuevo." }, 502)
    return json(req, { token_hash: tokenHash, tipo: "magiclink" }, 200, { "Cache-Control": "no-store" })
  }
  if (d.activar) return json(req, { activar: d.activar })
  if (d.confirmar) {
    return json(req, { confirmar: d.confirmar, message: "Confirma tu correo: te mandamos una liga a " + d.confirmar + ". Ábrela y vuelve a intentar." })
  }
  return json(req, { message: "Tu cuenta no se pudo vincular con la app. Escríbenos por WhatsApp." }, 409)
}
