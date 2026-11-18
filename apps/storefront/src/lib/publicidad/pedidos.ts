// Pedidos de publicidad (solo servidor): crear el pedido, marcarlo como pagado y activar el anuncio.

import { db } from "@/lib/foro/db"
import { SITIO } from "@/lib/foro/tipos"

import { asegurarEsquema } from "./esquema"
import { ESPACIOS, type EspacioId, type TipoAnunciante } from "./tipos"

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type NuevoPedido = {
  espacio: EspacioId
  dias: number // 7, 30, 90, 365 (en un paquete de vistas, 365 = plazo de cortesía)
  modalidad: "periodo" | "vistas"
  vistasCompradas: number | null
  tipoAnunciante: TipoAnunciante
  token: string
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
  await asegurarEsquema()
  const r = await db().query(
    `select count(*)::int as n from publicidad.pedidos where espacio = $1 and estado = 'pagado' and vence > now()`,
    [espacio]
  )
  return Math.max(0, ESPACIOS[espacio].max - (r.rows[0]?.n ?? 0))
}

export async function crearPedido(p: NuevoPedido): Promise<string> {
  await asegurarEsquema()
  const r = await db().query(
    `insert into publicidad.pedidos (espacio, dias, monto, anunciante, nombre, correo, telefono, titulo, subtitulo, boton, enlace, imagen, imagen_tipo,
       modalidad, vistas_compradas, tipo_anunciante, token)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
    [p.espacio, p.dias, p.monto, p.anunciante, p.nombre || null, p.correo, p.telefono || null, p.titulo, p.subtitulo || null,
      p.boton || null, p.enlace, p.imagen, p.imagenTipo, p.modalidad, p.vistasCompradas, p.tipoAnunciante, p.token]
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
  await asegurarEsquema()
  const cli = await db().connect()
  try {
    await cli.query("begin")
    const u = await cli.query(
      `update publicidad.pedidos
         set estado = 'pagado', mp_pago = $2, pagado_en = now(), vence = now() + make_interval(days => dias)
       where id = $1 and estado in ('pendiente', 'rechazado')
       returning id, espacio, dias, monto::float as monto, anunciante, nombre, correo, telefono, titulo, subtitulo, boton, enlace, vence,
         modalidad, vistas_compradas, tipo_anunciante, token`,
      [id, pagoId]
    )
    const ped = u.rows[0]
    if (!ped) {
      await cli.query("commit")
      return null
    }
    // Paquete de vistas: sin fecha de fin; sale hasta llegar a las vistas compradas
    const porVistas = ped.modalidad === "vistas" && ped.vistas_compradas > 0
    const pieza = await cli.query(
      `insert into publicidad.piezas (espacio, titulo, subtitulo, boton, enlace, imagen_url, anunciante, es_publicidad, orden, desde, hasta, activo,
         vistas_objetivo, tipo_anunciante, pedido_id)
       values ($1, $2, $3, $4, $5, $6, $7, true, 10, now(), $8, false, $9, $10, $11) returning id`,
      [ped.espacio, ped.titulo, ped.subtitulo, ped.boton, ped.enlace, `${SITIO}/api/pub/imagen/${ped.id}`, ped.anunciante,
        porVistas ? null : ped.vence, porVistas ? ped.vistas_compradas : null, ped.tipo_anunciante || "cnc", ped.id]
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
      modalidad: string
      vistas_compradas: number | null
      token: string | null
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

export type EstadoAnunciante = {
  id: string
  espacio: string
  anunciante: string
  modalidad: string
  dias: number
  monto: number
  estado: string // pendiente | pagado | rechazado | vencido
  vence: string | null
  pagado_en: string | null
  vistas_compradas: number | null
  titulo: string
  enlace: string
  pieza: { activo: boolean; vistas: number; clics: number; desde: string; hasta: string | null } | null
}

/** Lo que ve el anunciante en su panel. Sólo con la llave (token) que se le dio al comprar. */
export async function estadoParaAnunciante(id: string, token: string): Promise<EstadoAnunciante | null> {
  if (!UUID.test(id) || !/^[a-f0-9]{32,64}$/.test(token)) return null
  await asegurarEsquema()
  const r = await db().query(
    `select p.id, p.espacio, p.anunciante, p.modalidad, p.dias, p.monto::float as monto, p.estado, p.vence::text as vence,
            p.pagado_en::text as pagado_en, p.vistas_compradas, p.titulo, p.enlace, p.token,
            z.activo, z.vistas, z.clics, z.desde::text as desde, z.hasta::text as hasta, z.id as pieza
     from publicidad.pedidos p left join publicidad.piezas z on z.id = p.pieza_id
     where p.id = $1`,
    [id]
  )
  const f = r.rows[0]
  if (!f || !f.token) return null
  // Comparación de tiempo constante para no filtrar la llave
  const { timingSafeEqual } = await import("node:crypto")
  const a = Buffer.from(String(f.token))
  const b = Buffer.from(token)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return {
    id: f.id,
    espacio: f.espacio,
    anunciante: f.anunciante,
    modalidad: f.modalidad,
    dias: f.dias,
    monto: f.monto,
    estado: f.estado,
    vence: f.vence,
    pagado_en: f.pagado_en,
    vistas_compradas: f.vistas_compradas,
    titulo: f.titulo,
    enlace: f.enlace,
    pieza: f.pieza ? { activo: f.activo, vistas: f.vistas, clics: f.clics, desde: f.desde, hasta: f.hasta } : null,
  }
}

export type ResumenPedidos = {
  pedidos: {
    id: string
    espacio: string
    anunciante: string
    correo: string
    modalidad: string
    dias: number
    vistas_compradas: number | null
    monto: number
    estado: string
    pagado_en: string | null
    vence: string | null
    pieza_id: string | null
    activo: boolean | null
    vistas: number | null
    clics: number | null
    tipo_anunciante: string
    creado: string
  }[]
  ingresosMes: number
  ingresosTotal: number
  porRevisar: number
}

/** Pedidos para el panel del dashboard (quien llama ya verificó que es administrador). */
export async function resumenPedidos(): Promise<ResumenPedidos> {
  await asegurarEsquema()
  const r = await db().query(
    `select p.id, p.espacio, p.anunciante, p.correo, p.modalidad, p.dias, p.vistas_compradas, p.monto::float as monto, p.estado,
            p.pagado_en::text as pagado_en, p.vence::text as vence, p.pieza_id, z.activo, z.vistas, z.clics, p.tipo_anunciante,
            p.creado::text as creado
     from publicidad.pedidos p left join publicidad.piezas z on z.id = p.pieza_id
     where p.estado <> 'pendiente' or p.creado > now() - interval '7 days'
     order by p.creado desc limit 200`
  )
  const t = await db().query(
    `select coalesce(sum(monto) filter (where pagado_en >= date_trunc('month', now())), 0)::float as mes,
            coalesce(sum(monto), 0)::float as total
     from publicidad.pedidos where estado in ('pagado', 'vencido')`
  )
  const pedidos = r.rows as ResumenPedidos["pedidos"]
  return {
    pedidos,
    ingresosMes: t.rows[0]?.mes ?? 0,
    ingresosTotal: t.rows[0]?.total ?? 0,
    porRevisar: pedidos.filter((x) => x.estado === "pagado" && x.activo === false).length,
  }
}
