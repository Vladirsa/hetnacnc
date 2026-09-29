"use server"

// Copiloto IA CNC: habla con la IA (API de Claude, de Anthropic) desde el servidor.
// - La llave de la API vive solo en el servidor (ANTHROPIC_API_KEY en apps/storefront/.env.local).
// - Las cuentas de corte las hace el motor (motor.ts); la IA elige la calculadora y explica.
// - El limite de preguntas se cuenta aqui, nunca en el navegador.

import { createHash } from "crypto"
import { headers } from "next/headers"
import { Pool } from "pg"

import { retrieveCustomer } from "@/lib/data/customer"

import { ejecutar, herramientasIA, type Calculo, type Maquina } from "./motor"

// preguntas por mes segun plan (sin cuenta: por dia)
const LIMITES: Record<string, number> = { gratis: 20, prueba: 100, taller: 200, pro: 600, industrial: 2000 }
const LIMITE_ANONIMO_DIA = 3
const TOPE_ANONIMO_GLOBAL_DIA = 300 // protege el gasto si alguien abusa
const PLANES_PAGO = ["taller", "pro", "industrial"]
const MAX_RONDAS = 5

const global_ = globalThis as unknown as { __hetnaTallerPool?: Pool }
const pool = (): Pool => {
  if (!global_.__hetnaTallerPool) {
    const url = process.env.HETNA_TALLER_DB
    if (!url) throw new Error("Falta HETNA_TALLER_DB en el .env de la tienda")
    global_.__hetnaTallerPool = new Pool({ connectionString: url, max: 4 })
  }
  return global_.__hetnaTallerPool
}

type Fila = Record<string, any>
const texto = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "")

const mesActual = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" }).format(new Date())
const diaActual = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

const planEfectivo = (c: Fila): string => {
  const vigente = !c.plan_hasta || new Date(c.plan_hasta).getTime() > Date.now()
  if (PLANES_PAGO.includes(c.plan) && vigente) return c.plan
  if (new Date(c.prueba_hasta).getTime() > Date.now()) return "prueba"
  return "gratis"
}

const modeloPara = (plan: string) =>
  plan === "anonimo" || plan === "gratis"
    ? process.env.HETNA_IA_MODELO_BASICO || "claude-haiku-4-5-20251001"
    : process.env.HETNA_IA_MODELO || "claude-sonnet-5-5"

const cliente = async () => {
  const c = await retrieveCustomer().catch(() => null)
  return c && c.id ? c : null
}

const claveAnonima = async () => {
  const h = await headers()
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "sin-ip"
  return createHash("sha256").update(`hetna-copiloto:${ip}`).digest("hex").slice(0, 32)
}

// Cuenta del taller + uso del copiloto del mes
const cuentaCopiloto = async (c: { id: string; email?: string | null; first_name?: string | null; last_name?: string | null }) => {
  const nombre = [c.first_name, c.last_name].filter(Boolean).join(" ")
  await pool().query(
    `INSERT INTO taller.cuentas (customer_id, correo, nombre_contacto) VALUES ($1, $2, $3) ON CONFLICT (customer_id) DO NOTHING`,
    [c.id, c.email || null, nombre || null]
  )
  await pool().query(`INSERT INTO taller.copiloto (customer_id) VALUES ($1) ON CONFLICT (customer_id) DO NOTHING`, [c.id])
  const { rows } = await pool().query(
    `SELECT t.plan, t.plan_hasta, t.prueba_hasta, t.config, p.uso_mes, p.uso_n, p.maquinas
       FROM taller.cuentas t JOIN taller.copiloto p ON p.customer_id = t.customer_id WHERE t.customer_id = $1`,
    [c.id]
  )
  const f = rows[0]
  const plan = planEfectivo(f)
  return {
    plan,
    usadas: f.uso_mes === mesActual() ? Number(f.uso_n) || 0 : 0,
    limite: LIMITES[plan] ?? LIMITES.gratis,
    maquinas: Array.isArray(f.maquinas) ? f.maquinas : [],
    costos: (f.config && f.config.costos) || null,
  }
}

