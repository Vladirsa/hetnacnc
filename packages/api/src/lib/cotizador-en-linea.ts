// @ts-nocheck
// Cotizador 2.0 · Fase 3 — Cotizador en línea de cada taller.
//
// Página pública hetnacnc.com/t/<slug> (apps/storefront/.../t/[slug]):
//   GET  /api/taller-publico/<slug>            perfil + servicios que ofrece
//   POST /api/taller-publico/<slug>/estimar    precio estimado (lib/cotizador-motor.ts)
//   POST /api/taller-publico/<slug>/solicitar  multipart: datos + archivo
//   GET  /api/taller-publico                   directorio (talleres con página)
// La solicitud crea cliente + cotización en borrador (origen 'en_linea') en
// la base del Cotizador, guarda el archivo en el bucket privado
// "solicitudes" y avisa al taller (alerta, push, correo). Si el taller ya no
// tiene cupo de cotizaciones del mes, la solicitud queda guardada igual
// (estado 'sin_cupo') para convertirla al subir de plan.
//
// La app configura la página con:
//   GET/POST /api/cotizador-pagina   (sesión de Supabase del administrador)
import { createHash, randomUUID } from "crypto"

import { avisarTaller } from "./avisos-taller"
import { FORMULAS_ESTIMABLES, estimar, inferirFormula } from "./cotizador-motor"
import { adminDesdeToken, ErrorSuscripcion, supa } from "./cotizador-suscripciones"
import { sendEmail } from "./resend"

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")
const supaUrl = () => (process.env.COTIZADOR_SUPABASE_URL || "https://ldfmkfbhcbsbecfbzsny.supabase.co").replace(/\/$/, "")
const supaKey = () => process.env.COTIZADOR_SUPABASE_SERVICE_KEY || ""
const MAX_MB = Number(process.env.COTIZADOR_SOLICITUD_MAX_MB || 50)
export const EXTENSIONES = ["dxf", "svg", "stl", "obj", "step", "stp", "dwg", "pdf", "png", "jpg", "jpeg", "ai", "eps", "3mf"]

const slugValido = (s: string) => /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(String(s || ""))
const correoValido = (c: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(c || "").trim())
const limpio = (v, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max)
const esc = (s: string) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const dinero = (n: number, m: string) =>
  `$${Number(n || 0).toLocaleString(m === "USD" ? "en-US" : "es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${m}`

async function intentar<T>(fn: () => Promise<T>, def: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return def
  }
}

// ── Lectura ─────────────────────────────────────────────────────────────
async function negocioPorSlug(slug: string) {
  if (!slugValido(slug)) return null
  const filas = await supa<any[]>(`/rest/v1/negocios?slug=eq.${slug}&select=id,nombre,slug,plan,trial_hasta,telefono,activo&limit=1`)
  const n = filas[0]
  return n && n.activo !== false ? n : null
}

async function paginaDe(negocioId: string) {
  return intentar(async () => (await supa<any[]>(`/rest/v1/negocios_pagina?negocio_id=eq.${negocioId}&select=*&limit=1`))[0] || null, null)
}

async function configDe(negocioId: string) {
  const base = "nombre_comercial,telefono1,correo,logo_url,sitio_web,direccion"
  for (const campos of [`${base},moneda,impuesto_pct`, base]) {
    const r = await intentar(() => supa<any[]>(`/rest/v1/configuracion_empresa?negocio_id=eq.${negocioId}&select=${campos}&limit=1`), null)
    if (r) return r[0] || {}
  }
  return {}
}

/** Servicios del simulador del taller (los suyos y, si no tiene, los de base). */
async function serviciosDe(negocioId: string) {
  let filas = await intentar(
    () =>
      supa<any[]>(
        `/rest/v1/sim_servicios?or=(negocio_id.eq.${negocioId},negocio_id.is.null)&activo=eq.true&select=id,nombre,emoji,descripcion,orden,negocio_id&order=orden.asc`
      ),
    null
  )
  if (!filas) filas = await intentar(() => supa<any[]>(`/rest/v1/sim_servicios?activo=eq.true&select=id,nombre,emoji,descripcion,orden&order=orden.asc`), [])
  // Si el taller tiene su propia copia de un servicio de base, gana la suya
  const porNombre = new Map<string, any>()
  for (const s of filas) {
    const k = String(s.nombre || "").trim().toLowerCase()
    const previo = porNombre.get(k)
    if (!previo || (s.negocio_id && !previo.negocio_id)) porNombre.set(k, s)
  }
  return [...porNombre.values()]
}

