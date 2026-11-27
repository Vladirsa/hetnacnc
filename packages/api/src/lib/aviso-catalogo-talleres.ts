// Aviso a los talleres que imprimen en 3D cuando hay piezas nuevas en el catálogo de
// "Impresión 3D bajo pedido": correo con la lista y liga para poner su precio, aviso en
// su panel y, si verificaron su WhatsApp, un mensaje (pushATalleres lo manda).
// Una sola vez por taller y por campaña, en lotes diarios (cuota de correos), y respeta
// las bajas. Se apaga con AVISO_CATALOGO=off.
import { estaDeBaja, ligaBaja } from "./baja"
import { STORE_URL, VENDOR_URL, boton, esc, marco } from "./licitacion"
import { pushATalleres } from "./push"
import { sendEmail } from "./resend"

export const T_AVISO_CATALOGO = "hetna_aviso_catalogo"
const LOTE_DIA = Number(process.env.AVISO_CATALOGO_LOTE || 60)

export type CampanaCatalogo = { id: string; asunto: string; titulo: string; intro: string; piezas: { handle: string; titulo: string }[] }

// Campaña del 27 nov 2026: las 12 piezas nuevas (electrónica, Gridfinity, mecánica, carpintería y eventos)
export const CAMPANA_PIEZAS_NOV = {
  id: "piezas-3d-2026-11",
  asunto: "12 piezas nuevas para imprimir en HETNA: pon tu precio",
  titulo: "Hay 12 piezas nuevas para imprimir",
  intro:
    "Agregamos a la tienda piezas de electrónica, organización Gridfinity, mecánica, carpintería y eventos. Los clientes ya las pueden pedir; si imprimes en 3D, pon tu precio y tus días de entrega para que también te las compren a ti.",
  piezas: [
    { handle: "carcasa-raspberry-pi-impresa-3d", titulo: "Carcasa para Raspberry Pi 4 o 5" },
    { handle: "caja-proyecto-electronico-impresa-3d", titulo: "Caja para proyecto electrónico con tapa" },
    { handle: "base-gridfinity-4x3-impresa-3d", titulo: "Base Gridfinity de 4 × 3 casillas" },
    { handle: "caja-gridfinity-2x1-impresa-3d", titulo: "Caja Gridfinity de 2 × 1 con divisiones" },
    { handle: "porta-brocas-gridfinity-impreso-3d", titulo: "Porta fresas y brocas Gridfinity" },
    { handle: "polea-gt2-20-dientes-impresa-3d", titulo: "Polea GT2 de 20 dientes" },
    { handle: "acoplador-ejes-5-8-mm-impreso-3d", titulo: "Acoplador de ejes de 5 a 8 mm" },
    { handle: "plantilla-bisagra-cazoleta-impresa-3d", titulo: "Plantilla para bisagra de cazoleta" },
    { handle: "guia-jaladeras-128-mm-impresa-3d", titulo: "Guía para barrenar jaladeras" },
    { handle: "escuadra-armado-90-impresa-3d", titulo: "Escuadra de armado a 90°" },
    { handle: "base-trofeo-acrilico-impresa-3d", titulo: "Base para trofeo de acrílico" },
    { handle: "medalla-con-hueco-logo-impresa-3d", titulo: "Medalla con hueco para logo" },
  ],
} satisfies CampanaCatalogo

let lista = false
async function asegurar(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_AVISO_CATALOGO))) {
    await knex.schema.createTable(T_AVISO_CATALOGO, (t: any) => {
      t.text("seller_id").notNullable()
      t.text("campana").notNullable()
      t.timestamp("enviado_en", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.primary(["seller_id", "campana"])
    })
  }
  lista = true
}

/** ¿El taller imprime en 3D? (servicio en su perfil). Pura. */
export function imprime3D(perfil: any): boolean {
  const s: unknown[] = Array.isArray(perfil?.servicios) ? perfil.servicios : []
  return s.some((x) => /impres|3d/i.test(String(x)))
}

