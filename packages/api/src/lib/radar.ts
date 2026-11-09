// @ts-nocheck
// Marketing HETNA — Radar: agente que busca en la web oportunidades CNC.
// (docs/pendientes-marketing.md, "Radar HETNA")
//
// Cada día corre unas cuantas búsquedas (rotando) con la búsqueda web de
// Claude y guarda lo que encuentra, clasificado:
//   cliente     gente o empresas que buscan quién les fabrique; plantas nuevas
//               por nearshoring que van a necesitar proveedores; licitaciones
//   taller      talleres y proveedores CNC por ciudad/país para invitarlos
//   contenido   temas y preguntas CNC que se están moviendo (ideas de posts)
//   competencia lo que hacen otros marketplaces de manufactura
//   evento      ferias y exposiciones
//   mencion     menciones de HETNA
// Reglas: sólo información pública; nada de copiar datos de sitios que lo
// prohíben; las invitaciones las manda el dueño, una por una (sin spam).
// Costo: cada búsqueda web cobra aparte en la cuenta de Claude; el tope diario
// se fija con RADAR_BUSQUEDAS_DIA (por omisión 6).
import Anthropic from "@anthropic-ai/sdk"

import { STORE_URL, nuevoId } from "./licitacion"
import { MERCADOS, T_CONFIG_S, asegurarSocial, crearPublicacion, iaSocial } from "./social-hub"

export const T_HALLAZGO = "hetna_radar_hallazgo"
export const TIPOS = ["cliente", "taller", "contenido", "competencia", "evento", "mencion"] as const
export type Busqueda = { id: string; tipo: (typeof TIPOS)[number]; mercado: string; consulta: string; activa: boolean }

// Búsquedas iniciales (editables en el Admin)
export const BUSQUEDAS_INICIALES: Busqueda[] = [
  { id: "plantas-mx", tipo: "cliente", mercado: "mx", consulta: "nuevas plantas industriales anunciadas en México este mes (nearshoring) que necesitarán proveedores de maquinado, corte o piezas metálicas", activa: true },
  { id: "busca-taller-mx", tipo: "cliente", mercado: "mx", consulta: "personas o empresas en México preguntando en foros o grupos públicos quién les puede fabricar o maquinar una pieza CNC, corte láser o plasma", activa: true },
  { id: "licitaciones-mx", tipo: "cliente", mercado: "mx", consulta: "licitaciones o convocatorias públicas recientes en México para maquinado, fabricación de piezas metálicas o corte CNC", activa: true },
  { id: "talleres-bajio", tipo: "taller", mercado: "mx", consulta: "talleres de maquinado CNC y corte láser en Querétaro, Guanajuato y Aguascalientes con sitio web", activa: true },
  { id: "talleres-norte", tipo: "taller", mercado: "mx", consulta: "talleres de maquinado CNC y corte láser en Monterrey, Saltillo y Chihuahua con sitio web", activa: true },
  { id: "tendencias-cnc", tipo: "contenido", mercado: "mx", consulta: "temas, dudas y novedades de CNC, corte láser, plasma y router que más se comentan esta semana (para contenido en redes)", activa: true },
  { id: "competencia", tipo: "competencia", mercado: "us", consulta: "novedades recientes de marketplaces de manufactura como Xometry, Protolabs, Fictiv o Jiga, especialmente en México o Latinoamérica", activa: true },
  { id: "ferias", tipo: "evento", mercado: "mx", consulta: "ferias y exposiciones de manufactura, maquinaria y CNC en México en los próximos 3 meses (fechas y sede)", activa: true },
  { id: "menciones", tipo: "mencion", mercado: "mx", consulta: "menciones recientes de \"HETNA CNC\" o hetnacnc.com en la web", activa: true },
  { id: "plantas-us", tipo: "cliente", mercado: "us", consulta: "US companies announcing nearshoring of manufacturing to Mexico this month that need machined or fabricated parts suppliers", activa: false },
  { id: "talleres-co", tipo: "taller", mercado: "co", consulta: "talleres de mecanizado CNC y corte láser en Bogotá, Medellín y Cali con sitio web", activa: false },
]

let listo = false
export async function asegurarRadar(knex: any) {
  if (listo) return
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_HALLAZGO))) {
    await knex.schema.createTable(T_HALLAZGO, (t: any) => {
      t.text("id").primary()
      t.text("tipo").notNullable().index()
      t.text("mercado").notNullable()
      t.text("titulo").notNullable()
      t.text("resumen")
      t.text("url").notNullable().unique()
      t.text("lugar")
      t.integer("relevancia") // 1 a 5
      t.text("accion") // lo que propone el agente
      t.jsonb("datos") // empresa, sitio, fecha del evento…
      t.text("busqueda_id")
      t.text("estado").notNullable().defaultTo("nuevo") // nuevo | util | descartado | convertido
      t.text("post_id")
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
    })
  }
  listo = true
}

