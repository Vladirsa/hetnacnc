// Posventa del Cotizador: después de entregar, el cliente final reporta una
// falla, pide garantía o un ajuste desde la misma liga donde siguió su pedido
// (hetnacnc.com/c/<token>). Al taller le llega como caso a seguir (alerta en
// la app, push y correo) y lo atiende en la pantalla Posventa de la app.
//
//   GET  /api/cotizacion-liga/<token>/posventa   casos del pedido (sin datos de contacto)
//   POST /api/cotizacion-liga/<token>/posventa   multipart: tipo, descripcion, nombre,
//                                                contacto, sitio_web (trampa) y hasta 3 fotos
//
// Tabla posventa_casos (supabase/taller_vende_mas.sql del repo del Cotizador).
// Las fotos van al bucket privado "solicitudes" bajo <negocio>/posventa/...
import { randomUUID } from "crypto"

import { avisarTaller } from "./avisos-taller"
import { extension, limitador, nombreSeguro, subirArchivo } from "./cotizador-archivos"
import { cotizacionPorToken } from "./cotizacion-liga"
import { ErrorSuscripcion, supa } from "./cotizador-suscripciones"

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")

export const TIPOS_POSVENTA = { falla: "una falla", garantia: "garantía", ajuste: "un ajuste", otro: "un comentario" } as const
// "Entrega" es "listo para entrega": todavía no lo tiene el cliente
export const ESTADOS_ENTREGADOS = ["Entregado"]
export const FOTOS_MAX = 3
export const FOTO_MAX_MB = 8
const EXT_FOTO = ["jpg", "jpeg", "png", "webp", "heic"]
const ABIERTOS_MAX = 3

const limpio = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max)
// 5 reportes por hora por IP
const permitido = limitador(5, 3_600_000)

/** El pedido de la liga del cliente (el más reciente de esa cotización). */
async function pedidoDeLiga(token: string) {
  const c = await cotizacionPorToken(token)
  const filas = await supa<any[]>(
    `/rest/v1/pedidos?cotizacion_id=eq.${c.id}&select=id,negocio_id,folio,estado,cliente_id&order=created_at.desc&limit=1`
  )
  const p = filas[0]
  if (!p) throw new ErrorSuscripcion("Esta cotización todavía no es pedido.", 404)
  return p
}

const sinTabla = (e: unknown) => /posventa_casos|42P01|PGRST205/.test((e as Error).message)

async function casosDe(pedidoId: string): Promise<any[] | null> {
  try {
    return await supa<any[]>(
      `/rest/v1/posventa_casos?pedido_id=eq.${pedidoId}&select=id,tipo,descripcion,estado,respuesta,created_at,resuelto_en&order=created_at.desc&limit=20`
    )
  } catch (e) {
    // Sin la tabla (no se ha corrido el SQL): la liga no se cae
    if (sinTabla(e)) return null
    throw e
  }
}

/** Lo que ve el cliente en la liga de su pedido. */
export async function posventaPublica(token: string) {
  const p = await pedidoDeLiga(token)
  const lista = await casosDe(p.id)
  const casos = lista || []
  return {
    disponible: lista !== null && ESTADOS_ENTREGADOS.includes(p.estado),
    casos: casos.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      descripcion: c.descripcion,
      estado: c.estado,
      respuesta: c.respuesta || null,
      creado: c.created_at,
      resuelto: c.resuelto_en || null,
    })),
  }
}

export type FotoSubida = { originalname: string; mimetype: string; size: number; buffer: Buffer }

export async function reportarPosventa(token: string, campos: Record<string, any>, fotos: FotoSubida[], ip: string, logger?: any) {
  // Trampa para robots: el campo va oculto y vacío en la app
  if (limpio(campos.sitio_web, 10)) return { ok: true }
  if (!permitido(ip)) throw new ErrorSuscripcion("Ya mandaste varios reportes. Intenta de nuevo en una hora.", 429)

  const p = await pedidoDeLiga(token)
  if (!ESTADOS_ENTREGADOS.includes(p.estado))
    throw new ErrorSuscripcion("El reporte de posventa se abre cuando el pedido ya fue entregado. Mientras, escríbele al taller.")

  const tipo = (Object.keys(TIPOS_POSVENTA) as string[]).includes(campos.tipo) ? (campos.tipo as keyof typeof TIPOS_POSVENTA) : "falla"
  const descripcion = String(campos.descripcion ?? "").trim().slice(0, 2000)
  if (descripcion.length < 10) throw new ErrorSuscripcion("Cuéntanos con un poco más de detalle qué pasó (mínimo 10 letras).")
  const nombre = limpio(campos.nombre, 120) || null
  const contacto = limpio(campos.contacto, 160) || null

  const previos = await casosDe(p.id)
  if (previos === null) throw new ErrorSuscripcion("El taller todavía no activa la posventa. Escríbele por WhatsApp.", 503)
  const abiertos = previos.filter((c) => c.estado === "nuevo" || c.estado === "en_revision")
  if (abiertos.length >= ABIERTOS_MAX)
    throw new ErrorSuscripcion("Ya hay reportes abiertos de este pedido. El taller te responderá aquí mismo.")

  const lista = (fotos || []).slice(0, FOTOS_MAX)
  for (const f of lista) {
    if (!EXT_FOTO.includes(extension(f.originalname)) || !/^image\//.test(f.mimetype || ""))
      throw new ErrorSuscripcion("Las fotos deben ser JPG, PNG, WEBP o HEIC.")
    if (f.size > FOTO_MAX_MB * 1024 * 1024) throw new ErrorSuscripcion(`Cada foto puede pesar hasta ${FOTO_MAX_MB} MB.`)
  }

  const id = randomUUID()
  const guardadas: { ruta: string }[] = []
  for (const [i, f] of lista.entries()) {
    const ruta = `${p.negocio_id}/posventa/${id}/${i + 1}_${nombreSeguro(f.originalname, `foto.${extension(f.originalname) || "jpg"}`)}`
    try {
      await subirArchivo(ruta, f.buffer, f.mimetype)
      guardadas.push({ ruta })
    } catch (e) {
      logger?.warn?.(`[posventa] foto no guardada: ${(e as Error).message}`)
    }
  }

  try {
    await supa(`/rest/v1/posventa_casos`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id,
        negocio_id: p.negocio_id,
        pedido_id: p.id,
        folio: p.folio || null,
        tipo,
        descripcion,
        cliente_nombre: nombre,
        contacto,
        fotos: guardadas,
      }),
    })
  } catch (e) {
    if (/posventa_casos|42P01|PGRST205/.test((e as Error).message))
      throw new ErrorSuscripcion("El taller todavía no activa la posventa. Escríbele por WhatsApp.", 503)
    throw e
  }

  const quien = nombre || "Tu cliente"
  await avisarTaller(
    {
      negocioId: p.negocio_id,
      tipo: "posventa",
      titulo: `🛠️ Posventa: ${quien} pidió ${TIPOS_POSVENTA[tipo]} (pedido ${p.folio || ""})`.trim(),
      cuerpo: `"${descripcion.slice(0, 160)}${descripcion.length > 160 ? "…" : ""}"${guardadas.length ? ` · ${guardadas.length} foto(s)` : ""}. Atiéndelo en Posventa.`,
      pedidoId: p.id,
      clienteId: p.cliente_id || null,
      boton: "Abrir el Cotizador",
      liga: `${SITIO}/cotizador/`,
    },
    logger
  )
  return { ok: true, id }
}