async function tiposDe(servicioIds: string[]) {
  if (!servicioIds.length) return []
  const filas = await intentar(() => supa<any[]>(`/rest/v1/sim_tipos_trabajo?servicio_id=in.(${servicioIds.join(",")})&select=*`), [])
  return filas
    .filter((x) => x.activo !== false)
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || String(a.nombre).localeCompare(String(b.nombre), "es"))
    .map((x) => ({
      id: x.id,
      servicio_id: x.servicio_id,
      nombre: x.nombre,
      formula: x.formula || inferirFormula(x.nombre),
      factor: Number(x.factor_complejidad ?? x.factor ?? 1) || 1,
    }))
}

const medidasQuePide = (formula: string) =>
  formula === "por_volumen" ? "3d" : ["por_area", "por_minuto", "por_metro"].includes(formula) ? "2d" : "ninguna"

const costosCache = new Map<string, { valor: any; vence: number }>()
async function costosDe(negocioId: string) {
  const c = costosCache.get(negocioId)
  if (c && c.vence > Date.now()) return c.valor
  const cfg = (await intentar(() => supa<any[]>(`/rest/v1/empresa_config?negocio_id=eq.${negocioId}&select=*&limit=1`), []))[0] || {}
  const n = (v, d) => (v === null || v === undefined || Number.isNaN(Number(v)) ? d : Number(v))
  const horasMes = n(cfg.dias_semana, 6) * 4.33 * n(cfg.horas_dia, 8)
  const costoFijo = n(cfg.costo_fijo_mensual, 0)
  let costoHoraMaquina = 0
  const maq = (await intentar(() => supa<any[]>(`/rest/v1/maquinaria?negocio_id=eq.${negocioId}&activo=eq.true&select=*&limit=1`), []))[0]
  if (maq) {
    const v = n(maq.valor_adquisicion, 0)
    const vida = n(maq["vida_util_años"] ?? maq.vida_util_anos, 10)
    const hrs = n(maq.horas_mes, 160)
    costoHoraMaquina =
      (vida > 0 && hrs > 0 ? v / (vida * 12 * hrs) : 0) + n(maq.consumo_kwh, 0) * n(maq.costo_kwh, 2.5) + (hrs > 0 ? n(maq.mantenimiento_mes, 0) / hrs : 0) + n(maq.consumibles_hora, 0)
  }
  let costoHoraOperador = 0
  const op = (await intentar(() => supa<any[]>(`/rest/v1/mano_obra?negocio_id=eq.${negocioId}&activo=eq.true&select=*&limit=1`), []))[0]
  if (op) {
    const hrs = n(op.horas_mes, 192)
    costoHoraOperador = hrs > 0 ? (n(op.salario_mes, 0) * (1 + n(op.prestaciones_pct, 35) / 100)) / hrs : 0
  }
  const valor = {
    costoHoraTaller: costoFijo > 0 && horasMes > 0 ? costoFijo / horasMes : 0,
    costoHoraMaquina,
    costoHoraOperador,
    margenRecomendado: n(cfg.margen_recomendado, 35),
    margenMinimo: n(cfg.margen_minimo, 20),
    ivaPct: n(cfg.iva_pct, 16),
    mermaPct: n(cfg.merma_pct, 15),
    markupMaterialPct: n(cfg.markup_material_pct, 20),
  }
  costosCache.set(negocioId, { valor, vence: Date.now() + 5 * 60_000 })
  return valor
}

async function datosPublicos(slug: string) {
  const n = await negocioPorSlug(slug)
  if (!n) throw new ErrorSuscripcion("No encontramos este taller.", 404)
  const pagina = await paginaDe(n.id)
  if (!pagina?.activa) throw new ErrorSuscripcion("Este taller todavía no activa su cotizador en línea.", 404)
  const [cfg, todos] = await Promise.all([configDe(n.id), serviciosDe(n.id)])
  const elegidos = Array.isArray(pagina.servicios) && pagina.servicios.length ? todos.filter((s) => pagina.servicios.includes(s.id)) : todos
  const tipos = await tiposDe(elegidos.map((s) => s.id))
  return { n, pagina, cfg, servicios: elegidos, tipos }
}

