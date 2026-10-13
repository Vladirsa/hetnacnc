"use server"

// Acciones del chat cliente <-> taller. TODO se valida aquí, en el servidor:
// el navegador nunca decide quién escribe ni qué mensaje pasa el filtro.

import { claveError, db } from "@/lib/foro/db"
import { tallerPorHandle } from "@/lib/hetna/talleres"

import { avisarChat } from "./avisar"
import { conversacionDelCliente, conversacionDelTaller, esUuid, mensajesDe, sesionChat } from "./consultas"
import { revisarMensaje } from "./filtro"
import type { Autor, Mensaje } from "./tipos"

const SITIO = "https://hetnacnc.com/mx"

type Fallo = { ok: false; error: string; motivos?: string[]; intentos?: number }
type Res<T = {}> = ({ ok: true } & T) | Fallo

const texto = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : ""

const fallo = (e: unknown): Fallo => {
  const clave = claveError(e)
  if (clave === "error") console.error("[chat]", e)
  return { ok: false, error: clave === "sin_foro" ? "sin_chat" : clave }
}

// Guarda el intento bloqueado y cuenta cuántos lleva esa persona en 30 días.
// Al tercero la conversación se marca y se avisa para moderar.
async function registrarBloqueo(
  conversacionId: string | null,
  autorClave: string,
  motivos: string[],
  original: string
): Promise<number> {
  try {
    await db().query(
      `insert into chat.bloqueos (conversacion_id, autor_clave, motivos, texto_original) values ($1, $2, $3, $4)`,
      [conversacionId, autorClave, motivos, original]
    )
    const { rows } = await db().query(
      `select count(*)::int as n from chat.bloqueos where autor_clave = $1 and creado > now() - interval '30 days'`,
      [autorClave]
    )
    const n: number = rows[0].n
    if (n >= 3) {
      if (conversacionId) await db().query(`update chat.conversaciones set marcada = true where id = $1`, [conversacionId])
      if (n === 3 || n % 5 === 0) void avisarChat({ tipo: "moderacion", autor: autorClave, intentos: n, motivos, conversacionId })
    }
    return n
  } catch (e) {
    console.error("[chat] bloqueo", (e as Error).message)
    return 1
  }
}

// Máximo 40 mensajes por hora por conversación y por lado
async function demasiados(conversacionId: string, de: Autor): Promise<boolean> {
  const { rows } = await db().query(
    `select count(*)::int as n from chat.mensajes where conversacion_id = $1 and de = $2 and creado > now() - interval '1 hour'`,
    [conversacionId, de]
  )
  return rows[0].n >= 40
}

async function guardarMensaje(conversacionId: string, de: Autor, cuerpo: string): Promise<{ mensaje: Mensaje; sinLeer: number }> {
  const m = await db().query(
    `insert into chat.mensajes (conversacion_id, de, cuerpo) values ($1, $2, $3) returning id, de, cuerpo, creado`,
    [conversacionId, de, cuerpo]
  )
  const col = de === "cliente" ? "sin_leer_taller" : "sin_leer_cliente"
  const c = await db().query(
    `update chat.conversaciones set ultimo_mensaje = now(), ${col} = ${col} + 1 where id = $1 returning ${col} as sin_leer`,
    [conversacionId]
  )
  const f = m.rows[0]
  return {
    mensaje: { id: Number(f.id), de: f.de, cuerpo: f.cuerpo, creado: f.creado instanceof Date ? f.creado.toISOString() : String(f.creado) },
    sinLeer: Number(c.rows[0].sin_leer) || 1,
  }
}

