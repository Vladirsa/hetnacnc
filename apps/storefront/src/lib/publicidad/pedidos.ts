// Pedidos de publicidad (solo servidor): crear el pedido, marcarlo como pagado y activar el anuncio.

import { db } from "@/lib/foro/db"
import { SITIO } from "@/lib/foro/tipos"

import { ESPACIOS, type EspacioId } from "./tipos"

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type NuevoPedido = {
  espacio: EspacioId
  dias: number
  monto: number
  anunciante: string
  nombre: string
  correo: string
  telefono: string
  titulo: string
  subtitulo: string
  boton: string
  enlace: string
  imagen: Buffer
  imagenTipo: string
}

// ¿Quedan lugares libres en este espacio? (pedidos pagados que aún no vencen)
export async function lugaresLibres(espacio: EspacioId): Promise<number> {
  const r = await db().query(
    `select count(*)::int as n from publicidad.pedidos where espacio = $1 and estado = 'pagado' and vence > now()`,
    [espacio]
  )
  return Math.max(0, ESPACIOS[espacio].max - (r.rows[0]?.n ?? 0))
}

export async function crearPedido(p: NuevoPedido): Promise<string> {
  const r = await db().query(
    `insert into publicidad.pedidos (espacio, dias, monto, anunciante, nombre, correo, telefono, titulo, subtitulo, boton, enlace, imagen, imagen_tipo)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
    [p.espacio, p.dias, p.monto, p.anunciante, p.nombre || null, p.correo, p.telefono || null, p.titulo, p.subtitulo || null,
      p.boton || null, p.enlace, p.imagen, p.imagenTipo]
  )
  return r.rows[0].id as string
}

export async function guardarPreferencia(id: string, preferencia: string) {
  await db().query(`update publicidad.pedidos set mp_preferencia = $2 where id = $1`, [id, preferencia])
}

export async function leerPedido(id: string) {
  if (!UUID.test(id)) return null
  const r = await db().query(
    `select id, espacio, dias, monto::float as monto, anunciante, nombre, correo, telefono, titulo, estado, vence
     from publicidad.pedidos where id = $1`,
    [id]
  )
  return (r.rows[0] as {
    id: string
    espacio: string
    dias: number
    monto: number
    anunciante: string
    nombre: string | null
    correo: string
    telefono: string | null
    titulo: string
    estado: string
    vence: string | null
  }) || null
}

// Marca el pedido como pagado y deja el anuncio creado pero APAGADO, para que una persona lo revise
// antes de activarlo. Si ya estaba pagado, no hace nada (Mercado Pago puede avisar varias veces).
export async function marcarPagado(id: string, pagoId: string) {
  const cli = await db().connect()
  try {
    await cli.query("begin")
    const u = await cli.query(
      `update publicidad.pedidos
         set estado = 'pagado', mp_pago = $2, pagado_en = now(), vence = now() + make_interval(days => dias)
       where id = $1 and estado in ('pendiente', 'rechazado')
       returning id, espacio, dias, monto::float as monto, anunciante, nombre, correo, telefono, titulo, subtitulo, boton, enlace, vence`,
      [id, pagoId]
    )
    const ped = u.rows[0]
    if (!ped) {
      await cli.query("commit")
      return null
    }
    const pieza = await cli.query(
      `insert into publicidad.piezas (espacio, titulo, subtitulo, boton, enlace, imagen_url, anunciante, es_publicidad, orden, desde, hasta, activo)
       values ($1, $2, $3, $4, $5, $6, $7, true, 10, now(), $8, false) returning id`,
      [ped.espacio, ped.titulo, ped.subtitulo, ped.boton, ped.enlace, `${SITIO}/api/pub/imagen/${ped.id}`, ped.anunciante, ped.vence]
    )
    await cli.query(`update publicidad.pedidos set pieza_id = $2 where id = $1`, [id, pieza.rows[0].id])
    await cli.query("commit")
    return ped as {
      id: string
      espacio: string
      dias: number
      monto: number
      anunciante: string
      nombre: string | null
      correo: string
      telefono: string | null
      titulo: string
      vence: string
    }
  } catch (e) {
    await cli.query("rollback").catch(() => {})
    throw e
  } finally {
    cli.release()
  }
}

// Avisa a n8n (si está configurado) para que te llegue la alerta de un pago nuevo o un recordatorio.
export async function avisarN8n(carga: Record<string, unknown>) {
  const url = process.env.N8N_PUB_URL
  if (!url) {
    console.log("[publicidad] aviso (sin N8N_PUB_URL):", JSON.stringify(carga))
    return
  }
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 8000)
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": process.env.N8N_REDES_TOKEN || "" },
      body: JSON.stringify(carga),
      signal: ctl.signal,
    })
    clearTimeout(t)
  } catch (e) {
    console.warn("[publicidad] no se pudo avisar a n8n:", (e as Error).message)
  }
}