/** Lo que ve la página pública. Sin tarifas ni costos del taller. */
export async function perfilPublico(slug: string) {
  const { n, pagina, cfg, servicios, tipos } = await datosPublicos(slug)
  const tel = String(cfg.telefono1 || n.telefono || "").replace(/\D/g, "")
  return {
    slug: n.slug,
    nombre: cfg.nombre_comercial || n.nombre,
    titulo: pagina.titulo || cfg.nombre_comercial || n.nombre,
    descripcion: pagina.descripcion || "",
    ciudad: pagina.ciudad || "",
    logo: cfg.logo_url || null,
    sitio: cfg.sitio_web || null,
    whatsapp: tel.length >= 10 ? tel : null,
    moneda: String(cfg.moneda || "MXN").toUpperCase() === "USD" ? "USD" : "MXN",
    mostrar_precio: pagina.mostrar_precio !== false,
    extensiones: EXTENSIONES,
    max_mb: MAX_MB,
    servicios: servicios
      .map((s) => ({
        id: s.id,
        nombre: s.nombre,
        emoji: s.emoji || "🔧",
        descripcion: s.descripcion || "",
        tipos: tipos
          .filter((x) => x.servicio_id === s.id)
          .map((x) => ({
            id: x.id,
            nombre: x.nombre,
            estimable: FORMULAS_ESTIMABLES.includes(x.formula),
            medidas: medidasQuePide(x.formula),
          })),
      }))
      .filter((s) => s.tipos.length),
  }
}

async function tarifasDe(servicioId: string) {
  const [tar, ran] = await Promise.all([
    intentar(() => supa<any[]>(`/rest/v1/sim_tarifas?servicio_id=eq.${servicioId}&select=clave,valor`), []),
    intentar(() => supa<any[]>(`/rest/v1/sim_rangos?servicio_id=eq.${servicioId}&select=*&order=indice_desde.asc`), []),
  ])
  return {
    tarifas: Object.fromEntries(tar.map((x) => [x.clave, Number(x.valor) || 0])),
    rangos: ran.map((r) => ({
      desde: Number(r.indice_desde ?? r.desde ?? 0),
      hasta: Number(r.indice_hasta ?? r.hasta ?? 999999),
      precio: Number(r.precio) || 0,
    })),
  }
}

function leerMedidas(m: any) {
  const num = (v, max: number) => Math.min(max, Math.max(0, Number(v) || 0))
  return {
    largo: num(m?.largo, 100_000),
    ancho: num(m?.ancho, 100_000),
    alto: num(m?.alto, 100_000),
    corte_mm: num(m?.corte_mm, 100_000_000),
    perforaciones: Math.round(num(m?.perforaciones, 100_000)),
    volumen_cm3: num(m?.volumen_cm3, 100_000_000),
  }
}

async function calcular(datos, servicioId: string, tipoId: string, medidas, cantidad: number) {
  const servicio = datos.servicios.find((s) => s.id === servicioId)
  const tipo = datos.tipos.find((x) => x.id === tipoId && x.servicio_id === servicioId)
  if (!servicio || !tipo) throw new ErrorSuscripcion("Elige un servicio y un tipo de trabajo.")
  const [{ tarifas, rangos }, costos] = await Promise.all([tarifasDe(servicio.id), costosDe(datos.n.id)])
  return { servicio, tipo, r: estimar({ tipo, tarifas, rangos, costos, medidas, cantidad }) }
}

export async function estimarPublico(slug: string, b: any) {
  const datos = await datosPublicos(slug)
  const cantidad = Math.max(1, Math.min(10000, Math.round(Number(b?.cantidad) || 1)))
  const { r } = await calcular(datos, String(b?.servicio_id || ""), String(b?.tipo_id || ""), leerMedidas(b?.medidas), cantidad)
  const moneda = String(datos.cfg.moneda || "MXN").toUpperCase() === "USD" ? "USD" : "MXN"
  if (datos.pagina.mostrar_precio === false) return { estimable: false, oculto: true, motivo: "El taller revisa tu archivo y te manda el precio." }
  if (!r.estimable) return { estimable: false, motivo: r.motivo }
  return { estimable: true, moneda, minimo: r.minimo, recomendado: r.recomendado, iva_pct: r.ivaPct, horas: r.horas }
}

// ── Solicitud ───────────────────────────────────────────────────────────
const hashIp = (ip: string) => createHash("sha256").update(`${ip}|${supaKey().slice(-12)}`).digest("hex").slice(0, 32)

