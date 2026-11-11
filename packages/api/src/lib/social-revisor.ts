// @ts-nocheck
// Marketing HETNA — revisor con IA antes de publicar.
// Toma los textos de una publicación, revisa cada red con el puntaje de
// algoritmo (lib/estrategia: puntuar) y, donde falla algo, le pide a Claude que
// lo corrija siguiendo los consejos de esa red y las reglas de diseño de
// docs/investigacion-disenos-virales.md. Guarda la versión anterior para
// poder deshacer. No inventa datos: sólo reescribe lo que ya dice el texto.
import Anthropic from "@anthropic-ai/sdk"

import { MERCADOS, REDES, T_POST, asegurarSocial, iaSocial, leerConfig } from "./social-hub"
import { GUIAS, puntuar } from "./estrategia"

const SIN_TEXTO = ["instagram_historia"]
let ia: Anthropic | null = null

/** Redes que se revisan (las que publican texto). */
export const redesConTexto = (redes: string[]) => (redes || []).filter((r) => !SIN_TEXTO.includes(r) && REDES[r])

/** Qué falta en cada red (consejos del puntaje). Sólo las que no llegan al mínimo. */
export function pendientesDe(p: any, minimo: number) {
  const out: Record<string, { puntaje: number; consejos: string[] }> = {}
  for (const red of redesConTexto(p.redes)) {
    const r = puntuar(p.textos?.[red] || "", red, { medios: p.medios, programada_para: p.programada_para, mercado: p.mercado })
    // Lo que no se arregla cambiando el texto (falta video, mala hora) no se le pide a la IA
    const consejos = r.revisiones.filter((x: any) => !x.ok && !/video|imagen|horario|hora/i.test(x.texto)).map((x: any) => x.consejo || x.texto)
    if (r.puntaje < minimo && consejos.length) out[red] = { puntaje: r.puntaje, consejos }
  }
  return out
}

/** Pide a Claude los textos corregidos (JSON por red). null si no hay IA o falla. */
async function corregir(p: any, faltas: Record<string, { consejos: string[] }>, logger?: any) {
  const redes = Object.keys(faltas)
  if (!redes.length || !iaSocial()) return null
  try {
    ia ??= new Anthropic()
    const detalle = redes
      .map((r) => `### ${r} (máx. ${REDES[r].max} caracteres; estilo: ${REDES[r].estilo}; lo que premia: ${GUIAS[r]?.claves || "-"})\nTexto actual:\n${p.textos?.[r] || p.texto_base}\nCorrige: ${faltas[r].consejos.join(" | ")}`)
      .join("\n\n")
    const resp = await ia.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: { type: "object", properties: Object.fromEntries(redes.map((r) => [r, { type: "string" }])), required: redes, additionalProperties: false } } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "Eres el editor de redes de HETNA CNC (marketplace de fabricación CNC: clientes que necesitan piezas y talleres o proveedores que cotizan sin comisión). " +
        `Mercado: ${MERCADOS[p.mercado || "mx"]?.nota || "español de México"}. Corrige cada texto aplicando SÓLO lo que se pide, sin cambiar el sentido. ` +
        "Reglas: no inventes precios, cifras, clientes, plazos ni promociones (usa sólo los datos que ya están); primera línea corta (máx. 8 palabras) que se entienda sola; " +
        "una sola llamada a la acción; pide que lo manden a quien lo necesita, nunca 'comenta SÍ' ni 'etiqueta a'; conserva exactamente la marca {{liga}} si estaba " +
        "si el texto promete riqueza, ingresos o ganancias, cámbialo por lo verificable (trabajo disponible, sin comisión, cotizar gratis); " +
        "(en Instagram no pongas ligas: di 'liga en el perfil'); sin teléfonos ni correos.",
      messages: [{ role: "user", content: detalle }],
    } as any)
    if (resp.stop_reason === "refusal") return null
    const json = JSON.parse(resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
    const out: Record<string, string> = {}
    for (const r of redes) if (typeof json[r] === "string" && json[r].trim()) out[r] = json[r].trim().slice(0, REDES[r].max)
    return Object.keys(out).length ? out : null
  } catch (e) {
    logger?.warn?.(`[social] revisor IA: ${(e as Error).message}`)
    return null
  }
}

