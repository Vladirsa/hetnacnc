import { Pool } from "pg"

import { estaDeBaja, ligaBaja } from "./baja"
import { STORE_URL, boton, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"

// Correos del foro: los avisos de la campana que nadie ha leído, el
// recordatorio de los eventos y el resumen semanal.
//
// El foro vive en otra base (HETNA_FORO_DB, la misma de apps/storefront/src/
// lib/foro/db.ts y de lib/foro-actividad.ts). La tienda sólo escribe en
// foro.avisos; aquí se juntan y se mandan, uno por persona y por corrida,
// para que diez respuestas no sean diez correos.
//
// El correo de cada persona sale de su cuenta de cliente (perfiles.cliente_id
// -> customer.email). Quien se dio de baja (lib/baja.ts) no recibe nada del
// foro; cada correo lleva su liga para darse de baja.
//
// Todo degrada: sin base del foro, sin la migración del 31 de octubre o sin
// Resend, los trabajos no hacen nada y lo dicen una sola vez en el registro.

const g = globalThis as unknown as { __hetnaForoCorreos?: Pool }
const urlForo = () => process.env.HETNA_FORO_DB || process.env.HETNA_TALLER_DB || ""

export const foroCorreosListo = () => Boolean(urlForo() && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)

const pool = (): Pool => {
  if (!g.__hetnaForoCorreos) {
    g.__hetnaForoCorreos = new Pool({ connectionString: urlForo(), max: 2, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 })
    g.__hetnaForoCorreos.on("error", (e) => console.error("[foro correos] base", e.message))
  }
  return g.__hetnaForoCorreos
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))
const liga = (ruta: string) => `${STORE_URL}/mx${ruta || "/foro-cnc"}`
const AJUSTES = `${STORE_URL}/mx/foro-cnc/mi-perfil#avisos`
const pie = `<p style="margin:18px 0 0;font-size:12px;color:#888">Cambia cuándo te llegan estos correos en <a href="${AJUSTES}" style="color:#888">tu perfil del foro</a>.</p>`

type Fila = Record<string, any>

// Correo de cada cliente, saltando a quien se dio de baja
async function correosDe(knex: any, clienteIds: string[]): Promise<Map<string, string>> {
  if (!clienteIds.length) return new Map()
  const filas = (await knex("customer").whereIn("id", clienteIds).whereNull("deleted_at").select("id", "email")) as {
    id: string
    email: string | null
  }[]
  const mapa = new Map<string, string>()
  for (const f of filas) {
    if (f.email && !(await estaDeBaja(knex, f.email))) mapa.set(f.id, f.email)
  }
  return mapa
}

// ---------------------------------------------------------------------
// Avisos sin leer, agrupados por persona
// ---------------------------------------------------------------------

// modo "al_momento": cada 10 minutos, avisos con al menos 5 minutos sin leer
// (si la persona está en el sitio, los ve en la campana y no hace falta correo).
// modo "diario": una vez al día, lo de las últimas 24 horas.
export async function mandarAvisos(knex: any, modo: "al_momento" | "diario", logger: any): Promise<number> {
  const { rows } = await pool().query(
    `select v.id, v.perfil_id, v.texto, v.url, v.creado, p.cliente_id, p.nombre
     from foro.avisos v join foro.perfiles p on p.id = v.perfil_id
     where v.correo_at is null and not v.leido and p.suspendido = false and p.correo_avisos = $1
       and v.creado > now() - interval '3 days'
       and ($1 = 'diario' or v.creado < now() - interval '5 minutes')
     order by v.creado desc limit 2000`,
    [modo]
  )
  // Los avisos de quien pidió "nunca" no se mandan: se marcan para no revisarlos otra vez
  await pool().query(
    `update foro.avisos v set correo_at = now() from foro.perfiles p
     where p.id = v.perfil_id and v.correo_at is null and p.correo_avisos = 'nunca'`
  )
  if (!rows.length) return 0

  const porPerfil = new Map<string, Fila[]>()
  for (const f of rows) porPerfil.set(f.perfil_id, [...(porPerfil.get(f.perfil_id) || []), f])
  const correos = await correosDe(knex, Array.from(new Set(rows.map((f: Fila) => f.cliente_id))))

  let enviados = 0
  for (const [perfilId, lista] of porPerfil) {
    const ids = lista.map((f) => f.id)
    const para = correos.get(lista[0].cliente_id)
    if (para) {
      const asunto = lista.length === 1 ? lista[0].texto : `${lista.length} novedades en el Foro CNC`
      const items = lista
        .slice(0, 15)
        .map(
          (f) =>
            `<li style="margin:0 0 10px"><a href="${esc(liga(f.url))}" style="color:#142033;text-decoration:none;font-weight:bold">${esc(f.texto)}</a></li>`
        )
        .join("")
      const mas = lista.length > 15 ? `<p style="margin:0;color:#6B6A63">Y ${lista.length - 15} más.</p>` : ""
      const html = marco(
        modo === "diario" ? "Tu resumen del día en el Foro CNC" : "Novedades en el Foro CNC",
        `<p style="margin:0 0 12px;color:#44433D">Hola ${esc(lista[0].nombre)}:</p>
         <ul style="margin:0 0 6px;padding-left:18px;color:#142033">${items}</ul>${mas}
         ${boton("Ver mis avisos", liga("/foro-cnc/avisos"))}${pie}`
      )
      const r = await sendEmail({ to: para, subject: asunto.slice(0, 120), html, bajaUrl: ligaBaja(para) })
      if (r.configuracion) {
        logger.warn(`[foro correos] Resend rechazó el envío por configuración: ${r.reason}`)
        return enviados
      }
      if (r.sent) enviados++
      else logger.warn(`[foro correos] no salió el correo de ${perfilId}: ${r.reason}`)
      await pausa(600) // Resend acepta pocas por segundo
    }
    // Con o sin correo (dado de baja, sin cuenta), ya no se vuelven a revisar
    await pool().query(`update foro.avisos set correo_at = now() where id = any($1::bigint[])`, [ids])
  }
  return enviados
}

