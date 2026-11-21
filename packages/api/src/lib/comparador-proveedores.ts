// @ts-nocheck
// Agente «Comparador de proveedores» para talleres: el taller escribe qué busca
// (una máquina, una refacción, una herramienta o un material) y recibe hasta 3
// opciones comparadas: precio, envío, garantía y dónde comprar.
//
//   1. Primero lo que hay en HETNA (productos publicados que coinciden).
//   2. Después Claude busca en la web (México primero, luego importación) y
//      arma la comparación. Sólo datos que vio en las páginas: si un precio o
//      una garantía no aparece, lo dice («consultar»), no lo inventa.
//   3. Cada búsqueda se guarda y te llega a Telegram: así sabes qué piden los
//      talleres y qué proveedores conviene invitar a vender en HETNA.
//
// Límite: COMPARADOR_POR_DIA búsquedas por taller al día (5 por omisión), porque
// cada búsqueda web cuesta.
import Anthropic from "@anthropic-ai/sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { IA_MODELO, modeloIA } from "./ia-modelo"
import { iaSocial } from "./social-hub"
import { mandarPrivado } from "./social-telegram"
import { productosParecidos } from "./whatsapp-bot"

export const T_COMPARADOR = "hetna_comparador"

let listo = false
async function asegurarTabla(knex) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_COMPARADOR))) {
    await knex.schema.createTable(T_COMPARADOR, (t) => {
      t.increments("id").primary()
      t.text("seller_id").notNullable().index()
      t.text("consulta").notNullable()
      t.jsonb("resultado").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["opciones", "consejo"],
  properties: {
    opciones: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["proveedor", "producto", "precio", "envio", "garantia", "pais", "url", "nota"],
        properties: {
          proveedor: { type: "string" },
          producto: { type: "string", description: "Nombre y modelo tal como aparece en la página." },
          precio: { type: "string", description: "Precio con moneda e IVA si se indica (p. ej. «$18,500 MXN con IVA»); «consultar» si no aparece." },
          envio: { type: "string", description: "Costo o tiempo de envío a México; «consultar» si no aparece." },
          garantia: { type: "string", description: "Garantía que indica la página; «no indica» si no aparece." },
          pais: { type: "string", description: "Desde dónde vende (México, EE. UU., China…)." },
          url: { type: "string", description: "Liga de la página consultada." },
          nota: { type: "string", description: "Una línea: ventaja o cuidado (refacciones en México, importación, voltaje…)." },
        },
      },
    },
    consejo: { type: "string", description: "2 o 3 líneas: cuál conviene y por qué, y qué revisar antes de comprar." },
  },
}

let ia: Anthropic | null = null

export async function compararProveedores(container, sellerId: string, consulta: string) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTabla(knex)
  const q = String(consulta || "").replace(/\s+/g, " ").trim().slice(0, 200)
  if (q.length < 3) return { ok: false, message: "Escribe qué buscas (máquina, refacción, herramienta o material)." }
  const limite = Math.max(1, Number(process.env.COMPARADOR_POR_DIA) || 5)
  const hoy = await knex(T_COMPARADOR).where({ seller_id: sellerId }).where("created_at", ">", knex.raw("now() - interval '1 day'")).count({ n: "*" }).first()
  if (Number(hoy?.n || 0) >= limite) return { ok: false, message: `Llegaste al límite de ${limite} búsquedas por día. Mañana puedes buscar más.` }

  const enHetna = await productosParecidos(knex, q).catch(() => [])
  if (!iaSocial()) return { ok: true, en_hetna: enHetna, opciones: [], consejo: "La búsqueda en internet no está disponible por ahora." }

  ia ??= new Anthropic()
  const resp = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO()),
    max_tokens: 8000,
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4, user_location: { type: "approximate", country: "MX" } }],
    messages: [
      {
        role: "user",
        content:
          "Eres el comprador experto de HETNA CNC y ayudas a un taller mexicano a comprar. Busca en la web y compara hasta 3 opciones para lo que pide: " +
          "de preferencia distribuidores en México (factura, garantía y refacciones locales) y, si conviene, una de importación. " +
          "Usa SÓLO datos que veas en las páginas: si un precio, envío o garantía no aparece, escribe «consultar» o «no indica». No inventes modelos ni precios.\n\n" +
          `Lo que busca el taller: ${q}`,
      },
    ],
  })
  let r = { opciones: [], consejo: "" }
  if (resp.stop_reason !== "refusal") {
    try {
      r = JSON.parse((resp.content || []).filter((b) => b.type === "text").map((b) => b.text).join(""))
    } catch {
      r = { opciones: [], consejo: "No pude armar la comparación esta vez. Intenta con otras palabras." }
    }
  }
  const opciones = (r.opciones || []).filter((o) => /^https?:\/\//.test(o.url)).slice(0, 3)
  await knex(T_COMPARADOR).insert({ seller_id: sellerId, consulta: q, resultado: JSON.stringify({ opciones, en_hetna: enHetna.length }) })

  // Señal de demanda para el dueño (qué buscan los talleres y a quién invitar)
  const t = await container.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: "seller", fields: ["name"], filters: { id: sellerId } }).catch(() => null)
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  await mandarPrivado(knex, {
    texto:
      `🔧 Un taller busca proveedor: <b>${esc(q)}</b>\n${esc(t?.data?.[0]?.name || sellerId)}` +
      (enHetna.length ? `\nEn HETNA hay ${enHetna.length} producto(s) parecido(s).` : "\nEn HETNA no hay nada parecido: buen proveedor para invitar.") +
      (opciones.length ? `\n\nLe sugerí:\n${opciones.map((o) => `• ${esc(o.proveedor)} (${esc(o.pais)}): ${esc(o.precio)}`).join("\n")}` : ""),
  }).catch(() => undefined)

  return { ok: true, en_hetna: enHetna, opciones, consejo: String(r.consejo || "") }
}
