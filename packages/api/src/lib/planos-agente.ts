// Agente de la Biblioteca de planos (pedido del dueño, 25 nov 2026): cada lunes
// investiga qué muebles de triplay quiere la gente, diseña 10 planos ORIGINALES
// de HETNA, los revisa con el motor de la tienda (corrige con los errores, hasta
// 2 veces) y los deja como BORRADOR en Dashboard → Planos IA. Nada se publica
// solo: el dueño los ve completos y aprueba (lib/planos-biblioteca.ts).
//
// Reglas:
//   - La búsqueda en la web es para saber QUÉ muebles busca la gente, nunca
//     para copiar el diseño ni las medidas de un plano ajeno.
//   - La razón de cada propuesta es sólo para el dueño; no sale al público.
import Anthropic from "@anthropic-ai/sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ADMIN } from "./centro-control"
import { EJEMPLOS_PLANOS } from "./planos-agente-ejemplos"
import { ErrorPlano, MATERIALES, T_BIBLIOTECA, asegurarBiblioteca, normalizarPlano, revisarEnTienda, slugLibre } from "./planos-biblioteca"
import { PLANOS_NOMBRES, T_PLANOS, asegurarTablaPlanos, cargarNombresPlanos, todosLosSlugs, nombrePlano } from "./planos-correo"
import { mandarPrivado } from "./social-telegram"

export const T_CORRIDAS = "hetna_planos_agente"
export const PLANOS_POR_SEMANA = Number(process.env.PLANOS_AGENTE_CANTIDAD || 10)
const MODELO = () => (process.env.PLANOS_IA_MODELO || "claude-opus-5-5").trim()
const REINTENTOS = 2

export const agenteApagado = () => ["1", "true", "si"].includes(String(process.env.PLANOS_AGENTE_APAGADO || "").toLowerCase())
export const hayIaPlanos = () => !!process.env.ANTHROPIC_API_KEY

let ia: Anthropic | null = null
const textoDe = (resp: any) => (resp?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim()

async function asegurarCorridas(knex: any) {
  if (!(await knex.schema.hasTable(T_CORRIDAS))) {
    await knex.schema.createTable(T_CORRIDAS, (t: any) => {
      t.increments("id").primary()
      t.timestamp("inicio", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("fin", { useTz: true }).nullable()
      t.text("estado").notNullable().defaultTo("corriendo") // corriendo | listo | error
      t.integer("creados").notNullable().defaultTo(0)
      t.jsonb("bitacora").nullable()
    })
  }
}

// ── 1. Investigar qué muebles quiere la gente ─────────────────────────────
const ESQUEMA_IDEAS = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nombre", "categoria", "por_que", "medidas_aprox"],
        properties: {
          nombre: { type: "string" },
          categoria: { type: "string", enum: ["Taller", "Casa"] },
          por_que: { type: "string" },
          medidas_aprox: { type: "string" },
        },
      },
    },
  },
} as const

type Idea = { nombre: string; categoria: "Taller" | "Casa"; por_que: string; medidas_aprox: string }

async function senalesPropias(knex: any) {
  await asegurarTablaPlanos(knex)
  const top = await knex(T_PLANOS)
    .where("created_at", ">", knex.raw("now() - interval '90 days'"))
    .groupBy("plano")
    .select("plano", knex.raw("count(*)::int as n"))
    .orderBy("n", "desc")
    .limit(10)
    .catch(() => [])
  return (top as { plano: string; n: number }[]).map((t) => `${nombrePlano(t.plano) || t.plano} (${t.n} descargas)`)
}