/**
 * Revisa una publicación. `forzar` revisa todas las redes con texto (botón del
 * panel); si no, sólo las que no llegan al mínimo. Sólo guarda una red si su
 * puntaje no baja. Devuelve { cambiadas, antes, despues }.
 */
export async function revisarPublicacion(knex: any, id: string, logger?: any, o: { forzar?: boolean } = {}) {
  await asegurarSocial(knex)
  const p = await knex(T_POST).where({ id }).first()
  if (!p || !["borrador", "programada", "error"].includes(p.estado)) return { cambiadas: [], motivo: "no editable" }
  const cfg = await leerConfig(knex)
  const faltas = o.forzar
    ? Object.fromEntries(redesConTexto(p.redes).map((r) => [r, { puntaje: 0, consejos: [...(pendientesDe(p, 101)[r]?.consejos || []), "Mejora el gancho de la primera línea y la llamada a la acción"] }]))
    : pendientesDe(p, cfg.piloto.minimo)
  if (!Object.keys(faltas).length) {
    await knex(T_POST).where({ id }).update({ revisada_ia: true })
    return { cambiadas: [], motivo: "ya cumple" }
  }
  const nuevos = await corregir(p, faltas, logger)
  if (!nuevos) return { cambiadas: [], motivo: iaSocial() ? "la IA no respondió" : "sin IA configurada" }
  const ctx = { medios: p.medios, programada_para: p.programada_para, mercado: p.mercado }
  const textos = { ...(p.textos || {}) }
  const cambiadas: string[] = []
  for (const [red, t] of Object.entries(nuevos)) {
    // Conserva la liga si el original la tenía y la red la usa en el texto
    const conLiga = String(p.textos?.[red] || "").includes("{{liga}}") && !t.includes("{{liga}}") && red !== "instagram" ? `${t}\n\n{{liga}}` : t
    if (puntuar(conLiga, red, ctx).puntaje >= puntuar(textos[red] || "", red, ctx).puntaje) {
      textos[red] = conLiga
      cambiadas.push(red)
    }
  }
  await knex(T_POST).where({ id }).update({
    textos: JSON.stringify(textos),
    revisada_ia: true,
    ...(cambiadas.length ? { version_anterior: JSON.stringify({ textos: p.textos, en: new Date().toISOString() }), updated_at: knex.fn.now() } : {}),
  })
  return { cambiadas }
}

/** Regresa a los textos de antes de la revisión. */
export async function deshacerRevision(knex: any, id: string) {
  const p = await knex(T_POST).where({ id }).first()
  if (!p?.version_anterior?.textos) return false
  await knex(T_POST).where({ id }).update({ textos: JSON.stringify(p.version_anterior.textos), version_anterior: null, updated_at: knex.fn.now() })
  return true
}

/** Job: revisa los borradores generados (plan, promociones, Fábrica) que no se han revisado. */
export async function revisarBorradores(knex: any, logger?: any, limite = 4) {
  if (!iaSocial()) return { revisadas: 0 }
  await asegurarSocial(knex)
  const lista = await knex(T_POST)
    .whereIn("estado", ["borrador", "programada"])
    .whereNotNull("fuente")
    .where((q: any) => q.whereNull("revisada_ia").orWhere("revisada_ia", false))
    .where((q: any) => q.whereNull("programada_para").orWhere("programada_para", ">", knex.raw("now() + interval '15 minutes'")))
    .orderByRaw("programada_para asc nulls last")
    .limit(limite)
    .select("id")
  let n = 0
  for (const { id } of lista) if ((await revisarPublicacion(knex, id, logger)).cambiadas?.length) n++
  if (n) logger?.info?.(`[social] revisor IA: ${n} publicaciones mejoradas`)
  return { revisadas: n }
}
