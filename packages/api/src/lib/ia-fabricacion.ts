// Asistente de IA de fabricación para talleres (idea 3 de la diferenciación).
//
// Contesta preguntas de fabricación usando las herramientas REALES de HETNA:
//   - las calculadoras CNC de la web (router, láser CO2 y fibra, plasma, 3D,
//     costo y precio): las cuentas las hace siempre el motor de la tienda
//     (apps/storefront/src/lib/copiloto/motor.ts, por /api/app/calculadora),
//     nunca la IA;
//   - el precio al instante de HETNA (lib/precio-instantaneo.ts);
//   - los trabajos abiertos del tablero público;
//   - el catálogo de la tienda (material, herramientas, refacciones);
//   - el directorio público de talleres (para subcontratar).
// A la IA sólo le llega lo que ya es público en hetnacnc.com y lo que el
// taller escribe en el chat. Nada de datos de clientes, archivos ni contactos.
//
// Quién lo usa: sólo talleres con plan de pago (Taller, Pro, Industrial). La
// prueba gratis no cuenta. Si no se puede comprobar el plan (Supabase no
// responde), no se deja pasar: es un servicio que cuesta.
//
// Modelo: Claude Haiku 5.5 (IA_FABRICACION_MODELO para cambiarlo). Gasto:
// lib/ia-fabricacion-uso.ts (tope de US$50 al mes, se pausa solo).
//
// Requiere ANTHROPIC_API_KEY. IA_FABRICACION=off lo apaga.
import Anthropic from "@anthropic-ai/sdk"

import { leerPlanApp } from "./licitacion-plan"
import { STORE_URL, T_PROPUESTA, T_SOLICITUD, asegurarTablas, folioTexto } from "./licitacion"
import { asegurarPrivacidad, trabajoPublicoPrivado } from "./licitacion-privacidad"
import { asegurarPropuestaFormal } from "./licitacion-propuesta"
import { IMPRESION_CALIDAD, IMPRESION_MATERIAL, PLASMA_CALIBRE, SERVICIOS_SOPORTADOS, precioInstantaneo } from "./precio-instantaneo"
import { MENSAJES_DIA, TOPE_MES_USD, contarMensaje, estadoUso, gastoDelMes, registrarUso } from "./ia-fabricacion-uso"

export const MODELO = () => (process.env.IA_FABRICACION_MODELO || "claude-haiku-5-5").trim()
export const iaFabricacionEncendida = () =>
  !!process.env.ANTHROPIC_API_KEY && (process.env.IA_FABRICACION || "").toLowerCase() !== "off"

// ---------------------------------------------------------------- plan

// Talleres fundadores: HETNA les prometió 6 meses de Pro. Se les da el
// asistente mientras dure ese beneficio. Para quitárselo, cambiar a false.
export const FUNDADOR_CUENTA = true

const PLANES_DE_PAGO = ["taller", "pro", "premium", "industrial", "master"]
const MESES_FUNDADOR = 6

export type PermisoIA = { ok: true; plan: string } | { ok: false; motivo: "sin_plan" | "sin_verificar"; plan?: string }

type SellerPlan = { email?: string | null; metadata?: Record<string, unknown> | null }

/** ¿El taller tiene un plan de pago vigente? Falla cerrado: sin comprobar, no pasa. */
export async function permisoIA(seller: SellerPlan, leerApp: (correo: string) => Promise<string | null> = leerPlanApp): Promise<PermisoIA> {
  const m = (seller.metadata || {}) as Record<string, any>

  // 1. Plan puesto a mano por HETNA (sin contar la prueba)
  const manual = String(m.plan || "").trim().toLowerCase()
  const vence = m.plan_vence ? Date.parse(String(m.plan_vence)) : NaN
  if (PLANES_DE_PAGO.includes(manual) && (Number.isNaN(vence) || vence > Date.now())) return { ok: true, plan: manual }

  // 2. Fundador, mientras duren sus 6 meses de Pro
  if (FUNDADOR_CUENTA && (m.fundador === true || m.fundador === "true")) {
    const desde = Date.parse(String(m.fundador_desde || ""))
    const hasta = new Date(Number.isNaN(desde) ? 0 : desde)
    hasta.setMonth(hasta.getMonth() + MESES_FUNDADOR)
    if (Number.isNaN(desde) || hasta.getTime() > Date.now()) return { ok: true, plan: "fundador" }
  }

  // 3. El plan que se cobra en la app (Supabase), con el correo del taller
  if (!seller.email) return { ok: false, motivo: "sin_plan" }
  let app: string | null
  try {
    app = await leerApp(seller.email)
  } catch {
    return { ok: false, motivo: "sin_verificar" }
  }
  const p = String(app || "gratis").toLowerCase()
  if (PLANES_DE_PAGO.includes(p)) return { ok: true, plan: p }
  return { ok: false, motivo: "sin_plan", plan: p }
}