export async function copilotoEstado() {
  const iaActiva = !!process.env.ANTHROPIC_API_KEY
  const c = await cliente()
  if (!c) return { ok: true as const, sesion: false, iaActiva, plan: "anonimo", usadas: 0, limite: LIMITE_ANONIMO_DIA, maquinas: [] as Maquina[] }
  try {
    const cta = await cuentaCopiloto(c)
    return { ok: true as const, sesion: true, iaActiva, plan: cta.plan, usadas: cta.usadas, limite: cta.limite, maquinas: cta.maquinas as Maquina[] }
  } catch (e) {
    console.error("[copiloto] estado", e)
    return { ok: true as const, sesion: true, iaActiva, plan: "gratis", usadas: 0, limite: LIMITES.gratis, maquinas: [] as Maquina[] }
  }
}

export async function copilotoGuardarMaquinas(maquinas: Maquina[]) {
  const c = await cliente()
  if (!c) return { ok: false, motivo: "sin_sesion" }
  const lista = Array.isArray(maquinas) ? maquinas.slice(0, 10) : []
  const json = JSON.stringify(lista)
  if (json.length > 20_000) return { ok: false, motivo: "muy_grande" }
  await cuentaCopiloto(c)
  await pool().query(`UPDATE taller.copiloto SET maquinas = $2::jsonb WHERE customer_id = $1`, [c.id, json])
  return { ok: true }
}

// ---------------------------------------------------------------------
const PROMPT = `Eres el Copiloto IA CNC de HETNA CNC (hetnacnc.com): un asistente experto EXCLUSIVAMENTE en manufactura CNC. Cubres router y fresadora CNC, torno, láser CO₂, láser de fibra, plasma, impresión 3D, CAD/CAM, G-code, controladores (Mach3, Mach4, GRBL, UCCNC, LinuxCNC, NcStudio, DSP RichAuto, Ruida/RDWorks, LightBurn) y software (Vectric VCarve/Aspire, Autodesk Fusion, ArtCAM, Carveco, SheetCAM, Mastercam, SolidWorks, Inkscape, laminadores 3D). También ayudas con costos, cotizaciones y la operación de un taller.

Hablas español de México, claro y directo, como un maestro de taller con mucha experiencia que explica sin rodeos. Usa mm y mm/min salvo que el usuario use pulgadas.

REGLAS
1. Parámetros de corte, tiempos, pesos y costos: SIEMPRE usa las herramientas de cálculo. Nunca inventes esos números ni los calcules de memoria. Si faltan datos, llama la herramienta con lo que tengas: ella hace supuestos razonables y dice qué falta.
2. Después de calcular: el usuario YA ve una tarjeta con la tabla completa, así que NO la copies. Da en 2-5 líneas los valores clave y el porqué. Si la herramienta reportó datos faltantes, termina con "**Para afinarlo dime:**" y una lista corta de esos datos.
3. Todo parámetro es un PUNTO DE PARTIDA: recomienda un corte de prueba en un retazo y cómo ajustar según lo que vea (sonido, viruta, acabado, quemado, escoria).
4. Diagnóstico de problemas: da las causas más probables en orden, qué revisar primero y cómo confirmarlo. Si da RPM, avance y fresa, usa router_revisar.
5. Seguridad: nunca recomiendes quitar guardas, puentear paros de emergencia o interlocks, ni trabajar con la máquina sin supervisión. Advierte cuando aplique: polvo de MDF, fuego en láser, PVC/vinil prohibidos en láser, humos y radiación UV del plasma, electricidad del VFD y del spindle.
6. Software y controladores: da pasos concretos. Si no estás seguro del nombre exacto de un menú en la versión del usuario, dilo ("en tu versión puede llamarse distinto"). ArtCAM fue descontinuado por Autodesk; si piden alternativa menciona Carveco (su sucesor), Vectric Aspire/VCarve o Fusion.
7. Archivos: cuando un mensaje trae un "Análisis automático hecho por HETNA", confía en esas medidas y avisos (no las recalcules). Explica los problemas en orden de gravedad y cómo corregirlos en el programa que generó el archivo. Si piden precio, usa costo_trabajo con el tiempo del análisis; si es STL para imprimir, usa impresion_3d con su volumen.
8. G-code: explica comandos del dialecto de la máquina del usuario (Mach3, GRBL, etc.). Solo explica línea por línea si lo piden.
9. Fotos: describe lo relevante que ves (acabado, quemado, rebaba, escoria, vibración, mensajes de error en pantalla) y da causas y soluciones. Si no se ve claro, pide otra foto más cerca o con mejor luz.
10. Solo temas de CNC, fabricación y negocio del taller. Si preguntan otra cosa, redirige amablemente en una frase.
11. Formato: respuestas cortas (máximo ~250 palabras salvo que pidan detalle), párrafos breves, listas y tablas en markdown cuando ayuden. Sin encabezados grandes.
12. HETNA: si el usuario no tiene la máquina, el tiempo o el material, puedes mencionar UNA vez en la conversación que HETNA CNC le puede diseñar el archivo, maquilar la pieza o venderle material y herramienta (tienda en hetnacnc.com y Cotizador CNC). No lo repitas.
13. No inventes números de parte, marcas específicas de fresas ni precios de mercado.`