export function correoCatalogo(c: CampanaCatalogo, nombre?: string) {
  const lista = c.piezas.map((p) => `<li><a href="${STORE_URL}/mx/products/${encodeURIComponent(p.handle)}" style="color:#C2560A">${esc(p.titulo)}</a></li>`).join("")
  return marco(
    c.titulo,
    `<p style="color:#40403A;line-height:1.5">Hola${nombre ? ` ${esc(nombre)}` : ""}, ${esc(c.intro)}</p>
     <ul style="color:#40403A;line-height:1.7;padding-left:20px">${lista}</ul>
     <p style="color:#40403A;line-height:1.5">Cada ficha trae el archivo listo, los gramos y un precio recomendado por material. Tú decides tu precio, tus colores y tus días.</p>
     ${boton("Poner mis precios", `${VENDOR_URL}/imprimir`)}
     <p style="color:#6B675C;font-size:12px;margin-top:18px">Panel del taller → Imprimir. Si alguna pieza no la haces, simplemente no le pongas precio.</p>`
  )
}

async function pendientes(knex: any, campana: string, limite: number) {
  return (await knex("seller as s")
    .leftJoin(`${T_AVISO_CATALOGO} as a`, (j: any) => j.on("a.seller_id", "s.id").andOnVal("a.campana", campana))
    .whereNull("s.deleted_at")
    .whereNotNull("s.email")
    .whereNull("a.seller_id")
    .whereRaw(`coalesce(s.metadata->'perfil'->>'tipo_cuenta', 'taller') <> 'proveedor'`)
    .whereRaw(`coalesce((s.metadata->>'prueba')::boolean, false) = false`)
    .orderBy("s.created_at", "asc")
    .limit(limite * 4)
    .select("s.id", "s.name", "s.email", "s.metadata")) as any[]
}

/** Manda el lote de hoy de una campaña. */
export async function loteAvisoCatalogo(knex: any, logger?: any, c: CampanaCatalogo = CAMPANA_PIEZAS_NOV, limite = LOTE_DIA) {
  if (process.env.AVISO_CATALOGO === "off") return { enviados: 0, motivo: "apagado" }
  await asegurar(knex)
  const filas = await pendientes(knex, c.id, limite)
  let enviados = 0
  const avisados: string[] = []
  const marcar = (id: string) => knex(T_AVISO_CATALOGO).insert({ seller_id: id, campana: c.id }).onConflict(["seller_id", "campana"]).ignore()
  for (const f of filas) {
    if (enviados >= limite) break
    // Sólo talleres que imprimen en 3D; los demás se marcan para no revisarlos cada día
    if (!imprime3D(f.metadata?.perfil)) {
      await marcar(f.id)
      continue
    }
    const correo = String(f.email).trim().toLowerCase()
    try {
      if (await estaDeBaja(knex, correo).catch(() => false)) {
        await marcar(f.id)
        continue
      }
      const r = await sendEmail({ to: correo, bajaUrl: ligaBaja(correo), subject: c.asunto, html: correoCatalogo(c, f.name) })
      if (!r.sent) {
        if (r.configuracion || /quota|limit|429/i.test(String(r.reason || ""))) break
        continue
      }
      await marcar(f.id)
      enviados++
      avisados.push(f.id)
      await new Promise((ok) => setTimeout(ok, 700))
    } catch (e) {
      logger?.warn?.(`[aviso-catalogo] ${(e as Error).message}`)
    }
  }
  if (avisados.length) {
    // pushATalleres también manda el WhatsApp a quien lo verificó
    await pushATalleres(knex, avisados, { titulo: `${c.piezas.length} piezas nuevas para imprimir 🖨️`, cuerpo: "Pon tu precio y tus días para que los clientes también te las compren a ti.", url: "/seller/imprimir", etiqueta: c.id }, logger).catch(() => null)
  }
  return { enviados }
}