// ---------------------------------------------------------------- herramientas

type Herramienta = Anthropic.Tool
type Calculadoras = { herramientas: Herramienta[]; hasta: number }
let calculadoras: Calculadoras | null = null

// La tienda se llama por su dirección interna si hay (mismo servidor), si no por la pública
const URL_TIENDA = () => (process.env.STOREFRONT_INTERNAL_URL || STORE_URL).replace(/\/$/, "")

/** Las calculadoras de la web como herramientas de Claude (se guardan 1 hora). */
export async function herramientasCalculadora(f: typeof fetch = fetch): Promise<Herramienta[]> {
  if (calculadoras && calculadoras.hasta > Date.now()) return calculadoras.herramientas
  try {
    const r = await f(`${URL_TIENDA()}/api/app/calculadora?ia=1`, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = (await r.json()) as { herramientas?: Herramienta[] }
    const lista = (d.herramientas || []).filter((h) => h && /^[a-z0-9_]{1,64}$/.test(h.name))
    calculadoras = { herramientas: lista, hasta: Date.now() + 3_600_000 }
    return lista
  } catch (e) {
    console.warn(`[ia-fabricacion] no se pudieron leer las calculadoras de ${URL_TIENDA()}: ${(e as Error).message}`)
    // Sin calculadoras, el asistente sigue con las demás herramientas; se reintenta en 1 minuto
    calculadoras = { herramientas: [], hasta: Date.now() + 60_000 }
    return []
  }
}

const MATERIALES_LASER = Object.keys(SERVICIOS_SOPORTADOS.laser_co2.materialLaserPorMaterial || {})

export const HERRAMIENTAS_HETNA: Herramienta[] = [
  {
    name: "precio_instantaneo",
    description:
      "Precio estimado al instante de HETNA CNC (el mismo de hetnacnc.com/mx/cotizar) para corte láser CO2, router CNC, plasma o impresión 3D. Devuelve mínimo, recomendado y máximo en pesos con IVA. Úsala para que el taller compare su precio con el del mercado o para cotizar rápido. Medidas en centímetros.",
    input_schema: {
      type: "object",
      properties: {
        servicio: { type: "string", enum: Object.keys(SERVICIOS_SOPORTADOS) },
        material: {
          type: "string",
          description: `Láser: ${MATERIALES_LASER.join(" | ")}. Plasma: Acero al carbón | Acero inoxidable | Aluminio. 3D: ${Object.keys(IMPRESION_MATERIAL).join(" | ")}. Router: libre.`,
        },
        ancho_cm: { type: "number" },
        largo_cm: { type: "number" },
        alto_cm: { type: "number", description: "Sólo impresión 3D" },
        cantidad: { type: "number" },
        calibre: { type: "string", enum: Object.keys(PLASMA_CALIBRE), description: "Sólo plasma" },
        calidad: { type: "string", enum: IMPRESION_CALIDAD, description: "Sólo impresión 3D" },
      },
      required: ["servicio", "ancho_cm", "largo_cm", "cantidad"],
    },
  },
  {
    name: "trabajos_abiertos",
    description:
      "Trabajos que clientes publicaron en HETNA y siguen recibiendo propuestas (tablero público). Filtra por servicio o estado de México. Úsala cuando el taller pregunte qué trabajo hay o dónde conseguir clientes. Se cotizan desde el panel, en Solicitudes.",
    input_schema: {
      type: "object",
      properties: {
        servicio: { type: "string", description: "Palabra del servicio, p. ej. láser, router, plasma, 3D, torno" },
        estado_mx: { type: "string", description: "Estado de México, p. ej. Jalisco" },
      },
    },
  },
  {
    name: "buscar_productos",
    description:
      "Busca en la tienda de HETNA CNC materiales, fresas, refacciones, máquinas y diseños. Devuelve nombre y liga. Úsala cuando el taller necesite comprar algo.",
    input_schema: {
      type: "object",
      properties: { consulta: { type: "string", description: "Qué busca, en pocas palabras" } },
      required: ["consulta"],
    },
  },
  {
    name: "buscar_talleres",
    description:
      "Directorio público de talleres de HETNA. Úsala para subcontratar un proceso que el taller no tiene (p. ej. quién tiene láser de fibra o torno en un estado).",
    input_schema: {
      type: "object",
      properties: {
        proceso: { type: "string", description: "Máquina o servicio, p. ej. láser de fibra, torno, plasma" },
        estado: { type: "string", description: "Estado de México" },
      },
    },
  },
]

const corto = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)
const normal = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