const contexto = (maquina: Maquina | null, costos: Fila | null) => {
  const partes: string[] = []
  if (maquina) {
    const m = maquina
    const d = [
      `nombre: ${texto(m.nombre, 60)}`,
      `tipo: ${texto(m.tipo, 30)}`,
      m.area ? `área de trabajo: ${texto(m.area, 40)}` : "",
      m.potencia_kw ? `spindle: ${m.potencia_kw} kW` : "",
      m.potencia_w ? `potencia láser: ${m.potencia_w} W` : "",
      m.amperaje ? `plasma: ${m.amperaje} A` : "",
      m.rpm_min ? `RPM mín: ${m.rpm_min}` : "",
      m.rpm_max ? `RPM máx: ${m.rpm_max}` : "",
      m.avance_max ? `avance máx de corte: ${m.avance_max} mm/min` : "",
      m.rapido ? `rápidos: ${m.rapido} mm/min` : "",
      m.controlador ? `controlador: ${texto(m.controlador, 40)}` : "",
      m.software ? `software CAM: ${texto(m.software, 60)}` : "",
      m.notas ? `notas: ${texto(m.notas, 300)}` : "",
    ].filter(Boolean)
    partes.push(`MÁQUINA DEL USUARIO (perfil "Mi máquina"; úsalo para llenar las herramientas sin volver a preguntar): ${d.join("; ")}.`)
  } else partes.push(`El usuario no ha llenado "Mi máquina". Si la respuesta depende de su máquina, pide los datos que falten (y sugiere llenarlos en la pestaña Mi máquina).`)
  if (costos) {
    const total = (Number(costos.costoHoraTaller) || 0) + (Number(costos.costoHoraMaquina) || 0) + (Number(costos.costoHoraOperador) || 0)
    if (total > 0) partes.push(`COSTOS DEL TALLER DEL USUARIO (de su Cotizador HETNA): costo por hora total $${total.toFixed(2)} MXN, margen recomendado ${costos.margenRecomendado ?? 55}%, IVA ${costos.ivaPct ?? 16}%. Úsalos en costo_trabajo.`)
  }
  return partes.join("\n")
}

type Mensaje = { rol: "usuario" | "copiloto"; texto: string }
type Adjunto =
  | { tipo: "imagen"; media: string; datos: string }
  | { tipo: "archivo"; texto: string }
  | null