export async function leerBusquedas(knex: any): Promise<Busqueda[]> {
  await asegurarRadar(knex)
  const r = await knex(T_CONFIG_S).where({ clave: "radar" }).first()
  return Array.isArray(r?.valor?.busquedas) ? r.valor.busquedas : BUSQUEDAS_INICIALES
}

export async function guardarBusquedas(knex: any, lista: any[]) {
  const limpias: Busqueda[] = (Array.isArray(lista) ? lista : [])
    .map((b) => ({
      id: String(b.id || nuevoId("rb")).slice(0, 40),
      tipo: (TIPOS as readonly string[]).includes(b.tipo) ? b.tipo : "contenido",
      mercado: b.mercado in MERCADOS ? b.mercado : "mx",
      consulta: String(b.consulta || "").trim().slice(0, 400),
      activa: b.activa !== false,
    }))
    .filter((b) => b.consulta)
    .slice(0, 40)
  await knex.raw(`insert into ?? (clave, valor) values ('radar', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify({ busquedas: limpias })])
  return limpias
}

let ia: Anthropic | null = null

const INSTRUCCIONES =
  "Eres el analista de mercado de HETNA CNC, marketplace mexicano de fabricación CNC (conecta clientes con talleres y proveedores; sin comisión en licitaciones; talleres verificados; ranking público). " +
  "Busca en la web y devuelve SOLO hallazgos reales, recientes y con fuente pública verificable. No inventes nada: si no encuentras, devuelve una lista vacía. " +
  "No incluyas datos personales de particulares (teléfonos o correos personales); de empresas, sólo nombre, ciudad y sitio web públicos. " +
  'Responde al final con un bloque ```json con la forma {"hallazgos":[{"titulo":"","resumen":"","url":"","lugar":"","relevancia":1,"accion":"","datos":{"empresa":"","sitio":"","fecha":""}}]} ' +
  "con máximo 6 hallazgos ordenados por relevancia (5 = oportunidad clara para HETNA). En \"accion\" escribe en una frase qué debería hacer HETNA (contactar, invitar, publicar sobre esto, asistir, etc.)."

export function extraerJson(texto: string) {
  const m = texto.match(/```json\s*([\s\S]*?)```/i) || texto.match(/(\{[\s\S]*"hallazgos"[\s\S]*\})/)
  if (!m) return []
  try {
    const d = JSON.parse(m[1])
    return Array.isArray(d.hallazgos) ? d.hallazgos : []
  } catch {
    return []
  }
}

/** Una búsqueda: Claude busca en la web y devuelve hallazgos estructurados. */
export async function correrBusqueda(knex: any, b: Busqueda, logger?: any) {
  await asegurarRadar(knex)
  if (!iaSocial()) return { ok: false, error: "Falta la llave de Claude (ANTHROPIC_API_KEY) en el servidor." }
  ia ??= new Anthropic()
  const pais = { mx: "MX", us: "US", co: "CO", cl: "CL", pe: "PE", ar: "AR", br: "BR" }[b.mercado] || "MX"
  const mensajes: any[] = [{ role: "user", content: `Tipo de hallazgo: ${b.tipo}. Mercado: ${MERCADOS[b.mercado]?.nombre}.\nBúsqueda: ${b.consulta}` }]
  let texto = ""
  try {
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const resp = await ia.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 4000,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: INSTRUCCIONES,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4, user_location: { type: "approximate", country: pais } }],
        messages: mensajes,
      } as any)
      texto += resp.content.filter((x: any) => x.type === "text").map((x: any) => x.text).join("")
      if (resp.stop_reason === "refusal") return { ok: false, error: "La IA no quiso hacer esa búsqueda." }
      // El servidor pausa búsquedas largas: se continúa con el mismo contenido
      if (resp.stop_reason !== "pause_turn") break
      mensajes.push({ role: "assistant", content: resp.content })
    }
  } catch (e) {
    logger?.warn?.(`[radar] ${b.id}: ${(e as Error).message}`)
    return { ok: false, error: (e as Error).message }
  }
  const hallazgos = extraerJson(texto).filter((h: any) => /^https?:\/\//.test(String(h.url || "")) && h.titulo)
  let nuevos = 0
  for (const h of hallazgos) {
    const fila = {
      id: nuevoId("rad"), tipo: b.tipo, mercado: b.mercado, titulo: String(h.titulo).slice(0, 200), resumen: String(h.resumen || "").slice(0, 800) || null,
      url: String(h.url).slice(0, 600), lugar: String(h.lugar || "").slice(0, 120) || null,
      relevancia: Math.max(1, Math.min(5, Math.round(Number(h.relevancia) || 3))), accion: String(h.accion || "").slice(0, 300) || null,
      datos: JSON.stringify(h.datos && typeof h.datos === "object" ? h.datos : {}), busqueda_id: b.id,
    }
    const r = await knex(T_HALLAZGO).insert(fila).onConflict("url").ignore().returning("id").catch(() => [])
    if (r?.length) nuevos++
  }
  return { ok: true, encontrados: hallazgos.length, nuevos }
}