/** Ejecuta una herramienta. Devuelve texto JSON para la IA (nunca lanza). */
export async function ejecutarHerramienta(knex: any, nombre: string, entrada: any, f: typeof fetch = fetch): Promise<{ texto: string; error?: boolean }> {
  const e = entrada && typeof entrada === "object" ? entrada : {}
  try {
    if (nombre === "precio_instantaneo") {
      const r = precioInstantaneo({
        servicio: corto(e.servicio, 20),
        material: corto(e.material, 80),
        ancho: Number(e.ancho_cm),
        largo: Number(e.largo_cm),
        alto: Number(e.alto_cm),
        calibre: corto(e.calibre, 60),
        calidad: corto(e.calidad, 40),
        cantidad: Math.min(Number(e.cantidad), 100_000),
      })
      if (!r.ok) return { texto: JSON.stringify({ error: r.mensaje }), error: true }
      return {
        texto: JSON.stringify({
          servicio: r.servicioCfg.nombre,
          moneda: "MXN con IVA",
          minimo: r.resultado.pvMinimo,
          recomendado: r.resultado.pvRecomendado,
          maximo: r.resultado.pvPremium,
          nota: "Estimado de referencia de HETNA; el precio final depende del archivo y del taller.",
        }),
      }
    }

    if (nombre === "trabajos_abiertos") {
      const servicio = normal(corto(e.servicio, 40))
      const estado = normal(corto(e.estado_mx, 40))
      // Las mismas columnas que asegura el tablero público (/store/trabajos-abiertos)
      await asegurarTablas(knex)
      await asegurarPrivacidad(knex)
      await asegurarPropuestaFormal(knex)
      const base = () =>
        knex(T_SOLICITUD)
          .where({ modo: "abierta", estado: "abierta" })
          .whereNot({ modalidad: "privada" })
          .where((q: any) => q.whereNull("cierra_en").orWhere("cierra_en", ">", knex.fn.now()))
      const filas = (await base().orderBy("created_at", "desc").limit(200).select("id", "folio", "trabajo", "cierra_en", "privacidad", "modalidad", "tipo", "contacto")) as any[]
      const lista = filas
        .map((s) => {
          const t = s.trabajo || {}
          const p = trabajoPublicoPrivado(s)
          return { s, t, p }
        })
        .filter(({ t, p }) => (!servicio || normal(String(t.servicio || "")).includes(servicio)) && (!estado || normal(String(p.estado_mx || "")).includes(estado)))
      const primeros = lista.slice(0, 8)
      const conteos = primeros.length
        ? ((await knex(T_PROPUESTA).whereIn("solicitud_id", primeros.map((x) => x.s.id)).groupBy("solicitud_id").select("solicitud_id").count("* as n")) as any[])
        : []
      const n = Object.fromEntries(conteos.map((c) => [c.solicitud_id, Number(c.n)]))
      return {
        texto: JSON.stringify({
          total: lista.length,
          trabajos: primeros.map(({ s, t, p }) => ({
            folio: folioTexto(s.folio),
            servicio: t.servicio || "",
            material: t.material || "",
            cantidad: t.cantidad || "",
            medidas: t.medidas || "",
            ciudad: p.ciudad,
            estado_mx: p.estado_mx,
            tipo: p.tipo,
            descripcion: (p.descripcion || "").slice(0, 300),
            propuestas: n[s.id] || 0,
            cierra_en: s.cierra_en,
            liga: `${STORE_URL}/mx/trabajos/${folioTexto(s.folio)}`,
          })),
          como_cotizar: "En el panel del taller, sección Solicitudes.",
        }),
      }
    }

    if (nombre === "buscar_productos") {
      const palabras = normal(corto(e.consulta, 80)).split(/\s+/).filter((p) => p.length >= 2).slice(0, 5)
      if (!palabras.length) return { texto: JSON.stringify({ error: "Escribe qué buscas." }), error: true }
      const q = knex("product").where({ status: "published" }).whereNull("deleted_at")
      for (const p of palabras) q.whereRaw("translate(lower(title), 'áéíóúüñ', 'aeiouun') like ?", [`%${p}%`])
      const filas = (await q.orderBy("updated_at", "desc").limit(6).select("title", "handle")) as any[]
      return {
        texto: JSON.stringify({
          productos: filas.map((p) => ({ nombre: p.title, liga: `${STORE_URL}/mx/products/${p.handle}` })),
          buscar_mas: `${STORE_URL}/mx/categories?query=${encodeURIComponent(corto(e.consulta, 80))}`,
        }),
      }
    }

    if (nombre === "buscar_talleres") {
      const proceso = normal(corto(e.proceso, 40))
      const estado = normal(corto(e.estado, 40))
      // El mismo filtro que /store/sellers (de donde sale /mx/talleres): abiertos y sin cierre temporal
      const filas = (await knex("seller")
        .whereNull("deleted_at")
        .where({ status: "open" })
        .where((q: any) => q.whereNull("closed_from").orWhere("closed_from", ">", knex.fn.now()))
        .where((q: any) => q.whereNull("closed_to").orWhere("closed_to", "<", knex.fn.now()))
        .select("name", "handle", "metadata")
        .limit(2000)) as any[]
      const lista = filas
        .filter((s) => s.metadata?.prueba !== true)
        .map((s) => {
          const p = (s.metadata?.perfil || {}) as Record<string, any>
          const maquinas = (Array.isArray(p.maquinas) ? p.maquinas : [])
            .map((m: any) => [m?.nombre, m?.tipo, m?.x && m?.y ? `${m.x}x${m.y} mm` : ""].filter(Boolean).join(" "))
            .filter(Boolean)
          const servicios = Array.isArray(p.servicios) ? p.servicios.map(String) : []
          return {
            nombre: s.name,
            ciudad: String(p.ciudad || ""),
            estado: String(p.estado || ""),
            servicios: servicios.slice(0, 8),
            maquinas: maquinas.slice(0, 6),
            verificado: s.metadata?.verificado === true,
            liga: `${STORE_URL}/mx/talleres/${s.handle}`,
          }
        })
        .filter((t) => (!proceso || normal([...t.servicios, ...t.maquinas].join(" ")).includes(proceso)) && (!estado || normal(t.estado).includes(estado)))
        .sort((a, b) => Number(b.verificado) - Number(a.verificado))
      return { texto: JSON.stringify({ total: lista.length, talleres: lista.slice(0, 8), directorio: `${STORE_URL}/mx/talleres` }) }
    }

    // Una calculadora de la web
    if (/^[a-z0-9_]{1,64}$/.test(nombre)) {
      const r = await f(`${URL_TIENDA()}/api/app/calculadora`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nombre, entrada: e, ia: true }),
        signal: AbortSignal.timeout(8000),
      })
      const d = (await r.json().catch(() => ({}))) as any
      if (!r.ok) return { texto: JSON.stringify({ error: d.message || `La calculadora no respondió (${r.status}).` }), error: true }
      const res = d.resultado || {}
      // Todo lo que dice el motor, incluidos los datos que faltan y los supuestos
      return { texto: JSON.stringify({ titulo: res.titulo, filas: res.filas, avisos: res.avisos, faltan: res.faltan, supuestos: res.supuestos }) }
    }
    return { texto: JSON.stringify({ error: `No existe la herramienta ${nombre}.` }), error: true }
  } catch (err) {
    // El detalle va al registro del servidor, no a la IA
    console.warn(`[ia-fabricacion] la herramienta ${nombre} falló: ${(err as Error).message}`)
    return { texto: JSON.stringify({ error: "La herramienta no está disponible en este momento." }), error: true }
  }
}

