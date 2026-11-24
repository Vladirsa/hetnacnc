// Campaña "pon tus precios" (para que funcionen los acabados con precio
// inmediato y la tarifa de doblez): a los talleres que no tienen ningún acabado
// con precio en su perfil les llega un correo, un aviso en su panel y, si
// verificaron su WhatsApp, un mensaje. Una semana después, un solo recordatorio
// a quien siga sin precios. Lotes diarios (cuota de correos) y respeta las bajas.
import { estaDeBaja, ligaBaja } from "./baja"
import { VENDOR_URL, boton, esc, marco } from "./licitacion"
import { pushATalleres } from "./push"
import { sendEmail } from "./resend"

export const T_CAMPANA_PRECIOS = "hetna_campana_precios"
const LOTE_DIA = Number(process.env.CAMPANA_PRECIOS_LOTE || 60)
const DIAS_RECORDATORIO = 7

let lista = false
async function asegurar(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_CAMPANA_PRECIOS))) {
    await knex.schema.createTable(T_CAMPANA_PRECIOS, (t: any) => {
      t.text("seller_id").primary()
      t.timestamp("enviado_en", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("recordado_en", { useTz: true }).nullable()
      t.timestamp("lleno_en", { useTz: true }).nullable()
    })
  }
  lista = true
}

/** ¿El taller ya tiene al menos un acabado con precio? */
export function tienePrecios(perfil: any): boolean {
  const a = Array.isArray(perfil?.acabados) ? perfil.acabados : []
  return a.some((x: any) => x && typeof x === "object" && String(x.precio || "").trim())
}

export function correoPrecios(nombre?: string, recordatorio = false) {
  return marco(
    recordatorio ? "¿Ya pusiste tus precios de acabados?" : "Pon tus precios y recibe primero los trabajos",
    `<p style="color:#40403A;line-height:1.5">Hola${nombre ? ` ${esc(nombre)}` : ""}, en HETNA los clientes ya pueden agregar <b>acabados</b> (pintura electrostática, doblez, roscado, grabado…) a su pieza y ver el precio al momento.</p>
     <p style="color:#40403A;line-height:1.5">Marca en tu perfil los acabados que haces y pon tu <b>precio por pieza</b> (o por doblez). Así:</p>
     <ul style="color:#40403A;line-height:1.6;padding-left:20px">
       <li>las solicitudes que piden esos acabados <b>te llegan primero</b>;</li>
       <li>los clientes los ven en tu perfil con tu precio;</li>
       <li>el precio de referencia que ve el cliente sale de lo que ponen los talleres como tú.</li>
     </ul>
     ${boton("Poner mis precios", `${VENDOR_URL}/perfil-taller`)}
     <p style="color:#6B675C;font-size:12px;margin-top:18px">Toma 2 minutos: Perfil del taller → "Acabados que haces". Si tienes máquina libre esta semana, avísalo en tu panel y también te llegan antes las solicitudes.</p>`
  )
}

/** Talleres sin precios a los que toca escribirles hoy (nuevos y recordatorios). */
async function pendientes(knex: any, limite: number) {
  const filas = (await knex("seller as s")
    .leftJoin(`${T_CAMPANA_PRECIOS} as c`, "c.seller_id", "s.id")
    .whereNull("s.deleted_at")
    .whereNotNull("s.email")
    .whereRaw(`coalesce(s.metadata->'perfil'->>'tipo_cuenta', 'taller') <> 'proveedor'`)
    .whereRaw(`coalesce((s.metadata->>'prueba')::boolean, false) = false`)
    .where((w: any) =>
      w.whereNull("c.seller_id").orWhere((x: any) => x.whereNull("c.recordado_en").whereNull("c.lleno_en").where("c.enviado_en", "<", new Date(Date.now() - DIAS_RECORDATORIO * 86_400_000)))
    )
    .orderBy("s.created_at", "asc")
    .limit(limite * 3)
    .select("s.id", "s.name", "s.email", "s.metadata", "c.seller_id as ya")) as any[]
  return filas
}

/** Manda el lote de hoy. */
export async function loteCampanaPrecios(knex: any, logger?: any, limite = LOTE_DIA) {
  if (process.env.CAMPANA_PRECIOS === "off") return { enviados: 0, recordatorios: 0, motivo: "apagada" }
  await asegurar(knex)
  const filas = await pendientes(knex, limite)
  let enviados = 0
  let recordatorios = 0
  const avisados: string[] = []
  for (const f of filas) {
    if (enviados + recordatorios >= limite) break
    const perfil = f.metadata?.perfil
    if (tienePrecios(perfil)) {
      // Ya los puso (solo o por la campaña): no se le escribe
      await knex(T_CAMPANA_PRECIOS).insert({ seller_id: f.id, lleno_en: new Date() }).onConflict("seller_id").merge({ lleno_en: new Date() })
      continue
    }
    const correo = String(f.email).trim().toLowerCase()
    const recordatorio = Boolean(f.ya)
    try {
      if (await estaDeBaja(knex, correo).catch(() => false)) {
        await knex(T_CAMPANA_PRECIOS).insert({ seller_id: f.id, recordado_en: new Date() }).onConflict("seller_id").merge({ recordado_en: new Date() })
        continue
      }
      const r = await sendEmail({
        to: correo,
        bajaUrl: ligaBaja(correo),
        subject: recordatorio ? "Recordatorio: pon tus precios de acabados en HETNA" : "Pon tus precios de acabados y recibe primero los trabajos",
        html: correoPrecios(f.name, recordatorio),
      })
      if (!r.sent) {
        if (r.configuracion || /quota|limit|429/i.test(String(r.reason || ""))) break
        continue
      }
      if (recordatorio) {
        await knex(T_CAMPANA_PRECIOS).where({ seller_id: f.id }).update({ recordado_en: new Date() })
        recordatorios++
      } else {
        await knex(T_CAMPANA_PRECIOS).insert({ seller_id: f.id }).onConflict("seller_id").ignore()
        enviados++
      }
      avisados.push(f.id)
      await new Promise((ok) => setTimeout(ok, 700))
    } catch (e) {
      logger?.warn?.(`[campana-precios] ${(e as Error).message}`)
    }
  }
  if (avisados.length) {
    const aviso = { titulo: "Pon tus precios de acabados 💲", cuerpo: "Las solicitudes que piden tus acabados te llegan primero. Toma 2 minutos.", url: "/seller/perfil-taller" }
    // pushATalleres también manda el WhatsApp (verificado)
    await pushATalleres(knex, avisados, { ...aviso, etiqueta: "campana-precios" }, logger).catch(() => null)
  }
  return { enviados, recordatorios }
}

/** Para el panel: cuántos talleres tienen precios y cómo va la campaña. */
export async function resumenCampanaPrecios(knex: any) {
  await asegurar(knex)
  const talleres = (await knex("seller")
    .whereNull("deleted_at")
    .whereRaw(`coalesce(metadata->'perfil'->>'tipo_cuenta', 'taller') <> 'proveedor'`)
    .select("metadata")) as any[]
  const conPrecios = talleres.filter((t) => tienePrecios(t.metadata?.perfil)).length
  const c = await knex(T_CAMPANA_PRECIOS)
    .select(knex.raw("count(*) as enviados"), knex.raw("count(recordado_en) as recordados"), knex.raw("count(lleno_en) as llenaron"))
    .first()
  return { talleres: talleres.length, con_precios: conPrecios, enviados: Number(c?.enviados || 0), recordados: Number(c?.recordados || 0), llenaron: Number(c?.llenaron || 0) }
}