// ---------------------------------------------------------------------
// Recordatorio de eventos: un aviso a quienes confirmaron, un día antes
// ---------------------------------------------------------------------

export async function recordarEventos(): Promise<number> {
  // Eventos que empiezan mañana (hora de México)
  const { rows } = await pool().query(
    `select t.id, t.titulo, t.slug, s.slug as seccion, t.evento ->> 'inicio' as inicio
     from foro.temas t join foro.secciones s on s.id = t.seccion_id
     where t.tipo = 'evento' and t.estado = 'publicado' and t.evento is not null
       and left(t.evento ->> 'inicio', 10) = to_char((now() at time zone 'America/Mexico_City') + interval '1 day', 'YYYY-MM-DD')`
  )
  let n = 0
  for (const e of rows) {
    const hora = String(e.inicio).slice(11, 16)
    const r = await pool().query(
      `insert into foro.avisos (perfil_id, tipo, texto, url)
       select x.perfil_id, 'evento', $2, $3 from foro.asistencias x
       where x.tema_id = $1
         and not exists (select 1 from foro.avisos v where v.perfil_id = x.perfil_id and v.tipo = 'evento' and v.url = $3
           and v.creado > now() - interval '2 days')`,
      [e.id, `Mañana a las ${hora} h: “${String(e.titulo).slice(0, 200)}”`, `/foro-cnc/${e.seccion}/${e.slug}`]
    )
    n += r.rowCount || 0
  }
  return n
}

// ---------------------------------------------------------------------
// Resumen semanal: lo mejor de la semana en lo que sigue, preguntas que puede
// responder, vacantes y eventos próximos. Sólo a quien tuvo actividad en los
// últimos 120 días, para no mandarle a cuentas abandonadas.
// ---------------------------------------------------------------------

const tema = (f: Fila) =>
  `<li style="margin:0 0 8px"><a href="${esc(liga(`/foro-cnc/${f.seccion}/${f.slug}`))}" style="color:#142033;font-weight:bold;text-decoration:none">${esc(f.titulo)}</a>` +
  `<span style="color:#6B6A63"> · ${esc(f.s_nombre)}${f.respuestas !== undefined ? ` · ${f.respuestas} respuestas` : ""}</span></li>`

const bloque = (titulo: string, filas: Fila[]) =>
  filas.length ? `<h3 style="margin:18px 0 8px;font-size:15px;color:#142033">${esc(titulo)}</h3><ul style="margin:0;padding-left:18px">${filas.map(tema).join("")}</ul>` : ""

