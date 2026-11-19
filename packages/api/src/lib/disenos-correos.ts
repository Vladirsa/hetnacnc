// Marketing automático de las herramientas de diseño (muebles, cocina, molduras).
// Cada diseño guardado o crédito gastado es un cliente interesado: se le da
// seguimiento solo, sin que nadie lo haga a mano.
//
//   diseno_espera   guardó un diseño hace 3 a 7 días y no ha bajado nada desde
//                   entonces: "tu diseño te espera" con la liga para abrirlo.
//   regalo_sin_usar recibió los créditos de bienvenida hace 4 a 10 días y no ha
//                   gastado ninguno: "tienes N créditos para diseñar".
//   creditos_bajos  gastó créditos en los últimos 3 días y le queda 1 o ninguno:
//                   "recarga" con el paquete más barato (máximo uno cada 14 días).
//
// Mismas reglas que lib/marketing-correos.ts: nunca a quien se dio de baja, liga
// de baja en cada correo, máximo un correo de marketing por persona cada 4 días,
// tope diario compartido (MARKETING_MAX_DIA) y cada correo una sola vez por su
// referencia (tabla hetna_correo_promo). DISENOS_CORREOS=off los apaga.
//
// n8n: si N8N_DISENOS_URL existe, cada evento (diseño guardado, correo enviado)
// se manda ahí para que el CRM lo registre (header x-hetna-secreto con
// N8N_PROSPECTOS_SECRETO si existe).
import { ligaBaja, T_BAJA } from "./baja"
import { STORE_URL, boton, esc, marco } from "./licitacion"
import { T_PROMO, asegurarTablaPromo } from "./marketing-correos"
import { PAQUETES } from "./creditos-compra"
import { sendEmail } from "./resend"

export type TipoDiseno = "diseno_espera" | "regalo_sin_usar" | "creditos_bajos"
export const disenosCorreosApagados = () => (process.env.DISENOS_CORREOS || "").toLowerCase() === "off"
const maxDia = () => Math.max(0, Number(process.env.MARKETING_MAX_DIA) || 80)
const DIAS_ENTRE_CORREOS = 4
const dias = (n: number) => new Date(Date.now() - n * 864e5)

export async function avisarN8n(evento: string, datos: Record<string, unknown>) {
  const url = process.env.N8N_DISENOS_URL
  if (!url) return
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.N8N_PROSPECTOS_SECRETO ? { "x-hetna-secreto": process.env.N8N_PROSPECTOS_SECRETO } : {}) },
      body: JSON.stringify({ evento, ...datos, cuando: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // n8n caído: el correo y la herramienta siguen igual
  }
}