export async function investigarIdeas(knex: any, cuantas: number): Promise<Idea[]> {
  await cargarNombresPlanos(knex, true)
  const existentes = todosLosSlugs().map((s) => nombrePlano(s)).filter(Boolean)
  const rechazados = (await knex(T_BIBLIOTECA).whereIn("estado", ["rechazado", "borrador"]).select("nombre").catch(() => [])).map((x: any) => x.nombre)
  const top = await senalesPropias(knex)
  ia ??= new Anthropic()
  const resp: any = await (ia as any).beta.messages.create({
    model: MODELO(),
    max_tokens: 8000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA_IDEAS } },
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6, user_location: { type: "approximate", country: "MX" } }],
    messages: [
      {
        role: "user",
        content:
          "Eres el investigador de la Biblioteca de planos de HETNA CNC (marketplace mexicano de corte CNC). La biblioteca regala planos de muebles de triplay " +
          "(cortados en router CNC con piezas rectangulares) para taller y casa, y los talleres los venden fabricados.\n\n" +
          `Busca en la web qué muebles de triplay o madera busca y compra la gente en México ahora (temporada, tendencias, búsquedas, mercados en línea). Propón ${cuantas + 4} muebles NUEVOS que convenga agregar.\n\n` +
          "Reglas:\n" +
          "- La búsqueda es sólo para saber QUÉ tipo de mueble quiere la gente. No copies el diseño, las medidas ni los planos de nadie: HETNA diseña los suyos.\n" +
          "- Que se puedan hacer sólo con piezas rectangulares de triplay de 6, 9, 12 o 18 mm (sin curvas obligatorias, sin patas torneadas), de 1 a 4 hojas de 2440 × 1220.\n" +
          "- Mezcla Taller y Casa; prefiere muebles útiles que un taller pueda vender.\n" +
          "- No repitas ni hagas variantes casi iguales de los que ya existen.\n" +
          "- por_que: una o dos frases con la señal concreta que encontraste (no se publica; es para el dueño).\n\n" +
          `Ya existen (no los repitas): ${existentes.join(" | ")}\n` +
          (rechazados.length ? `Ya propuestos o rechazados (no los repitas): ${rechazados.join(" | ")}\n` : "") +
          (top.length ? `Los más descargados de la biblioteca (pista de lo que gusta): ${top.join(" | ")}\n` : ""),
      },
    ],
  })
  if (resp.stop_reason === "refusal") throw new Error("La IA no quiso investigar")
  const d = JSON.parse(textoDe(resp))
  return (d.ideas || []).slice(0, cuantas + 4)
}

// ── 2. Diseñar un plano ───────────────────────────────────────────────────
const PIEZA = {
  type: "object",
  additionalProperties: false,
  required: ["nombre", "material", "x0", "x1", "y0", "y1", "z0", "z1"],
  properties: {
    nombre: { type: "string" },
    material: { type: "string", enum: [...MATERIALES] },
    x0: { type: "number" }, x1: { type: "number" }, y0: { type: "number" }, y1: { type: "number" }, z0: { type: "number" }, z1: { type: "number" },
  },
}
const ESQUEMA_PLANO = {
  type: "object",
  additionalProperties: false,
  required: ["slug", "categoria", "nombre", "resumen", "descripcion", "nivel", "horas", "ruedas", "piezas", "pasos", "herrajes", "herramientas", "notas"],
  properties: {
    slug: { type: "string" },
    categoria: { type: "string", enum: ["Taller", "Casa"] },
    nombre: { type: "string" },
    resumen: { type: "string" },
    descripcion: { type: "string" },
    nivel: { type: "string", enum: ["Fácil", "Intermedio"] },
    horas: { type: "string" },
    ruedas: { type: "number" },
    piezas: { type: "array", items: PIEZA },
    pasos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "nota", "piezas"],
        properties: { titulo: { type: "string" }, nota: { type: "string" }, piezas: { type: "array", items: { type: "string" } } },
      },
    },
    herrajes: { type: "array", items: { type: "string" } },
    herramientas: { type: "array", items: { type: "string" } },
    notas: { type: "array", items: { type: "string" } },
  },
} as const