// ---------------------------------------------------------------- conversación

const SISTEMA = `Eres el asistente de fabricación de HETNA CNC, un marketplace mexicano de fabricación CNC. Hablas con talleres (dueños y operadores de router CNC, láser, plasma, torno, fresadora e impresión 3D).

Cómo trabajas:
- Para cualquier número (RPM, avance, velocidad, potencia, tiempo, costo o precio) usa una herramienta. NUNCA calcules ni inventes cifras tú mismo. Si ninguna herramienta lo cubre, dilo y da criterios generales sin números.
- Si a la calculadora le faltan datos ("faltan"), pídeselos al taller en una sola pregunta, o calcula con lo que hay y di qué supusiste.
- Repite los avisos de seguridad que dé la calculadora (materiales prohibidos, polvo, humo).
- Los valores son puntos de partida: recuerda hacer un corte de prueba.
- Para precios, el precio al instante de HETNA es una referencia de mercado; el taller pone su propio precio.
- Si preguntan por clientes o trabajo, usa trabajos_abiertos. Si necesitan comprar algo, buscar_productos. Si les falta un proceso, buscar_talleres.
- Escribe en español de México, breve y práctico, en texto simple sin Markdown (nada de asteriscos ni #). Para listas usa guiones. Incluye las ligas que devuelvan las herramientas.
- No pidas ni repitas datos personales de clientes. Si te piden algo ajeno a fabricación, negocio del taller o HETNA, dilo con amabilidad.`