const utm = (url: string, tipo: string) => `${url}${url.includes("?") ? "&" : "?"}utm_source=correo&utm_medium=email&utm_campaign=${tipo}`
const p = (t: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.6">${t}</p>`
const saludo = (n?: string | null) => (n ? `Hola ${esc(n)},` : "Hola,")
const herramientaUrl = (h: string) => `${STORE_URL}/mx/disenar/${h === "cocina" ? "despiece-muebles" : "muebles-ensamble"}`

export function correoDiseno(tipo: TipoDiseno, d: { nombre?: string | null; diseno?: string; herramienta?: string; saldo?: number }): { asunto: string; html: string } {
  const prueba = PAQUETES.reduce((a, b) => (b.precio < a.precio ? b : a))
  switch (tipo) {
    case "diseno_espera":
      return {
        asunto: `Tu diseño «${(d.diseno || "mueble").slice(0, 40)}» te espera`,
        html: marco(
          "Tu diseño está guardado",
          p(`${saludo(d.nombre)} guardaste <b>${esc(d.diseno || "tu diseño")}</b> en HETNA. Ábrelo cuando quieras para ajustar medidas, sacar el presupuesto para tu cliente o bajar los archivos para fabricar.`) +
            p("Desde ahí también puedes mandarlo al cotizador con tus tarifas o directo al CAM de tu router.") +
            boton("Abrir mi diseño", utm(herramientaUrl(d.herramienta || "mueble"), tipo)) +
            p(`¿No tienes máquina? <a href="${esc(utm(`${STORE_URL}/mx/cotizar`, tipo))}" style="color:#C2560A">Un taller de HETNA te lo fabrica</a>.`)
        ),
      }
    case "regalo_sin_usar":
      return {
        asunto: `Tienes ${d.saldo ?? 5} créditos para diseñar tus muebles`,
        html: marco(
          "Tus créditos de regalo te esperan",
          p(`${saludo(d.nombre)} al abrir tu cuenta te regalamos <b>${d.saldo ?? 5} créditos</b>. Alcanzan para bajar los archivos de varios muebles o de una cocina completa, listos para tu CNC.`) +
            `<ol style="margin:0 0 12px;padding-left:20px;color:#40403A;line-height:1.6">` +
            `<li>Sube la foto de un mueble o elige uno del catálogo.</li>` +
            `<li>Ajusta medidas, uniones y herrajes en 3D (gratis).</li>` +
            `<li>Baja planos, etiquetas y archivos para cortar.</li>` +
            `</ol>` +
            boton("Diseñar un mueble", utm(herramientaUrl("mueble"), tipo)) +
            p(`¿Haces cocinas integrales? <a href="${esc(utm(herramientaUrl("cocina"), tipo))}" style="color:#C2560A">Arma una cocina en L o en U</a> con esquineros, ventanas y electrodomésticos.`)
        ),
      }
    case "creditos_bajos":
      return {
        asunto: d.saldo ? `Te queda ${d.saldo} crédito para tus diseños` : "Te quedaste sin créditos para tus diseños",
        html: marco(
          "Recarga tus créditos",
          p(`${saludo(d.nombre)} ${d.saldo ? `te queda <b>${d.saldo} crédito</b>` : "ya usaste todos tus créditos"}. Diseñar, editar y cotizar sigue siendo gratis; los créditos son para bajar los archivos para fabricar.`) +
            p(`El paquete más chico: <b>${prueba.creditos} créditos por $${prueba.precio}</b>. Los paquetes grandes salen más baratos por crédito y no caducan.`) +
            boton("Comprar créditos", utm(`${STORE_URL}/mx/user/creditos`, tipo))
        ),
      }
  }
}

type Candidato = { customer_id: string; correo: string; nombre: string | null; ref: string; diseno?: string; herramienta?: string; saldo?: number }

export async function candidatosDiseno(knex: any, tipo: TipoDiseno): Promise<Candidato[]> {
  const sinBaja = `not exists (select 1 from ${T_BAJA} b where b.correo = lower(c.email))`
  if (tipo === "diseno_espera") {
    if (!(await knex.schema.hasTable("hetna_disenos"))) return []
    const { rows } = await knex.raw(
      `select distinct on (d.customer_id) d.customer_id, c.email as correo, c.first_name as nombre, d.id as ref, d.nombre as diseno, d.herramienta
       from hetna_disenos d join customer c on c.id = d.customer_id and c.deleted_at is null
       where d.actualizado between ? and ? and ${sinBaja}
         and not exists (select 1 from credit_ledger_entry l where l.customer_id = d.customer_id and l.type = 'consumo' and l.created_at >= d.actualizado and l.deleted_at is null)
       order by d.customer_id, d.actualizado desc`,
      [dias(7), dias(3)]
    )
    return rows
  }
  if (tipo === "regalo_sin_usar") {
    const { rows } = await knex.raw(
      `select l.customer_id, c.email as correo, c.first_name as nombre, l.reference_id as ref, coalesce(b.balance, 0) as saldo
       from credit_ledger_entry l join customer c on c.id = l.customer_id and c.deleted_at is null
       left join credit_balance b on b.customer_id = l.customer_id and b.deleted_at is null
       where l.reference_id like 'bienvenida:%' and l.deleted_at is null and l.created_at between ? and ? and ${sinBaja}
         and not exists (select 1 from credit_ledger_entry x where x.customer_id = l.customer_id and x.type = 'consumo' and x.deleted_at is null)
         and coalesce(b.balance, 0) > 0`,
      [dias(10), dias(4)]
    )
    return rows.map((r: any) => ({ ...r, saldo: Number(r.saldo) }))
  }
  // creditos_bajos: una referencia por quincena para no repetirlo cada día
  const quincena = `${new Date().getUTCFullYear()}-${Math.floor((Date.now() / 864e5) / 14)}`
  const { rows } = await knex.raw(
    `select b.customer_id, c.email as correo, c.first_name as nombre, b.balance as saldo
     from credit_balance b join customer c on c.id = b.customer_id and c.deleted_at is null
     where b.deleted_at is null and b.balance <= 1 and ${sinBaja}
       and exists (select 1 from credit_ledger_entry l where l.customer_id = b.customer_id and l.type = 'consumo' and l.created_at >= ? and l.deleted_at is null)`,
    [dias(3)]
  )
  return rows.map((r: any) => ({ ...r, saldo: Number(r.saldo), ref: `bajos:${r.customer_id}:${quincena}` }))
}

export async function correrCorreosDiseno(knex: any, logger: any, o: { simular?: boolean } = {}) {
  await asegurarTablaPromo(knex)
  const r: Record<TipoDiseno, number> & { omitidos: number } = { diseno_espera: 0, regalo_sin_usar: 0, creditos_bajos: 0, omitidos: 0 }
  const hoy = new Date()
  hoy.setUTCHours(0, 0, 0, 0)
  const [{ n }] = (await knex(T_PROMO).where("created_at", ">=", hoy).count("* as n")) as any
  let presupuesto = maxDia() - Number(n)
  // lo más cerca de una venta primero: quien ya diseñó, luego quien se quedó sin créditos
  for (const tipo of ["diseno_espera", "creditos_bajos", "regalo_sin_usar"] as TipoDiseno[]) {
    for (const c of await candidatosDiseno(knex, tipo)) {
      if (presupuesto <= 0) return r
      const correo = String(c.correo || "").trim().toLowerCase()
      if (!correo) continue
      if (await knex(T_PROMO).where({ tipo, ref: c.ref, correo }).first()) continue
      if (await knex(T_PROMO).where({ correo }).where("created_at", ">=", dias(DIAS_ENTRE_CORREOS)).first()) {
        r.omitidos++
        continue
      }
      const { asunto, html } = correoDiseno(tipo, c)
      if (o.simular) {
        r[tipo]++
        presupuesto--
        continue
      }
      const env = await sendEmail({ to: correo, subject: asunto, html, bajaUrl: ligaBaja(correo) })
      if (!env.sent) {
        logger.warn(`[disenos-correos] ${tipo} a ${correo} no enviado: ${env.reason}`)
        if (env.configuracion) return r
        continue
      }
      await knex(T_PROMO).insert({ correo, tipo, ref: c.ref }).onConflict(["tipo", "ref", "correo"]).ignore()
      await avisarN8n(`correo_${tipo}`, { customer_id: c.customer_id, email: correo, nombre: c.nombre, diseno: c.diseno || null, saldo: c.saldo ?? null })
      r[tipo]++
      presupuesto--
    }
  }
  return r
}