const REGLAS_DISENO =
  "Diseña el plano como lista de piezas rectangulares (cajas) en milímetros.\n" +
  "Ejes: x = ancho (izquierda → derecha), y = fondo (frente = 0 → atrás), z = alto (piso = 0 → arriba). Cada pieza: x0 < x1, y0 < y1, z0 < z1.\n" +
  "Reglas que revisa la máquina (si fallan, el plano se rechaza):\n" +
  "1. La medida más chica de cada pieza es EXACTAMENTE el grosor de su material: triplay-18 = 18, triplay-12 = 12, triplay-9 = 9, triplay-6 = 6.\n" +
  "2. Ninguna pieza se encima con otra (pueden tocarse cara con cara, no ocupar el mismo espacio). Ej.: un costado va de z 0 a la cubierta, la cubierta va ENCIMA; una repisa entre costados empieza en x = grosor del costado y termina en x = ancho − grosor; si hay respaldo atrás, las repisas terminan en y = fondo − grosor del respaldo.\n" +
  "3. Cada pieza toca al menos a otra (comparten cara) y todo el mueble es UNA sola pieza armada (sólo los cajones pueden ir sueltos; nómbralos «Cajón …»).\n" +
  "4. Ninguna pieza mide más de 2420 × 1200 mm (hoja de 2440 × 1220 con margen). Medidas generales de 100 a 2400 mm.\n" +
  "5. Cada pieza la nombra algún paso: pasos[].piezas lleva nombres o prefijos (\"Costado\" cubre «Costado izquierdo» y «Costado derecho»). Piezas iguales: «Repisa 1», «Repisa 2».\n" +
  "6. La pieza más baja empieza en z = 0 (o en z = ruedas si lleva ruedas; ruedas = 0 si no lleva).\n" +
  "Además: diseño ORIGINAL de HETNA, resistente y fácil de armar con tornillos y pegamento; de 3 a 6 pasos; herrajes con cantidades aproximadas; textos en español de México, claros, sin prometer cosas que no se pueden verificar. " +
  "slug en minúsculas con guiones, de 3 a 40 letras. nivel «Fácil» o «Intermedio». horas como «2 a 3 h».\n\n" +
  `Ejemplos reales de la biblioteca (formato y forma de armar): ${JSON.stringify(EJEMPLOS_PLANOS)}`

export async function disenarPlano(idea: Idea, slugsUsados: Set<string>, bitacora: string[]): Promise<{ plano: any; revision: any } | null> {
  ia ??= new Anthropic()
  const mensajes: any[] = [
    {
      role: "user",
      content:
        `${REGLAS_DISENO}\n\nDiseña este mueble: «${idea.nombre}» (${idea.categoria}). Medidas aproximadas sugeridas: ${idea.medidas_aprox}. ` +
        `No uses estos slugs: ${[...slugsUsados].slice(-120).join(", ")}.`,
    },
  ]
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    const resp: any = await (ia as any).beta.messages.create({
      model: MODELO(),
      max_tokens: 16000,
      output_config: { effort: "high", format: { type: "json_schema", schema: ESQUEMA_PLANO } },
      messages: mensajes,
    })
    if (resp.stop_reason === "refusal" || resp.stop_reason === "max_tokens") {
      bitacora.push(`«${idea.nombre}»: la IA no terminó (${resp.stop_reason})`)
      return null
    }
    const crudo = textoDe(resp)
    let errores: string[] = []
    let plano: any = null
    try {
      plano = normalizarPlano(JSON.parse(crudo))
      if (slugsUsados.has(plano.slug)) errores.push(`El slug «${plano.slug}» ya existe; usa otro.`)
    } catch (e) {
      errores.push(e instanceof ErrorPlano ? e.message : "El JSON no es válido.")
    }
    let revision: any = null
    if (!errores.length) {
      revision = await revisarEnTienda(plano)
      errores = revision.ok ? [] : revision.errores
    }
    if (!errores.length) return { plano, revision }
    bitacora.push(`«${idea.nombre}» intento ${intento + 1}: ${errores.slice(0, 4).join(" · ")}`)
    mensajes.push({ role: "assistant", content: crudo }, { role: "user", content: `La revisión encontró estos errores; corrígelos y entrega el plano completo otra vez:\n- ${errores.slice(0, 12).join("\n- ")}` })
  }
  return null
}

