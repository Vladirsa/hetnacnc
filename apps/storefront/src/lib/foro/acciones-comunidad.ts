"use server"

// Acciones de la comunidad del foro: avisos, mensajes directos, bloqueos,
// seguir un tema, pedir respuesta (como en Quora), asistir a un evento y
// las preferencias de correo. Igual que el resto: el servidor decide.

import { avisar } from "./avisos"
import { sesionForo } from "./consultas"
import { claveError, db } from "./db"
import { revisarTexto } from "./filtro"
import { CORREO_AVISOS, type CorreoAvisos, urlConversacion, urlTema } from "./tipos"

type Res<T = {}> = ({ ok: true } & T) | { ok: false; error: string }

const esId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v)
const entero = (v: unknown) => {
  const n = Number(v)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

// Sin la migración del 31 de octubre las tablas no existen
const fallo = (e: unknown): { ok: false; error: string } => {
  const pg = e as { code?: string }
  if (pg.code === "42P01" || pg.code === "42703") return { ok: false, error: "red_no_activa" }
  const clave = claveError(e)
  if (clave === "error") console.error("[foro comunidad]", e)
  return { ok: false, error: clave }
}

async function conPerfil() {
  const s = await sesionForo()
  if (!s) return { error: "sin_sesion" as const }
  if (!s.perfil) return { error: "sin_perfil" as const }
  if (s.perfil.suspendido) return { error: "perfil_suspendido" as const }
  return { perfil: s.perfil }
}

async function cuenta(sql: string, args: unknown[]) {
  const { rows } = await db().query(sql, args)
  return Number(rows[0]?.n) || 0
}

// ---------------------------------------------------------------------
// Avisos y preferencias de correo
// ---------------------------------------------------------------------

export async function marcarAvisosLeidos(): Promise<Res> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  try {
    await db().query(`update foro.avisos set leido = true where perfil_id = $1 and not leido`, [p.perfil.id])
    return { ok: true }
  } catch (e) {
    return fallo(e)
  }
}