// ---------------------------------------------------------------------
// 1. El cliente empieza una conversación (botón "Preguntar al taller")
// ---------------------------------------------------------------------
export async function iniciarChat(d: {
  tallerHandle: string
  productoHandle?: string
  productoTitulo?: string
  mensaje: string
}): Promise<Res<{ id: string }>> {
  const s = await sesionChat()
  if (!s) return { ok: false, error: "sin_sesion" }
  const cuerpo = texto(d.mensaje, 2000)
  if (!cuerpo) return { ok: false, error: "mensaje_vacio" }

  // El taller se valida contra el catálogo real: el navegador no puede inventar talleres
  const taller = await tallerPorHandle(texto(d.tallerHandle, 120))
  if (!taller) return { ok: false, error: "taller_no_existe" }

  const filtro = revisarMensaje(cuerpo)
  if (filtro.bloqueado) {
    try {
      const n = await registrarBloqueo(null, `c:${s.clienteId}`, filtro.motivos, cuerpo)
      return { ok: false, error: "bloqueado", motivos: filtro.motivos, intentos: n }
    } catch (e) {
      return fallo(e)
    }
  }

  const productoHandle = texto(d.productoHandle, 200) || null
  const productoTitulo = texto(d.productoTitulo, 200) || null
  try {
    const { rows } = await db().query(
      `insert into chat.conversaciones (cliente_id, cliente_nombre, cliente_correo, taller_id, taller_handle, taller_nombre, producto_handle, producto_titulo)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (cliente_id, taller_id, producto_clave) do update set estado = 'abierta'
       returning id, token_taller`,
      [s.clienteId, s.nombre, s.correo, taller.id, taller.handle, taller.nombre, productoHandle, productoTitulo]
    )
    const { id, token_taller } = rows[0]
    if (await demasiados(id, "cliente")) return { ok: false, error: "demasiados" }
    const { sinLeer } = await guardarMensaje(id, "cliente", cuerpo)
    if (sinLeer === 1)
      void avisarChat({
        tipo: "mensaje_a_taller",
        tallerId: taller.id,
        tallerHandle: taller.handle,
        tallerNombre: taller.nombre,
        clienteNombre: s.nombre,
        producto: productoTitulo || undefined,
        vistaPrevia: cuerpo.slice(0, 160),
        url: `${SITIO}/chat-taller/${token_taller}`,
      })
    return { ok: true, id }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// 2. Enviar un mensaje en una conversación existente.
//    Cliente: con su sesión. Taller: con el token de su enlace privado.
// ---------------------------------------------------------------------
export async function enviarMensaje(d: {
  conversacionId?: string
  token?: string
  cuerpo: string
}): Promise<Res<{ mensaje: Mensaje }>> {
  const cuerpo = texto(d.cuerpo, 2000)
  if (!cuerpo) return { ok: false, error: "mensaje_vacio" }

  let de: Autor
  let conv
  let autorClave: string
  if (d.token) {
    de = "taller"
    conv = await conversacionDelTaller(d.token)
    autorClave = conv ? `t:${conv.tallerId}` : ""
  } else {
    const s = await sesionChat()
    if (!s) return { ok: false, error: "sin_sesion" }
    de = "cliente"
    conv = esUuid(d.conversacionId) ? await conversacionDelCliente(d.conversacionId, s.clienteId) : null
    autorClave = `c:${s.clienteId}`
  }
  if (!conv) return { ok: false, error: "conversacion_no_existe" }
  if (conv.estado === "cerrada") return { ok: false, error: "conversacion_cerrada" }

  const filtro = revisarMensaje(cuerpo)
  try {
    if (filtro.bloqueado) {
      const n = await registrarBloqueo(conv.id, autorClave, filtro.motivos, cuerpo)
      return { ok: false, error: "bloqueado", motivos: filtro.motivos, intentos: n }
    }
    if (await demasiados(conv.id, de)) return { ok: false, error: "demasiados" }
    const { mensaje, sinLeer } = await guardarMensaje(conv.id, de, cuerpo)

    // Aviso por n8n solo cuando es el primer mensaje sin leer (así no se manda un aviso por cada línea)
    if (sinLeer === 1) {
      const { rows } = await db().query(`select token_taller, cliente_correo from chat.conversaciones where id = $1`, [conv.id])
      if (de === "cliente")
        void avisarChat({
          tipo: "mensaje_a_taller",
          tallerId: conv.tallerId,
          tallerHandle: conv.tallerHandle,
          tallerNombre: conv.tallerNombre,
          clienteNombre: conv.clienteNombre,
          producto: conv.productoTitulo || undefined,
          vistaPrevia: cuerpo.slice(0, 160),
          url: `${SITIO}/chat-taller/${rows[0].token_taller}`,
        })
      else if (rows[0].cliente_correo)
        void avisarChat({
          tipo: "respuesta_a_cliente",
          clienteCorreo: rows[0].cliente_correo,
          clienteNombre: conv.clienteNombre,
          tallerNombre: conv.tallerNombre,
          vistaPrevia: cuerpo.slice(0, 160),
          url: `${SITIO}/mensajes/${conv.id}`,
        })
    }
    return { ok: true, mensaje }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// 3. Actualización de la ventana (se pregunta cada pocos segundos).
//    Trae los mensajes nuevos y marca lo leído.
// ---------------------------------------------------------------------
export async function leerMensajes(d: {
  conversacionId?: string
  token?: string
  despuesDe: number
}): Promise<Res<{ mensajes: Mensaje[] }>> {
  let id: string | null = null
  let col: "sin_leer_cliente" | "sin_leer_taller"
  if (d.token) {
    const c = await conversacionDelTaller(d.token)
    id = c?.id ?? null
    col = "sin_leer_taller"
  } else {
    const s = await sesionChat()
    if (!s) return { ok: false, error: "sin_sesion" }
    const c = esUuid(d.conversacionId) ? await conversacionDelCliente(d.conversacionId, s.clienteId) : null
    id = c?.id ?? null
    col = "sin_leer_cliente"
  }
  if (!id) return { ok: false, error: "conversacion_no_existe" }
  const despues = Number.isSafeInteger(d.despuesDe) && d.despuesDe > 0 ? d.despuesDe : 0
  try {
    const mensajes = await mensajesDe(id, despues)
    if (mensajes.length) await db().query(`update chat.conversaciones set ${col} = 0 where id = $1`, [id])
    return { ok: true, mensajes }
  } catch (e) {
    return fallo(e)
  }
}