async function subirArchivo(negocioId: string, solicitudId: string, archivo) {
  const ext = String(archivo.originalname || "").split(".").pop()?.toLowerCase() || ""
  if (!EXTENSIONES.includes(ext)) throw new ErrorSuscripcion(`Ese tipo de archivo no se acepta. Usa: ${EXTENSIONES.join(", ")}.`)
  const nombre = String(archivo.originalname || `archivo.${ext}`)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(-80)
  const ruta = `${negocioId}/${solicitudId}/${nombre}`
  const r = await fetch(`${supaUrl()}/storage/v1/object/solicitudes/${ruta}`, {
    method: "POST",
    headers: {
      apikey: supaKey(),
      Authorization: `Bearer ${supaKey()}`,
      "Content-Type": archivo.mimetype || "application/octet-stream",
      "x-upsert": "false",
    },
    body: archivo.buffer,
    signal: AbortSignal.timeout(60_000),
  })
  if (!r.ok) throw new Error(`Storage ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return { ruta, nombre: String(archivo.originalname || nombre).slice(0, 120) }
}

async function clienteParaSolicitud(negocioId: string, d) {
  const digitos = d.telefono.replace(/\D/g, "").slice(-10)
  const condiciones = []
  if (digitos.length === 10) condiciones.push(`whatsapp.ilike.*${digitos}`, `telefono.ilike.*${digitos}`)
  if (d.correo) condiciones.push(`correo.eq.${encodeURIComponent(d.correo)}`)
  if (condiciones.length) {
    const existentes = await intentar(
      () => supa<any[]>(`/rest/v1/clientes?negocio_id=eq.${negocioId}&or=(${condiciones.join(",")})&select=id&limit=1`),
      []
    )
    if (existentes[0]) return existentes[0].id
  }
  const fila = {
    negocio_id: negocioId,
    nombre: d.nombre,
    empresa: d.empresa || null,
    telefono: d.telefono || null,
    whatsapp: d.telefono || null,
    correo: d.correo || null,
    tipo_cliente: "Cliente potencial",
    notas: "Llegó por tu cotizador en línea (hetnacnc.com)",
  }
  const nuevo = await supa<any[]>(`/rest/v1/clientes`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(fila) })
  return nuevo?.[0]?.id || null
}

function textoMedidas(m) {
  const partes = []
  if (m.largo && m.ancho) partes.push(`${Math.round(m.largo)} × ${Math.round(m.ancho)}${m.alto ? ` × ${Math.round(m.alto)}` : ""} mm`)
  if (m.corte_mm) partes.push(`corte ${(m.corte_mm / 1000).toFixed(2)} m`)
  if (m.perforaciones) partes.push(`${m.perforaciones} perforaciones`)
  if (m.volumen_cm3) partes.push(`volumen ${Math.round(m.volumen_cm3)} cm³`)
  return partes.join(" · ")
}

async function crearCotizacion(negocioId: string, clienteId: string | null, p) {
  const sub = p.estimado || 0
  const iva = Math.round(sub * (p.ivaPct / 100) * 100) / 100
  const fila: Record<string, any> = {
    negocio_id: negocioId,
    cliente_id: clienteId,
    estado: "Borrador",
    subtotal: sub,
    iva_pct: p.ivaPct,
    iva_monto: iva,
    total: Math.round((sub + iva) * 100) / 100,
    vigencia_dias: 7,
    notas: p.notas,
    origen: "en_linea",
    archivo_ruta: p.archivo?.ruta || null,
    archivo_nombre: p.archivo?.nombre || null,
  }
  const insertar = (f) => supa<any[]>(`/rest/v1/cotizaciones`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(f) })
  let filas
  try {
    filas = await insertar(fila)
  } catch (e) {
    const msg = (e as Error).message
    if (/SIN_CUPO/.test(msg)) return { sinCupo: true }
    if (!/origen|archivo_ruta|archivo_nombre|column/i.test(msg)) throw e
    const { origen, archivo_ruta, archivo_nombre, ...resto } = fila
    filas = await insertar(resto)
  }
  const cot = filas?.[0]
  if (!cot) return { sinCupo: false, cot: null }
  await supa(`/rest/v1/cotizacion_items`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      cotizacion_id: cot.id,
      nombre_producto: p.partida,
      descripcion: p.descripcion,
      cantidad: p.cantidad,
      precio_unitario: p.cantidad > 0 ? Math.round((sub / p.cantidad) * 100) / 100 : sub,
      descuento_item_pct: 0,
      subtotal: sub,
    }),
  }).catch(() => {})
  return { sinCupo: false, cot }
}

export async function solicitar(slug: string, campos: Record<string, any>, archivo, ip: string, logger?: any) {
  // Trampa para robots: un campo oculto que una persona no llena
  if (limpio(campos.sitio_web, 200)) return { ok: true }
  const datos = await datosPublicos(slug)
  const negocioId = datos.n.id
  const d = {
    nombre: limpio(campos.nombre, 120),
    empresa: limpio(campos.empresa, 120),
    telefono: limpio(campos.telefono, 30),
    correo: limpio(campos.correo, 160).toLowerCase(),
    mensaje: String(campos.mensaje ?? "").replace(/\r/g, "").trim().slice(0, 2000),
  }
  if (!d.nombre) throw new ErrorSuscripcion("Escribe tu nombre.")
  if (d.telefono.replace(/\D/g, "").length < 10 && !correoValido(d.correo))
    throw new ErrorSuscripcion("Déjanos un WhatsApp (10 dígitos) o un correo para mandarte la cotización.")
  if (d.correo && !correoValido(d.correo)) throw new ErrorSuscripcion("Revisa tu correo.")

  // Límites: 5 por hora desde la misma conexión y 60 al día por taller
  const ipHash = hashIp(ip || "sin-ip")
  const hora = new Date(Date.now() - 3_600_000).toISOString()
  const dia = new Date(Date.now() - 86_400_000).toISOString()
  const [porIp, porTaller] = await Promise.all([
    intentar(() => supa<any[]>(`/rest/v1/solicitudes_en_linea?ip_hash=eq.${ipHash}&creado=gt.${hora}&select=id`), []),
    intentar(() => supa<any[]>(`/rest/v1/solicitudes_en_linea?negocio_id=eq.${negocioId}&creado=gt.${dia}&select=id`), []),
  ])
  if (porIp.length >= 5) throw new ErrorSuscripcion("Ya mandaste varias solicitudes. Intenta en un rato o escríbele al taller.", 429)
  if (porTaller.length >= 60) throw new ErrorSuscripcion("El taller recibió muchas solicitudes hoy. Escríbele por WhatsApp.", 429)

  const cantidad = Math.max(1, Math.min(10000, Math.round(Number(campos.cantidad) || 1)))
  let medidas = {}
  try {
    medidas = leerMedidas(typeof campos.medidas === "string" ? JSON.parse(campos.medidas) : campos.medidas)
  } catch {
    medidas = leerMedidas({})
  }
  const servicioId = String(campos.servicio_id || "")
  const tipoId = String(campos.tipo_id || "")
  let servicio = null
  let tipo = null
  let estimado = null
  if (servicioId && tipoId) {
    const c = await calcular(datos, servicioId, tipoId, medidas, cantidad)
    servicio = c.servicio
    tipo = c.tipo
    if (c.r.estimable) estimado = c.r.recomendado
  }
  const costos = await costosDe(negocioId)
  const moneda = String(datos.cfg.moneda || "MXN").toUpperCase() === "USD" ? "USD" : "MXN"

  const solicitudId = randomUUID()
  let archivoGuardado = null
  if (archivo?.buffer?.length) archivoGuardado = await subirArchivo(negocioId, solicitudId, archivo)

  const clienteId = await clienteParaSolicitud(negocioId, d).catch((e) => {
    logger?.warn?.(`[en-linea] cliente ${negocioId}: ${(e as Error).message}`)
    return null
  })

  const med = textoMedidas(medidas)
  const partida = servicio ? `${servicio.emoji || "🔧"} ${servicio.nombre} — ${tipo.nombre}` : "Solicitud en línea"
  const descripcion = [med, archivoGuardado ? `Archivo: ${archivoGuardado.nombre}` : "", d.mensaje].filter(Boolean).join("\n")
  const notas =
    `🌐 Solicitud desde tu cotizador en línea.\n` +
    (estimado ? `Precio estimado automático: ${dinero(estimado, moneda)} + IVA (revísalo antes de mandarla).\n` : "Sin precio automático: pon tú el precio.\n") +
    (d.mensaje ? `Mensaje del cliente: ${d.mensaje}` : "")

  let resultado = { sinCupo: false, cot: null }
  try {
    resultado = await crearCotizacion(negocioId, clienteId, {
      estimado,
      ivaPct: costos.ivaPct,
      notas,
      partida,
      descripcion,
      cantidad,
      archivo: archivoGuardado,
    })
  } catch (e) {
    logger?.warn?.(`[en-linea] cotización ${negocioId}: ${(e as Error).message}`)
  }

  await supa(`/rest/v1/solicitudes_en_linea`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: solicitudId,
      negocio_id: negocioId,
      cotizacion_id: resultado.cot?.id || null,
      cliente_id: clienteId,
      nombre: d.nombre,
      telefono: d.telefono || null,
      correo: d.correo || null,
      empresa: d.empresa || null,
      servicio: servicio?.nombre || null,
      tipo: tipo?.nombre || null,
      cantidad,
      medidas,
      archivo_ruta: archivoGuardado?.ruta || null,
      archivo_nombre: archivoGuardado?.nombre || null,
      estimado,
      moneda,
      mensaje: d.mensaje || null,
      estado: resultado.sinCupo ? "sin_cupo" : resultado.cot ? "cotizada" : "nueva",
      ip_hash: ipHash,
    }),
  })

  const taller = datos.cfg.nombre_comercial || datos.n.nombre
  await avisarTaller(
    {
      negocioId,
      tipo: "solicitud_en_linea",
      titulo: `🌐 Nueva solicitud de ${d.nombre}${servicio ? `: ${servicio.nombre}` : ""}`,
      cuerpo: resultado.sinCupo
        ? "Te llegó un cliente por tu página, pero ya usaste las cotizaciones de tu plan este mes. Sube de plan para convertirla en cotización (sus datos y su archivo quedaron guardados)."
        : `${cantidad} pieza(s)${med ? ` · ${med}` : ""}${estimado ? ` · estimado ${dinero(estimado, moneda)} + IVA` : ""}. Ya está en Cotizar como borrador${archivoGuardado ? " con su archivo" : ""}: revísala y mándale la liga.`,
      cotizacionId: resultado.cot?.id || null,
      clienteId,
      mensajeCliente: `Hola ${d.nombre.split(" ")[0]} 👋 Recibimos tu solicitud en ${taller}. En un momento te mando tu cotización.`,
      liga: `${SITIO}/cotizador/`,
      boton: "Abrir el Cotizador",
    },
    logger
  )

  // Acuse para el cliente (correo transaccional, sale con el nombre del taller)
  if (correoValido(d.correo)) {
    const cfgCorreo = correoValido(datos.cfg.correo) ? String(datos.cfg.correo).trim() : undefined
    sendEmail({
      to: d.correo,
      subject: `Recibimos tu solicitud — ${taller}`,
      de: taller,
      responderA: cfgCorreo,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1B1B18">
  <h2 style="margin:0 0 10px;font-size:20px;color:#142033">¡Gracias, ${esc(d.nombre.split(" ")[0])}!</h2>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.5">Recibimos tu solicitud${servicio ? ` de <b>${esc(servicio.nombre)}</b>` : ""}${archivoGuardado ? ` con tu archivo <b>${esc(archivoGuardado.nombre)}</b>` : ""}. Te mandamos la cotización en cuanto la revisemos${d.telefono ? " por WhatsApp" : " a este correo"}.</p>
  ${estimado && datos.pagina.mostrar_precio !== false ? `<p style="margin:0 0 12px;font-size:15px">Precio estimado: <b>${esc(dinero(estimado, moneda))}</b> + IVA. El precio final lo confirma el taller.</p>` : ""}
  <p style="margin:18px 0 0;font-size:12px;color:#7A776E">${esc(taller)} · cotizador en línea en hetnacnc.com</p>
</div>`,
    }).catch(() => {})
  }

  return {
    ok: true,
    mensaje: d.telefono
      ? `Listo, ${taller} recibió tu solicitud y te escribe por WhatsApp con tu cotización.`
      : `Listo, ${taller} recibió tu solicitud y te manda la cotización por correo.`,
  }
}