export async function guardarPreferencias(d: { correoAvisos?: unknown; resumenSemanal?: unknown }): Promise<Res> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  const correo = (typeof d.correoAvisos === "string" && d.correoAvisos in CORREO_AVISOS ? d.correoAvisos : "al_momento") as CorreoAvisos
  try {
    await db().query(`update foro.perfiles set correo_avisos = $2, resumen_semanal = $3 where id = $1`, [
      p.perfil.id,
      correo,
      d.resumenSemanal !== false,
    ])
    return { ok: true }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// Seguir un tema (aviso con cada respuesta nueva)
// ---------------------------------------------------------------------

export async function seguirTema(temaId: number, quiere: boolean): Promise<Res<{ siguiendo: boolean }>> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  const id = entero(temaId)
  if (!id) return { ok: false, error: "error" }
  try {
    if (quiere) {
      const t = await db().query(`select 1 from foro.temas where id = $1 and estado = 'publicado'`, [id])
      if (!t.rows[0]) return { ok: false, error: "tema_no_existe" }
      await db().query(`insert into foro.temas_seguidos (perfil_id, tema_id) values ($1, $2) on conflict do nothing`, [p.perfil.id, id])
    } else {
      await db().query(`delete from foro.temas_seguidos where perfil_id = $1 and tema_id = $2`, [p.perfil.id, id])
    }
    return { ok: true, siguiendo: quiere }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// Pedir respuesta: invitar a alguien que sabe a contestar un tema
// ---------------------------------------------------------------------

export async function pedirRespuesta(temaId: number, perfilId: string): Promise<Res> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  const id = entero(temaId)
  if (!id || !esId(perfilId)) return { ok: false, error: "error" }
  if (perfilId === p.perfil.id) return { ok: false, error: "a_ti_mismo" }
  try {
    const { rows } = await db().query(
      `select t.titulo, t.slug, t.autor_id, s.slug as seccion,
         exists (select 1 from foro.perfiles where id = $2 and suspendido = false) as existe
       from foro.temas t join foro.secciones s on s.id = t.seccion_id where t.id = $1 and t.estado = 'publicado'`,
      [id, perfilId]
    )
    const t = rows[0]
    if (!t) return { ok: false, error: "tema_no_existe" }
    if (!t.existe || t.autor_id === perfilId) return { ok: false, error: "no_existe" }
    if ((await cuenta(`select count(*) as n from foro.solicitudes where autor_id = $1 and creado > now() - interval '1 day'`, [p.perfil.id])) >= 20)
      return { ok: false, error: "limite_diario" }
    const r = await db().query(
      `insert into foro.solicitudes (tema_id, perfil_id, autor_id) values ($1, $2, $3) on conflict do nothing`,
      [id, perfilId, p.perfil.id]
    )
    if (!r.rowCount) return { ok: false, error: "ya_pedido" }
    await avisar({
      para: perfilId,
      actor: p.perfil.id,
      tipo: "solicitud",
      texto: `${p.perfil.nombre} te pidió que respondas “${t.titulo}”`,
      url: `${urlTema({ seccion: t.seccion, slug: t.slug })}#responder`,
    })
    return { ok: true }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// Eventos: "Asistiré"
// ---------------------------------------------------------------------

export async function asistir(temaId: number, quiere: boolean): Promise<Res<{ n: number; yo: boolean }>> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  const id = entero(temaId)
  if (!id) return { ok: false, error: "error" }
  try {
    const { rows } = await db().query(`select tipo, estado from foro.temas where id = $1`, [id])
    if (!rows[0] || rows[0].estado !== "publicado") return { ok: false, error: "tema_no_existe" }
    if (rows[0].tipo !== "evento") return { ok: false, error: "no_es_evento" }
    if (quiere) await db().query(`insert into foro.asistencias (tema_id, perfil_id) values ($1, $2) on conflict do nothing`, [id, p.perfil.id])
    else await db().query(`delete from foro.asistencias where tema_id = $1 and perfil_id = $2`, [id, p.perfil.id])
    const n = await cuenta(`select count(*) as n from foro.asistencias where tema_id = $1`, [id])
    return { ok: true, n, yo: quiere }
  } catch (e) {
    return fallo(e)
  }
}

// ---------------------------------------------------------------------
// Mensajes directos
// ---------------------------------------------------------------------

export async function enviarMensaje(usuario: string, cuerpo: string): Promise<Res> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  const yo = p.perfil
  const nuevaCuenta = Date.now() - new Date(yo.creado).getTime() < 24 * 3600 * 1000
  // Los datos de contacto se ocultan igual que en el foro: los tratos se cierran dentro de HETNA
  const t = revisarTexto(String(cuerpo || "").replace(/\r\n?/g, "\n").trim().slice(0, 2000), { cuentaNueva: nuevaCuenta })
  if (!t.texto) return { ok: false, error: "Escribe tu mensaje." }
  if (t.revisar) return { ok: false, error: "mensaje_spam" }
  try {
    const { rows } = await db().query(
      `select id, nombre from foro.perfiles where usuario = $1 and suspendido = false`,
      [String(usuario || "").toLowerCase().slice(0, 30)]
    )
    const otro = rows[0]
    if (!otro) return { ok: false, error: "no_existe" }
    if (otro.id === yo.id) return { ok: false, error: "a_ti_mismo" }
    const bloqueo = await cuenta(`select count(*) as n from foro.bloqueos where perfil_id = $1 and bloqueado_id = $2`, [otro.id, yo.id])
    if (bloqueo) return { ok: false, error: "bloqueado" }
    if ((await cuenta(`select count(*) as n from foro.mensajes where autor_id = $1 and creado > now() - interval '1 day'`, [yo.id])) >= 200)
      return { ok: false, error: "limite_diario" }

    const existe = await db().query(
      `select id from foro.conversaciones where a_id = least($1::uuid, $2::uuid) and b_id = greatest($1::uuid, $2::uuid)`,
      [yo.id, otro.id]
    )
    if (!existe.rows[0]) {
      // Conversaciones nuevas por día: menos para cuentas recién creadas (contra spam)
      const nuevas = await cuenta(
        `select count(*) as n from foro.conversaciones c where (c.a_id = $1 or c.b_id = $1) and c.creado > now() - interval '1 day'
           and (select autor_id from foro.mensajes m where m.conversacion_id = c.id order by m.creado limit 1) = $1`,
        [yo.id]
      )
      if (nuevas >= (nuevaCuenta ? 5 : 30)) return { ok: false, error: "limite_diario" }
    }
    const conv = await db().query(
      `insert into foro.conversaciones (a_id, b_id) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))
       on conflict (a_id, b_id) do update set ultimo = now() returning id`,
      [yo.id, otro.id]
    )
    const cid = conv.rows[0].id
    await db().query(`insert into foro.mensajes (conversacion_id, autor_id, texto) values ($1, $2, $3)`, [cid, yo.id, t.texto])
    await db().query(
      `update foro.conversaciones set ultimo = now(),
         a_leido = case when a_id = $2 then now() else a_leido end,
         b_leido = case when b_id = $2 then now() else b_leido end
       where id = $1`,
      [cid, yo.id]
    )
    // Un solo aviso por conversación mientras no lo lea (no uno por mensaje)
    const pendiente = await cuenta(
      `select count(*) as n from foro.avisos where perfil_id = $1 and actor_id = $2 and tipo = 'mensaje' and not leido`,
      [otro.id, yo.id]
    )
    if (!pendiente)
      await avisar({ para: otro.id, actor: yo.id, tipo: "mensaje", texto: `${yo.nombre} te mandó un mensaje`, url: urlConversacion(yo.usuario) })
    return { ok: true }
  } catch (e) {
    return fallo(e)
  }
}

export async function bloquear(perfilId: string, quiere: boolean): Promise<Res<{ bloqueado: boolean }>> {
  const p = await conPerfil()
  if ("error" in p) return { ok: false, error: p.error as string }
  if (!esId(perfilId) || perfilId === p.perfil.id) return { ok: false, error: "error" }
  try {
    if (quiere)
      await db().query(`insert into foro.bloqueos (perfil_id, bloqueado_id) values ($1, $2) on conflict do nothing`, [p.perfil.id, perfilId])
    else await db().query(`delete from foro.bloqueos where perfil_id = $1 and bloqueado_id = $2`, [p.perfil.id, perfilId])
    return { ok: true, bloqueado: quiere }
  } catch (e) {
    return fallo(e)
  }
}

// Números de la campana para la barra del foro (avisos sin leer y conversaciones con mensajes nuevos)
export async function misContadores(): Promise<{ avisos: number; mensajes: number }> {
  const s = await sesionForo()
  return s?.pendientes || { avisos: 0, mensajes: 0 }
}