// ── 3. Corrida completa ───────────────────────────────────────────────────
let corriendo = false

/** Investiga, diseña y guarda hasta `cuantos` borradores. */
export async function correrAgentePlanos(container: any, o: { cuantos?: number } = {}) {
  if (!hayIaPlanos()) return { ok: false, motivo: "Falta la llave de IA (ANTHROPIC_API_KEY) en el servidor." }
  if (corriendo) return { ok: false, motivo: "El agente ya está trabajando." }
  corriendo = true
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = container.resolve("logger")
  const cuantos = Math.max(1, Math.min(20, o.cuantos || PLANOS_POR_SEMANA))
  await asegurarBiblioteca(knex)
  await asegurarCorridas(knex)
  const [{ id }] = await knex(T_CORRIDAS).insert({ estado: "corriendo" }).returning("id")
  const bitacora: string[] = []
  const creados: string[] = []
  try {
    const ideas = await investigarIdeas(knex, cuantos)
    bitacora.push(`Ideas: ${ideas.map((i) => i.nombre).join(" | ")}`)
    const slugs = new Set<string>([...Object.keys(PLANOS_NOMBRES), ...(await knex(T_BIBLIOTECA).pluck("slug"))])
    for (const idea of ideas) {
      if (creados.length >= cuantos) break
      try {
        const r = await disenarPlano(idea, slugs, bitacora)
        if (!r) continue
        if (!(await slugLibre(knex, r.plano.slug))) continue
        await knex(T_BIBLIOTECA).insert({
          slug: r.plano.slug,
          nombre: r.plano.nombre,
          categoria: r.plano.categoria,
          estado: "borrador",
          origen: "ia",
          datos: JSON.stringify(r.plano),
          razon: `${idea.por_que}`.slice(0, 2000),
          revision: JSON.stringify(r.revision),
        })
        slugs.add(r.plano.slug)
        creados.push(r.plano.nombre)
        await knex(T_CORRIDAS).where({ id }).update({ creados: creados.length, bitacora: JSON.stringify(bitacora) })
      } catch (e) {
        bitacora.push(`«${idea.nombre}»: ${(e as Error).message}`)
      }
    }
    await knex(T_CORRIDAS).where({ id }).update({ estado: "listo", fin: knex.fn.now(), creados: creados.length, bitacora: JSON.stringify(bitacora) })
    logger.info(`[planos-agente] ${creados.length} borradores nuevos`)
    if (creados.length) {
      await mandarPrivado(knex, {
        texto: `📐 Agente de planos: ${creados.length} planos nuevos por revisar\n\n${creados.map((n) => `• ${n}`).join("\n")}\n\nRevísalos y publícalos en ${ADMIN}/planos-ia`,
      }).catch(() => undefined)
    }
    return { ok: true, creados }
  } catch (e) {
    bitacora.push(`Error: ${(e as Error).message}`)
    await knex(T_CORRIDAS).where({ id }).update({ estado: "error", fin: knex.fn.now(), creados: creados.length, bitacora: JSON.stringify(bitacora) })
    logger.error(`[planos-agente] ${(e as Error).message}`)
    return { ok: false, motivo: (e as Error).message, creados }
  } finally {
    corriendo = false
  }
}

export async function ultimaCorrida(knex: any) {
  await asegurarCorridas(knex)
  const c = await knex(T_CORRIDAS).orderBy("id", "desc").first()
  return c ? { ...c, corriendo } : { corriendo }
}