// ── Directorio ───────────────────────────────────────────────────────────
export async function directorio() {
  const paginas = await intentar(
    () => supa<any[]>(`/rest/v1/negocios_pagina?activa=eq.true&en_directorio=eq.true&select=negocio_id,titulo,descripcion,ciudad&limit=300`),
    []
  )
  if (!paginas.length) return { talleres: [] }
  const ids = paginas.map((p) => p.negocio_id)
  const [negs, cfgs] = await Promise.all([
    supa<any[]>(`/rest/v1/negocios?id=in.(${ids.join(",")})&activo=eq.true&select=id,nombre,slug`),
    intentar(() => supa<any[]>(`/rest/v1/configuracion_empresa?negocio_id=in.(${ids.join(",")})&select=negocio_id,nombre_comercial,logo_url`), []),
  ])
  const cfg = new Map(cfgs.map((c) => [c.negocio_id, c]))
  const pag = new Map(paginas.map((p) => [p.negocio_id, p]))
  return {
    talleres: negs
      .filter((n) => slugValido(n.slug))
      .map((n) => ({
        slug: n.slug,
        nombre: pag.get(n.id)?.titulo || cfg.get(n.id)?.nombre_comercial || n.nombre,
        descripcion: pag.get(n.id)?.descripcion || "",
        ciudad: pag.get(n.id)?.ciudad || "",
        logo: cfg.get(n.id)?.logo_url || null,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  }
}

// ── Configuración desde la app (administrador) ──────────────────────────
export async function paginaDelTaller(sesion: string | undefined) {
  const { negocio } = await adminDesdeToken(sesion)
  const [n, pagina, servicios] = await Promise.all([
    supa<any[]>(`/rest/v1/negocios?id=eq.${negocio.id}&select=slug,nombre&limit=1`).then((r) => r[0] || {}),
    intentar(async () => (await supa<any[]>(`/rest/v1/negocios_pagina?negocio_id=eq.${negocio.id}&select=*&limit=1`))[0] || {}, null),
    serviciosDe(negocio.id),
  ])
  return {
    tabla_lista: pagina !== null,
    slug: n.slug || "",
    url: n.slug ? `${SITIO}/t/${n.slug}` : null,
    pagina: {
      activa: Boolean(pagina?.activa),
      titulo: pagina?.titulo || "",
      descripcion: pagina?.descripcion || "",
      ciudad: pagina?.ciudad || "",
      servicios: Array.isArray(pagina?.servicios) ? pagina.servicios : [],
      mostrar_precio: pagina ? pagina.mostrar_precio !== false : true,
      en_directorio: pagina ? pagina.en_directorio !== false : true,
    },
    servicios: servicios.map((s) => ({ id: s.id, nombre: s.nombre, emoji: s.emoji || "🔧" })),
  }
}

export async function guardarPaginaTaller(sesion: string | undefined, b: Record<string, any>) {
  const { negocio } = await adminDesdeToken(sesion)
  // Liga: sólo minúsculas, números y guiones; única entre todos los talleres
  if (typeof b.slug === "string") {
    const slug = b.slug
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
    if (!slugValido(slug) || slug.length < 3) throw new ErrorSuscripcion("La liga debe tener de 3 a 60 letras o números (sin espacios).")
    const actual = (await supa<any[]>(`/rest/v1/negocios?id=eq.${negocio.id}&select=slug&limit=1`))[0]?.slug
    if (slug !== actual) {
      const otro = await supa<any[]>(`/rest/v1/negocios?slug=eq.${slug}&select=id&limit=1`)
      if (otro.length) throw new ErrorSuscripcion("Esa liga ya la usa otro taller. Prueba con otra.")
      await supa(`/rest/v1/negocios?id=eq.${negocio.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ slug }),
      })
    }
  }
  const fila: Record<string, any> = { negocio_id: negocio.id, actualizado: new Date().toISOString() }
  if (typeof b.activa === "boolean") fila.activa = b.activa
  if (typeof b.mostrar_precio === "boolean") fila.mostrar_precio = b.mostrar_precio
  if (typeof b.en_directorio === "boolean") fila.en_directorio = b.en_directorio
  if (typeof b.titulo === "string") fila.titulo = limpio(b.titulo, 80) || null
  if (typeof b.descripcion === "string") fila.descripcion = String(b.descripcion).trim().slice(0, 400) || null
  if (typeof b.ciudad === "string") fila.ciudad = limpio(b.ciudad, 60) || null
  if (Array.isArray(b.servicios)) fila.servicios = b.servicios.filter((x) => /^[0-9a-f-]{36}$/i.test(String(x))).slice(0, 50)
  await supa(`/rest/v1/negocios_pagina?on_conflict=negocio_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(fila),
  })
  return paginaDelTaller(sesion)
}
