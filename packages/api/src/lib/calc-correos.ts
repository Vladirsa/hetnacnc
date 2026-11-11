// Correos de seguimiento para quien pidió sus parámetros por correo en la
// Calculadora CNC y marcó "quiero recibir consejos y ofertas".
//
//   calc_consejo  a los 3–6 días: tres consejos para su proceso y la liga a
//                 las herramientas gratis (calculadora, CAM Studio).
//   calc_app      a los 7–14 días: la app para talleres, con 14 días gratis.
//
// Sólo a quien dio permiso (la casilla, que viene desmarcada). Comparten con
// el resto del marketing el registro de envíos (cada uno una sola vez), la
// lista de bajas y el tope diario; además, un correo de esta serie por
// persona cada 3 días. CALC_SERIE=off los apaga.
import { ligaBaja, T_BAJA } from "./baja"
import { T_CALC_LEAD } from "./calculadora-envio"
import { PLANES_COTIZADOR } from "./cotizador-suscripciones"
import { boton, marco, STORE_URL } from "./licitacion"
import { asegurarTablaPromo, T_PROMO } from "./marketing-correos"
import { sendEmail } from "./resend"

export const TIPOS_CORREO_CALC = ["calc_consejo", "calc_app"] as const
export type TipoCorreoCalc = (typeof TIPOS_CORREO_CALC)[number]
const DIAS_ENTRE_CORREOS = 3
const maxDia = () => Math.max(0, Number(process.env.MARKETING_MAX_DIA) || 80)
export const serieCalcApagada = () => (process.env.CALC_SERIE || "").toLowerCase() === "off"

const p = (t: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">${t}</p>`
const lista = (items: string[]) => `<ul style="margin:0 0 12px;padding-left:20px;color:#40403A;line-height:1.6">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`
const liga = (tipo: TipoCorreoCalc, ruta: string) => `${STORE_URL}${ruta}${ruta.includes("?") ? "&" : "?"}utm_source=correo&utm_medium=automatico&utm_campaign=${tipo}`

const CONSEJOS: Record<string, { titulo: string; items: string[] }> = {
  router: {
    titulo: "router CNC",
    items: [
      "<b>Si la madera se quema o el plástico se funde</b>, la fresa está rozando: sube el avance o baja las RPM antes de bajar la profundidad.",
      "<b>Acorta lo que sale del collet</b>: con la mitad de voladizo la fresa se flexiona ocho veces menos y puedes cortar más profundo.",
      "<b>Para tableros con laminado</b> (melamina, MDF enchapado) usa fresa de compresión y que la primera pasada pase la parte ascendente.",
    ],
  },
  laser_co2: {
    titulo: "láser CO₂",
    items: [
      "<b>Limpia lente y espejos cada semana</b>: con polvo el tubo pierde potencia real y terminas subiendo la corriente, que lo desgasta.",
      "<b>Haz una matriz de prueba</b> (velocidad × potencia) en cada lote de material: el acrílico y el triplay cambian de proveedor a proveedor.",
      "<b>Nunca cortes PVC ni vinil</b>: sueltan cloro que corroe la máquina y daña tus pulmones.",
    ],
  },
  fibra: {
    titulo: "marcado con fibra",
    items: [
      "<b>Para negro en inoxidable</b> necesitas fuente MOPA: con Q-switch sólo sale un gris oscuro.",
      "<b>Una matriz de 5 × 5 cuadros</b> en un retazo te ahorra horas de prueba y error con cada metal.",
      "<b>Usa lentes certificados para 1064 nm</b>: el reflejo en el metal daña la vista sin que lo sientas.",
    ],
  },
  fibra_corte: {
    titulo: "corte por fibra",
    items: [
      "<b>En lámina delgada</b>, nitrógeno o aire a alta presión corren más rápido que el oxígeno y dejan el canto sin óxido.",
      "<b>Revisa la boquilla y la ventana de protección</b> cada turno: una ventana sucia baja la potencia en la pieza.",
      "<b>Perfora fuera de la pieza</b> en lámina gruesa y entra con una línea de entrada: el canto sale limpio.",
    ],
  },
  plasma: {
    titulo: "plasma CNC",
    items: [
      "<b>Lee la escoria</b>: bolitas abajo que se caen = vas lento; escoria dura pegada = vas rápido.",
      "<b>Aire seco y sin aceite</b>: con humedad los consumibles duran la mitad.",
      "<b>Cambia el electrodo</b> cuando el hueco pase de 1 mm: después de eso el corte se abre y gastas más boquillas.",
    ],
  },
  impresion3d: {
    titulo: "impresión 3D",
    items: [
      "<b>Seca el filamento</b> si truena o sale con burbujas: el PETG, el nylon y el TPU absorben humedad en días.",
      "<b>El límite real es el flujo del hotend</b>, no la velocidad de los ejes: capas más gruesas van a menos mm/s.",
      "<b>Para cotizar</b>, suma luz, desgaste y fallas: el material casi nunca es lo más caro de la pieza.",
    ],
  },
}

export function correoCalc(tipo: TipoCorreoCalc, proceso: string): { asunto: string; html: string } {
  if (tipo === "calc_consejo") {
    const c = CONSEJOS[proceso] || CONSEJOS.router
    return {
      asunto: `3 consejos para tu ${c.titulo}`,
      html: marco(
        `Tres consejos para tu ${c.titulo}`,
        p("Hace unos días calculaste tus parámetros en la Calculadora CNC de HETNA. Esto es lo que más tiempo y material ahorra en los talleres:") +
          lista(c.items) +
          p("Cuando quieras pasar de los parámetros al programa, el CAM Studio arma el G-code de tu DXF gratis (5 programas al mes).") +
          boton("Abrir la calculadora", liga("calc_consejo", "/mx/calculadora-cnc")) +
          `<p style="margin:12px 0 0"><a href="${liga("calc_consejo", "/mx/cam/subir")}" style="color:#C2560A;font-weight:bold">Probar el CAM Studio</a></p>`
      ),
    }
  }
  const precio = `$${PLANES_COTIZADOR.taller.precio.toLocaleString("es-MX")}`
  return {
    asunto: "Del tiempo de máquina al precio, sin hojas de cálculo",
    html: marco(
      "Cotiza tus trabajos CNC en minutos",
      p("La calculadora te da el tiempo de máquina. La app HETNA CNC para talleres lo convierte en precio con tus costos reales:") +
        lista([
          "<b>Cotizaciones profesionales</b> con tu logo, listas para mandar por WhatsApp",
          "<b>Sube el DXF, STL u OBJ</b> y la cotización lleva el plano con medidas",
          "<b>Costos de tu taller</b> (renta, luz, máquinas) para saber tu precio mínimo",
          "<b>Seguimiento</b> de anticipos y avances",
        ]) +
        p(`<b>14 días gratis</b> con todo abierto; después, plan Gratis o Taller desde ${precio} al mes.`) +
        boton("Probar 14 días gratis", liga("calc_app", "/mx/servicios/cotizador-cnc"))
    ),
  }
}

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000)