export type MensajeChat = { rol: "taller" | "asistente"; texto: string }

const MAX_TURNOS = 12
const MAX_CARACTERES = 2000
const MAX_VUELTAS = 6
// Tiempo total por pregunta: el panel no espera más, y no hay que seguir gastando
const MAX_MS = 50_000

/** Limpia la conversación que manda el navegador: sólo texto, acotada. */
export function limpiarHistorial(crudo: unknown): Anthropic.MessageParam[] {
  const lista = (Array.isArray(crudo) ? crudo : [])
    .filter((m: any) => m && (m.rol === "taller" || m.rol === "asistente") && typeof m.texto === "string" && m.texto.trim())
    .slice(-MAX_TURNOS)
    .map((m: any) => ({ role: m.rol === "taller" ? "user" : "assistant", content: m.texto.trim().slice(0, MAX_CARACTERES) }) as Anthropic.MessageParam)
  // Debe empezar con el taller y terminar con el taller; se juntan los seguidos del mismo lado
  while (lista.length && lista[0].role !== "user") lista.shift()
  const juntos: Anthropic.MessageParam[] = []
  for (const m of lista) {
    const ultimo = juntos[juntos.length - 1]
    if (ultimo && ultimo.role === m.role) ultimo.content = `${ultimo.content}\n\n${m.content}`
    else juntos.push({ ...m })
  }
  if (juntos.length && juntos[juntos.length - 1].role !== "user") juntos.pop()
  return juntos
}

export type Respuesta =
  | { ok: true; texto: string; herramientas: string[] }
  | { ok: false; status: number; mensaje: string }

let cliente: Anthropic | null = null
// Tiempo corto y pocos reintentos: el navegador no espera 10 minutos
const clienteIa = () => (cliente ??= new Anthropic({ timeout: 30_000, maxRetries: 1 }))