const llamarIA = async (cuerpo: Fila) => {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(90_000),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`IA ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)
  return j as Fila
}

// Aparta una pregunta del limite. Devuelve false si ya no quedan.
const apartar = async (clave: { cliente?: string; anon?: string }, limite: number): Promise<{ ok: boolean; usadas: number }> => {
  if (clave.cliente) {
    const mes = mesActual()
    const { rows } = await pool().query(
      `UPDATE taller.copiloto SET uso_n = CASE WHEN uso_mes = $2 THEN uso_n + 1 ELSE 1 END, uso_mes = $2
        WHERE customer_id = $1 AND (uso_mes IS DISTINCT FROM $2 OR uso_n < $3) RETURNING uso_n`,
      [clave.cliente, mes, limite]
    )
    if (!rows[0]) return { ok: false, usadas: limite }
    return { ok: true, usadas: rows[0].uso_n }
  }
  const dia = diaActual()
  const tot = await pool().query(`SELECT coalesce(sum(n),0)::int AS n FROM taller.copiloto_anon WHERE dia = $1`, [dia])
  if (tot.rows[0].n >= TOPE_ANONIMO_GLOBAL_DIA) return { ok: false, usadas: limite }
  const { rows } = await pool().query(
    `INSERT INTO taller.copiloto_anon (clave, dia, n) VALUES ($1, $2, 1)
       ON CONFLICT (clave, dia) DO UPDATE SET n = taller.copiloto_anon.n + 1 WHERE taller.copiloto_anon.n < $3
     RETURNING n`,
    [clave.anon, dia, limite]
  )
  if (!rows[0]) return { ok: false, usadas: limite }
  return { ok: true, usadas: rows[0].n }
}
const devolver = async (clave: { cliente?: string; anon?: string }) => {
  if (clave.cliente) await pool().query(`UPDATE taller.copiloto SET uso_n = greatest(0, uso_n - 1) WHERE customer_id = $1`, [clave.cliente])
  else await pool().query(`UPDATE taller.copiloto_anon SET n = greatest(0, n - 1) WHERE clave = $1 AND dia = $2`, [clave.anon, diaActual()])
}

export async function copilotoPreguntar(entrada: { mensajes: Mensaje[]; adjunto?: Adjunto; maquina?: Maquina | null }) {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false as const, motivo: "sin_ia", mensaje: "El Copiloto IA se está activando. Mientras, usa las calculadoras." }

  // --- validar lo que manda el navegador ---
  const hist = (Array.isArray(entrada?.mensajes) ? entrada.mensajes : [])
    .filter((m) => m && (m.rol === "usuario" || m.rol === "copiloto") && typeof m.texto === "string" && m.texto.trim())
    .slice(-12)
    .map((m) => ({ rol: m.rol, texto: m.texto.slice(0, m.rol === "usuario" ? 4000 : 3000) }))
  while (hist.length && hist[0].rol !== "usuario") hist.shift()
  if (!hist.length || hist[hist.length - 1].rol !== "usuario") return { ok: false as const, motivo: "vacio", mensaje: "Escribe tu pregunta." }
  let adj = entrada.adjunto || null
  if (adj && adj.tipo === "imagen") {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(adj.media) || typeof adj.datos !== "string" || adj.datos.length > 1_400_000) adj = null
  }
  if (adj && adj.tipo === "archivo") adj = { tipo: "archivo", texto: texto(adj.texto, 12_000) }
  const maquina = entrada.maquina && typeof entrada.maquina === "object" ? entrada.maquina : null

  // --- quien pregunta y cuantas le quedan ---
  const c = await cliente()
  let plan = "anonimo"
  let limite = LIMITE_ANONIMO_DIA
  let costos: Fila | null = null
  const clave: { cliente?: string; anon?: string } = {}
  try {
    if (c) {
      const cta = await cuentaCopiloto(c)
      plan = cta.plan
      limite = cta.limite
      costos = cta.costos
      clave.cliente = c.id
    } else clave.anon = await claveAnonima()
  } catch (e) {
    console.error("[copiloto] cuenta", e)
    return { ok: false as const, motivo: "error", mensaje: "No pude revisar tu cuenta. Intenta de nuevo en un momento." }
  }
  const ap = await apartar(clave, limite)
  if (!ap.ok) {
    return {
      ok: false as const,
      motivo: "limite",
      mensaje: c
        ? `Ya usaste tus ${limite} preguntas de este mes en el plan ${plan}. Las calculadoras siguen gratis e ilimitadas.`
        : `Sin cuenta puedes hacer ${LIMITE_ANONIMO_DIA} preguntas al día. Crea tu cuenta gratis para tener ${LIMITES.gratis} al mes y guardar tu máquina.`,
      uso: { plan, usadas: limite, limite },
    }
  }

  // --- conversacion para la IA ---
  const mensajes: Fila[] = hist.map((m, i) => {
    const ultimo = i === hist.length - 1
    if (!ultimo || !adj) return { role: m.rol === "usuario" ? "user" : "assistant", content: m.texto }
    const bloques: Fila[] = []
    if (adj.tipo === "imagen") bloques.push({ type: "image", source: { type: "base64", media_type: adj.media, data: adj.datos } })
    if (adj.tipo === "archivo") bloques.push({ type: "text", text: adj.texto })
    bloques.push({ type: "text", text: m.texto })
    return { role: "user", content: bloques }
  })
  const modelo = modeloPara(plan)
  const sistema = [
    { type: "text", text: PROMPT, cache_control: { type: "ephemeral" } },
    { type: "text", text: contexto(maquina, costos) },
  ]
  const tools = herramientasIA()
  const calculos: Calculo[] = []
  let tokIn = 0
  let tokOut = 0
  const t0 = Date.now()
  let respuesta = ""
  try {
    for (let ronda = 0; ronda < MAX_RONDAS; ronda++) {
      const r = await llamarIA({ model: modelo, max_tokens: 1800, system: sistema, tools, messages: mensajes })
      tokIn += (r.usage?.input_tokens || 0) + (r.usage?.cache_read_input_tokens || 0) + (r.usage?.cache_creation_input_tokens || 0)
      tokOut += r.usage?.output_tokens || 0
      const bloques: Fila[] = Array.isArray(r.content) ? r.content : []
      const textoR = bloques.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim()
      const usos = bloques.filter((b) => b.type === "tool_use")
      if (r.stop_reason !== "tool_use" || !usos.length) {
        respuesta = textoR
        break
      }
      mensajes.push({ role: "assistant", content: bloques })
      const resultados = usos.map((u) => {
        const res = ejecutar(String(u.name), (u.input || {}) as Record<string, unknown>, maquina)
        calculos.push({ id: String(u.name), resultado: res })
        const { titulo, filas, avisos, faltan, supuestos } = res
        return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify({ titulo, filas, avisos, faltan, supuestos }) }
      })
      mensajes.push({ role: "user", content: resultados })
      if (ronda === MAX_RONDAS - 1) respuesta = textoR || "Hice los cálculos de arriba. ¿Qué más necesitas saber?"
    }
  } catch (e) {
    console.error("[copiloto] ia", e)
    await devolver(clave).catch(() => {})
    return { ok: false as const, motivo: "error", mensaje: "El Copiloto no respondió. No se descontó tu pregunta; intenta de nuevo." }
  }

  // registro para medir costo y mejorar las respuestas
  pool()
    .query(
      `INSERT INTO taller.copiloto_log (customer_id, anon, plan, modelo, pregunta, herramientas, adjunto, tokens_in, tokens_out, ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        clave.cliente || null, clave.anon || null, plan, modelo, hist[hist.length - 1].texto.slice(0, 2000),
        calculos.map((x) => x.id), adj ? adj.tipo : null, tokIn, tokOut, Date.now() - t0,
      ]
    )
    .catch((e) => console.error("[copiloto] log", e))

  return {
    ok: true as const,
    texto: respuesta || "Listo.",
    calculos,
    uso: { plan, usadas: ap.usadas, limite },
  }
}