export type CandidatoCalc = { tipo: TipoCorreoCalc; correo: string; proceso: string }

/** Quien dio permiso, con su primer pedido en la ventana de cada correo. */
export async function candidatosCalc(knex: any): Promise<CandidatoCalc[]> {
  if (!(await knex.schema.hasTable(T_CALC_LEAD))) return []
  const filas: { correo: string; primero: Date; proceso: string }[] = await knex(T_CALC_LEAD)
    .where({ acepta_marketing: true })
    .groupBy("correo")
    .select("correo", knex.raw("min(created_at) as primero"), knex.raw("(array_agg(proceso order by created_at desc))[1] as proceso"))
  const out: CandidatoCalc[] = []
  for (const f of filas) {
    const t = new Date(f.primero).getTime()
    if (t <= hace(3).getTime() && t >= hace(6).getTime()) out.push({ tipo: "calc_consejo", correo: f.correo, proceso: f.proceso })
    if (t <= hace(7).getTime() && t >= hace(14).getTime()) out.push({ tipo: "calc_app", correo: f.correo, proceso: f.proceso })
  }
  return out
}

export type ResumenCalc = Record<TipoCorreoCalc, number> & { presupuesto: number; omitidos: number; detalle: string[] }

export async function correrSerieCalc(knex: any, logger: any, o: { simular?: boolean } = {}): Promise<ResumenCalc> {
  const r: ResumenCalc = { calc_consejo: 0, calc_app: 0, presupuesto: 0, omitidos: 0, detalle: [] }
  await asegurarTablaPromo(knex)
  const hoy = new Date()
  hoy.setUTCHours(0, 0, 0, 0)
  const [{ n }] = (await knex(T_PROMO).where("created_at", ">=", hoy).count("* as n")) as any
  let presupuesto = maxDia() - Number(n)
  r.presupuesto = presupuesto
  if (presupuesto <= 0) return r
  const tocados = new Set<string>()
  for (const c of await candidatosCalc(knex)) {
    if (presupuesto <= 0) break
    const correo = c.correo.trim().toLowerCase()
    if (tocados.has(correo)) {
      r.omitidos++
      continue
    }
    if (await knex(T_PROMO).where({ tipo: c.tipo, ref: correo, correo }).first()) continue
    if (await knex(T_BAJA).where({ correo }).first()) continue
    if (await knex(T_PROMO).where({ correo }).whereIn("tipo", TIPOS_CORREO_CALC).where("created_at", ">=", hace(DIAS_ENTRE_CORREOS)).first()) {
      r.omitidos++
      continue
    }
    const { asunto, html } = correoCalc(c.tipo, c.proceso)
    tocados.add(correo)
    if (o.simular) {
      r[c.tipo]++
      r.detalle.push(`${c.tipo} (${c.proceso}) → ${correo}`)
      presupuesto--
      continue
    }
    const env = await sendEmail({ to: correo, subject: asunto, html, bajaUrl: ligaBaja(correo) })
    if (!env.sent) {
      logger.warn(`[calc-serie] ${c.tipo} a ${correo} no enviado: ${env.reason}`)
      if (env.configuracion) break
      continue
    }
    await knex(T_PROMO).insert({ correo, tipo: c.tipo, ref: correo }).onConflict(["tipo", "ref", "correo"]).ignore()
    r[c.tipo]++
    presupuesto--
  }
  return r
}