export async function mandarResumenSemanal(knex: any, logger: any): Promise<number> {
  const { rows: personas } = await pool().query(
    `select p.id, p.cliente_id, p.nombre from foro.perfiles p
     where p.suspendido = false and p.resumen_semanal = true
       and (p.actualizado > now() - interval '120 days'
         or exists (select 1 from foro.respuestas r where r.autor_id = p.id and r.creado > now() - interval '120 days')
         or exists (select 1 from foro.temas t where t.autor_id = p.id and t.creado > now() - interval '120 days'))
     limit 5000`
  )
  if (!personas.length) return 0

  // Lo común a todos: vacantes y eventos de la semana
  const [vacantes, eventos] = await Promise.all([
    pool().query(
      `select t.titulo, t.slug, s.slug as seccion, s.nombre as s_nombre from foro.temas t join foro.secciones s on s.id = t.seccion_id
       where t.tipo = 'vacante' and t.estado = 'publicado' and t.creado > now() - interval '7 days' order by t.creado desc limit 4`
    ),
    pool().query(
      `select t.titulo, t.slug, s.slug as seccion, s.nombre as s_nombre from foro.temas t join foro.secciones s on s.id = t.seccion_id
       where t.tipo = 'evento' and t.estado = 'publicado' and t.evento is not null
         and t.evento ->> 'inicio' >= to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM-DD"T"HH24:MI')
       order by t.evento ->> 'inicio' limit 3`
    ),
  ])
  const correos = await correosDe(knex, personas.map((p: Fila) => p.cliente_id))
  let enviados = 0

  for (const p of personas) {
    const para = correos.get(p.cliente_id)
    if (!para) continue
    // Lo mejor de la semana en lo que sigue (personas, talleres y comunidades);
    // si no sigue nada, lo mejor de todo el foro.
    const [mejores, paraTi] = await Promise.all([
      pool().query(
        `select t.titulo, t.slug, t.respuestas, s.slug as seccion, s.nombre as s_nombre
         from foro.temas t join foro.secciones s on s.id = t.seccion_id join foro.perfiles a on a.id = t.autor_id
         where t.estado = 'publicado' and t.creado > now() - interval '7 days' and t.autor_id <> $1
           and (not exists (select 1 from foro.seguimientos g where g.seguidor_id = $1)
             or t.autor_id in (select substr(objetivo, 3)::uuid from foro.seguimientos where seguidor_id = $1 and objetivo like 'p:%')
             or a.vendedor_id in (select substr(objetivo, 3) from foro.seguimientos where seguidor_id = $1 and objetivo like 't:%')
             or s.slug in (select substr(objetivo, 3) from foro.seguimientos where seguidor_id = $1 and objetivo like 's:%'))
         order by t.votos * 3 + t.respuestas * 2 + ln(1 + t.vistas) desc limit 5`,
        [p.id]
      ),
      pool().query(
        `select t.titulo, t.slug, t.respuestas, s.slug as seccion, s.nombre as s_nombre
         from foro.temas t join foro.secciones s on s.id = t.seccion_id
         where t.estado = 'publicado' and t.tipo in ('pregunta', 'busco') and t.mejor_respuesta_id is null
           and t.respuestas < 2 and t.autor_id <> $1 and t.creado > now() - interval '14 days'
           and exists (select 1 from foro.seguimientos g where g.seguidor_id = $1 and g.objetivo = 's:' || s.slug)
         order by t.creado desc limit 3`,
        [p.id]
      ),
    ])
    const cuerpo =
      bloque("Lo mejor de tu red esta semana", mejores.rows) +
      bloque("Preguntas que puedes responder", paraTi.rows) +
      bloque("Vacantes nuevas", vacantes.rows) +
      bloque("Próximos eventos", eventos.rows)
    if (!cuerpo) continue // semana sin nada que contarle: no se manda un correo vacío

    const html = marco(
      "Tu semana en el Foro CNC",
      `<p style="margin:0;color:#44433D">Hola ${esc(p.nombre)}, esto pasó en la comunidad CNC de México:</p>${cuerpo}
       ${boton("Ir a mi red", liga("/foro-cnc/red"))}${pie}`
    )
    const r = await sendEmail({ to: para, subject: "Tu semana en el Foro CNC", html, bajaUrl: ligaBaja(para) })
    if (r.configuracion) {
      logger.warn(`[foro correos] Resend rechazó el envío por configuración: ${r.reason}`)
      return enviados
    }
    if (r.sent) enviados++
    await pausa(600)
  }
  return enviados
}

// Sin la migración del 31 de octubre (o sin la base) se avisa una vez y se calla
let avisado = false
export function errorForo(logger: any, e: unknown, trabajo: string) {
  const code = (e as { code?: string }).code
  if (code === "42P01" || code === "42703" || code === "3F000") {
    if (!avisado) logger.warn(`[${trabajo}] falta correr infra/foro/migracion-2026-10-31-avisos.sql en la base del foro`)
    avisado = true
    return
  }
  logger.error(`[${trabajo}] ${(e as Error).message}`)
}