type Opciones = {
  knex: any
  sellerId: string
  historial: Anthropic.MessageParam[]
  ia?: Pick<Anthropic, "messages">
  fetch?: typeof fetch
  logger?: { warn?: (m: string) => void }
}

/** Contesta el último mensaje del taller. Revisa el tope antes de cada llamada al modelo. */
export async function conversar(o: Opciones): Promise<Respuesta> {
  const { knex, sellerId, logger } = o
  if (!o.historial.length) return { ok: false, status: 400, mensaje: "Escribe tu pregunta." }
  const estado = await estadoUso(knex, sellerId)
  if (estado.pausada) return { ok: false, status: 503, mensaje: "El asistente llegó a su tope del mes y vuelve el día 1." }
  if (estado.mensajes_hoy >= MENSAJES_DIA())
    return { ok: false, status: 429, mensaje: `Llegaste a ${MENSAJES_DIA()} preguntas por hoy. Mañana sigues.` }
  await contarMensaje(knex, sellerId)

  const ia = o.ia || clienteIa()
  const tools = [...(await herramientasCalculadora(o.fetch)), ...HERRAMIENTAS_HETNA]
  const mensajes: Anthropic.MessageParam[] = [...o.historial]
  const usadas: string[] = []
  const inicio = Date.now()

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    if (vuelta > 0 && Date.now() - inicio > MAX_MS) break
    if ((await gastoDelMes(knex)) >= TOPE_MES_USD()) {
      logger?.warn?.("[ia-fabricacion] se llegó al tope del mes; el asistente queda pausado hasta el día 1")
      return { ok: false, status: 503, mensaje: "El asistente llegó a su tope del mes y vuelve el día 1." }
    }
    let r: Anthropic.Message
    try {
      r = await ia.messages.create({
        model: MODELO(),
        max_tokens: 4000,
        output_config: { effort: "medium" },
        system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
        tools,
        messages: mensajes,
      } as any)
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) logger?.warn?.("[ia-fabricacion] límite de uso de Claude")
      else if (e instanceof Anthropic.AuthenticationError) logger?.warn?.("[ia-fabricacion] la llave de Claude no es válida")
      else if (e instanceof Anthropic.APIError) logger?.warn?.(`[ia-fabricacion] error ${e.status}: ${e.message}`)
      else logger?.warn?.(`[ia-fabricacion] ${(e as Error).message}`)
      return { ok: false, status: 502, mensaje: "El asistente no respondió. Intenta de nuevo en un momento." }
    }
    await registrarUso(knex, sellerId, r.model || MODELO(), r.usage as any).catch((e) =>
      logger?.warn?.(`[ia-fabricacion] no se pudo registrar el gasto: ${(e as Error).message}`)
    )

    const texto = r.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim()

    if (r.stop_reason === "refusal") return { ok: true, texto: "No puedo ayudar con eso. Pregúntame algo de fabricación o de tu taller.", herramientas: usadas }
    if (r.stop_reason === "pause_turn") {
      mensajes.push({ role: "assistant", content: r.content as any })
      continue
    }
    if (r.stop_reason !== "tool_use") {
      const corte = r.stop_reason === "max_tokens" ? "\n\n(La respuesta se cortó por larga. Pídeme que siga.)" : ""
      return { ok: true, texto: (texto || "No tengo una respuesta para eso.") + corte, herramientas: usadas }
    }

    // Todas las herramientas de esta vuelta, y todos los resultados en un solo mensaje
    const pedidas = r.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    mensajes.push({ role: "assistant", content: r.content as any })
    const resultados = await Promise.all(
      pedidas.map(async (b) => {
        usadas.push(b.name)
        const x = await ejecutarHerramienta(knex, b.name, b.input, o.fetch)
        return { type: "tool_result" as const, tool_use_id: b.id, content: x.texto, ...(x.error ? { is_error: true } : {}) }
      })
    )
    mensajes.push({ role: "user", content: resultados })
  }
  return { ok: true, texto: "Esta pregunta necesitó demasiados cálculos. Divídela en partes más pequeñas.", herramientas: usadas }
}
