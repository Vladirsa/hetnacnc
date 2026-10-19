// Recibe el formulario de "Anúnciate", guarda el pedido y devuelve la liga de pago de Mercado Pago.
// No cobra nada por sí mismo: el anuncio solo se crea cuando Mercado Pago confirma el pago (ver mp-aviso).

import { NextRequest, NextResponse } from "next/server"

import { SITIO } from "@/lib/foro/tipos"
import { crearPedido, guardarPreferencia, lugaresLibres } from "@/lib/publicidad/pedidos"
import { calcularMonto, DIAS_VALIDOS } from "@/lib/publicidad/precios"
import { ESPACIOS, esEspacio } from "@/lib/publicidad/tipos"

export const dynamic = "force-dynamic"

const TIPOS = ["image/webp", "image/jpeg", "image/png"]
const MAX_BYTES = 1_500_000

// Límite sencillo por IP: 6 intentos por hora (evita que alguien llene la base de pedidos falsos)
const intentos = new Map<string, number[]>()
function demasiados(ip: string) {
  const ahora = Date.now()
  const lista = (intentos.get(ip) || []).filter((t) => ahora - t < 3600_000)
  lista.push(ahora)
  intentos.set(ip, lista)
  if (intentos.size > 5000) intentos.clear()
  return lista.length > 6
}

const enlaceSeguro = (v: string): string | null => {
  const t = (v || "").trim()
  if (/^\/(?!\/)/.test(t) || /^https:\/\/[^\s]+$/i.test(t)) return t.slice(0, 1000)
  return null
}

const texto = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

export async function POST(req: NextRequest) {
  if (req.headers.get("x-hetna-pub") !== "1") return NextResponse.json({ error: "Petición no permitida." }, { status: 403 })
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconocida"
  if (demasiados(ip)) return NextResponse.json({ error: "Demasiados intentos. Prueba de nuevo en una hora." }, { status: 429 })

  const token = process.env.MP_ACCESS_TOKEN
  if (!token) return NextResponse.json({ error: "El cobro aún no está activado. Escríbenos y te ayudamos." }, { status: 503 })

  try {
    const f = await req.formData()
    const espacio = texto(f.get("espacio"), 40)
    const dias = Number(texto(f.get("dias"), 4))
    if (!esEspacio(espacio)) return NextResponse.json({ error: "Elige un espacio." }, { status: 400 })
    if (!DIAS_VALIDOS.includes(dias)) return NextResponse.json({ error: "Elige la duración." }, { status: 400 })

    const anunciante = texto(f.get("anunciante"), 120)
    const correo = texto(f.get("correo"), 160).toLowerCase()
    const enlace = enlaceSeguro(texto(f.get("enlace"), 1000))
    if (anunciante.length < 2) return NextResponse.json({ error: "Escribe el nombre de tu taller o empresa." }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 })
    if (!enlace) return NextResponse.json({ error: "El enlace debe empezar con / o con https://" }, { status: 400 })
    if (f.get("aceptar") !== "1") return NextResponse.json({ error: "Acepta las condiciones para continuar." }, { status: 400 })

    const archivo = f.get("archivo")
    if (!(archivo instanceof File)) return NextResponse.json({ error: "Sube la imagen de tu anuncio." }, { status: 400 })
    if (!TIPOS.includes(archivo.type)) return NextResponse.json({ error: "La imagen debe ser WebP, JPG o PNG." }, { status: 400 })
    if (archivo.size > MAX_BYTES) return NextResponse.json({ error: "La imagen pesa más de 1.5 MB." }, { status: 400 })
    const imagen = Buffer.from(await archivo.arrayBuffer())

    if ((await lugaresLibres(espacio)) <= 0)
      return NextResponse.json({ error: "Este espacio está lleno por ahora. Elige otro o escríbenos para la lista de espera." }, { status: 409 })

    const monto = calcularMonto(espacio, dias)
    const id = await crearPedido({
      espacio, dias, monto, anunciante, correo, enlace, imagen, imagenTipo: archivo.type,
      nombre: texto(f.get("nombre"), 120),
      telefono: texto(f.get("telefono"), 30),
      titulo: texto(f.get("titulo"), 140),
      subtitulo: texto(f.get("subtitulo"), 300),
      boton: texto(f.get("boton"), 40),
    })

    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            id: espacio,
            title: `Publicidad HETNA CNC: ${ESPACIOS[espacio].nombre} (${dias} días)`,
            quantity: 1,
            currency_id: "MXN",
            unit_price: monto,
          },
        ],
        payer: { email: correo },
        external_reference: id,
        notification_url: `${SITIO}/api/pub/mp-aviso`,
        back_urls: {
          success: `${SITIO}/mx/anunciate/gracias?pedido=${id}`,
          pending: `${SITIO}/mx/anunciate/gracias?pedido=${id}`,
          failure: `${SITIO}/mx/anunciate?error=pago`,
        },
        auto_return: "approved",
        statement_descriptor: "HETNA CNC",
      }),
    })
    if (!r.ok) {
      console.error("[publicidad] mercadopago", r.status, (await r.text()).slice(0, 300))
      return NextResponse.json({ error: "No se pudo abrir el pago. Intenta de nuevo en unos minutos." }, { status: 502 })
    }
    const j = (await r.json()) as { id?: string; init_point?: string }
    if (!j.init_point) return NextResponse.json({ error: "Mercado Pago no devolvió la liga de pago." }, { status: 502 })
    if (j.id) await guardarPreferencia(id, j.id)
    return NextResponse.json({ url: j.init_point })
  } catch (e) {
    console.error("[publicidad] comprar", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "No se pudo crear tu pedido. Intenta de nuevo." }, { status: 500 })
  }
}