/** Job diario: corre las búsquedas activas, rotando, hasta el tope del día. */
export async function correrRadar(knex: any, logger?: any) {
  await asegurarRadar(knex)
  const tope = Math.max(0, Math.min(30, Number(process.env.RADAR_BUSQUEDAS_DIA ?? 6)))
  const activas = (await leerBusquedas(knex)).filter((b) => b.activa)
  if (!tope || !activas.length) return { corridas: 0, nuevos: 0 }
  // Rotación: empieza donde se quedó ayer
  const r = await knex(T_CONFIG_S).where({ clave: "radar_turno" }).first()
  const inicio = Number(r?.valor?.i || 0) % activas.length
  let nuevos = 0
  let corridas = 0
  for (let k = 0; k < Math.min(tope, activas.length); k++) {
    const b = activas[(inicio + k) % activas.length]
    const res = await correrBusqueda(knex, b, logger)
    corridas++
    if (res.ok) nuevos += res.nuevos
  }
  await knex.raw(`insert into ?? (clave, valor) values ('radar_turno', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify({ i: inicio + corridas })])
  logger?.info?.(`[radar] ${corridas} búsquedas, ${nuevos} hallazgos nuevos`)
  return { corridas, nuevos }
}

export async function listarHallazgos(knex: any, f: { estado?: string; tipo?: string } = {}) {
  await asegurarRadar(knex)
  const q = knex(T_HALLAZGO).orderBy([{ column: "relevancia", order: "desc" }, { column: "created_at", order: "desc" }]).limit(200)
  q.where({ estado: f.estado || "nuevo" })
  if (f.tipo) q.where({ tipo: f.tipo })
  return q
}

/** Mensaje sugerido para invitar o contactar (lo manda el dueño, uno por uno). */
export function mensajeSugerido(h: any) {
  const empresa = h.datos?.empresa || h.titulo
  const firma = process.env.RADAR_FIRMA || "el equipo de HETNA CNC"
  if (h.tipo === "taller")
    return `Hola, equipo de ${empresa}. Les escribe ${firma} (hetnacnc.com), un marketplace mexicano donde clientes publican trabajos de corte y maquinado y los talleres cotizan sin comisión. Vi su trabajo y creo que les pueden llegar solicitudes de su zona. El registro es gratis: ${STORE_URL}/mx/talleres/unete . Si no les interesa, no les vuelvo a escribir. ¡Saludos!`
  if (h.tipo === "cliente")
    return `Hola, equipo de ${empresa}. Les escribe ${firma} (hetnacnc.com). Conectamos empresas con talleres de maquinado y corte CNC verificados en México: publican su pieza y reciben varias cotizaciones. Si les sirve, pueden cotizar aquí: ${STORE_URL}/mx/cotizar . Si no es de su interés, no les vuelvo a escribir. ¡Saludos!`
  return ""
}

/** Convierte un hallazgo de contenido/tendencia/evento en borrador del Social Hub. */
export async function aPublicacion(knex: any, id: string, logger?: any) {
  await asegurarRadar(knex)
  const h = await knex(T_HALLAZGO).where({ id }).first()
  if (!h) throw Object.assign(new Error("Hallazgo no encontrado."), { status: 404 })
  const base =
    h.tipo === "evento"
      ? `📅 ${h.titulo}${h.lugar ? ` · ${h.lugar}` : ""}\n\n${h.resumen || ""}\n\n¿Vas a ir? Encuentra talleres y proveedores CNC en HETNA: {{liga}}`
      : `${h.titulo}\n\n${h.resumen || ""}\n\n¿Qué opinas? Cuéntanos en los comentarios. Cotiza tu pieza en HETNA: {{liga}}`
  const postId = await crearPublicacion(knex, { origen: "manual", titulo: `Radar · ${h.titulo}`.slice(0, 160), texto_base: base, url: `${STORE_URL}/mx`, estado: "borrador", mercado: h.mercado, notas: `Fuente: ${h.url}` }, logger)
  await knex(T_HALLAZGO).where({ id }).update({ estado: "convertido", post_id: postId })
  return { post_id: postId }
}
