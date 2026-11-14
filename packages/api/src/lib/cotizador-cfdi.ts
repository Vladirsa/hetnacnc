// @ts-nocheck
// Cotizador 2.0 · Fase 4 — Factura electrónica (CFDI 4.0) desde la app.
//
// Facturapi en modo multi-organización: HETNA tiene UNA cuenta (llave de
// usuario) y cada taller es una "organización" con su RFC y su CSD. El taller
// no contrata nada: captura sus datos fiscales y sube su CSD una vez, y
// factura sus pedidos con un toque. Las llaves de cada organización las
// guarda sólo el servidor (tabla negocios_facturapi, sin acceso desde la app).
//
// Rutas (sesión de Supabase del taller):
//   GET  /api/cotizador-cfdi                    estado, datos, cupo del mes
//   POST /api/cotizador-cfdi/datos              datos fiscales (crea la organización)
//   POST /api/cotizador-cfdi/certificado        CSD: cer + key + contraseña (multipart)
//   POST /api/cotizador-cfdi/emitir             factura de un pedido
//   GET  /api/cotizador-cfdi/:id/pdf | /xml     descargar
//   POST /api/cotizador-cfdi/:id/enviar         mandar por correo
//   POST /api/cotizador-cfdi/:id/cancelar       cancelar (motivo 02 o 03)
//
// Facturas incluidas por plan (al mes, sólo modo real): Taller 30, Pro 150,
// Industrial sin límite, prueba vigente 10. Las extra se anotan a
// COTIZADOR_CFDI_EXTRA ($2) y se cobran en el corte del día 1
// (lib/cotizador-comisiones.ts).
//
// Variables (.env de packages/api):
//   FACTURAPI_USER_KEY   llave secreta de USUARIO (sk_user_...), dashboard.facturapi.io/integration
//   FACTURAPI_MODO       "prueba" (por defecto: facturas sin validez, gratis) o "real"
import { ErrorSuscripcion, supa } from "./cotizador-suscripciones"

const API = "https://www.facturapi.io/v2"
const llaveUsuario = () => process.env.FACTURAPI_USER_KEY || ""
export const modoCfdi = () => ((process.env.FACTURAPI_MODO || "prueba").toLowerCase() === "real" ? "real" : "prueba")
export const cfdiDisponible = () => Boolean(llaveUsuario() && process.env.COTIZADOR_SUPABASE_SERVICE_KEY)
const PRECIO_EXTRA = Number(process.env.COTIZADOR_CFDI_EXTRA || 2)
const supaUrl = () => (process.env.COTIZADOR_SUPABASE_URL || "https://ldfmkfbhcbsbecfbzsny.supabase.co").replace(/\/$/, "")
const supaKey = () => process.env.COTIZADOR_SUPABASE_SERVICE_KEY || ""

const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
const limpio = (v, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max)
const r2 = (n: number) => Math.round(n * 100) / 100

// ── Facturapi ──────────────────────────────────────────────────────────
async function fapi<T = any>(ruta: string, llave: string, init: RequestInit = {}, binario = false): Promise<T> {
  const r = await fetch(`${API}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${llave}`,
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(45_000),
  })
  if (binario && r.ok) return Buffer.from(await r.arrayBuffer()) as any
  const texto = await r.text()
  let cuerpo: any = texto
  try {
    cuerpo = texto ? JSON.parse(texto) : {}
  } catch {
    // respuesta en texto plano (p. ej. una llave)
  }
  if (!r.ok) {
    const msg = (typeof cuerpo === "object" && (cuerpo.message || cuerpo.error)) || `HTTP ${r.status}`
    // Los errores de Facturapi explican qué dato está mal (RFC, régimen, CP...): se le muestran al taller
    throw new ErrorSuscripcion(`Facturación: ${msg}`, r.status >= 500 ? 502 : 400)
  }
  return cuerpo as T
}

// ── Sesión: cualquier usuario activo del taller ────────────────────────
async function tallerDeSesion(token: string | undefined, soloAdmin = false) {
  if (!token) throw new ErrorSuscripcion("Inicia sesión en el Cotizador.", 401)
  const r = await fetch(`${supaUrl()}/auth/v1/user`, {
    headers: { apikey: supaKey(), Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) throw new ErrorSuscripcion("Tu sesión expiró. Vuelve a iniciar sesión.", 401)
  const user = (await r.json()) as { id: string }
  const filas = await supa<any[]>(`/rest/v1/usuarios_negocio?user_id=eq.${user.id}&activo=eq.true&select=negocio_id,rol&limit=1`)
  const fila = filas[0]
  if (!fila) throw new ErrorSuscripcion("Tu cuenta no tiene taller.", 403)
  if (soloAdmin && !["administrador", "super_admin"].includes(fila.rol))
    throw new ErrorSuscripcion("Sólo el administrador del taller puede cambiar los datos fiscales.", 403)
  const n = (await supa<any[]>(`/rest/v1/negocios?id=eq.${fila.negocio_id}&select=id,nombre,plan,trial_hasta&limit=1`))[0]
  if (!n) throw new ErrorSuscripcion("No encontramos tu taller.", 404)
  return n
}

export function facturasIncluidas(n): number | null {
  const p = String(n?.plan || "")
  if (p === "industrial" || p === "master") return null
  if (p === "pro" || p === "premium") return 150
  if (p === "taller") return 30
  if ((p === "trial" || p === "prueba") && n?.trial_hasta && new Date(n.trial_hasta) > new Date()) return 10
  return 0
}

async function registroDe(negocioId: string) {
  try {
    return (await supa<any[]>(`/rest/v1/negocios_facturapi?negocio_id=eq.${negocioId}&select=*&limit=1`))[0] || null
  } catch {
    throw new ErrorSuscripcion("Falta activar la facturación en el servidor (supabase/fase4_factura_costos_mantenimiento.sql).", 503)
  }
}

async function guardarRegistro(negocioId: string, cambios: Record<string, any>) {
  await supa(`/rest/v1/negocios_facturapi?on_conflict=negocio_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ negocio_id: negocioId, ...cambios, actualizado: new Date().toISOString() }),
  })
}

const inicioMesMx = () => {
  const mx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }))
  return new Date(Date.UTC(mx.getFullYear(), mx.getMonth(), 1, 6, 0, 0)).toISOString()
}

async function usadasEsteMes(negocioId: string) {
  const filas = await supa<any[]>(
    `/rest/v1/cfdi_emitidos?negocio_id=eq.${negocioId}&modo=eq.real&creado=gte.${encodeURIComponent(inicioMesMx())}&select=id`
  )
  return filas.length
}

/** Llave de la organización para el modo actual (la pide a Facturapi la primera vez). */
async function llaveDe(reg, modo = modoCfdi()) {
  if (modo === "prueba") {
    if (reg.llave_prueba) return reg.llave_prueba
    const k = await fapi<any>(`/organizations/${reg.org_id}/apikeys/test`, llaveUsuario())
    const llave = typeof k === "string" ? k : k?.key || k?.api_key
    if (!llave) throw new Error("Facturapi no devolvió la llave de prueba")
    await guardarRegistro(reg.negocio_id, { org_id: reg.org_id, llave_prueba: llave })
    return llave
  }
  if (reg.llave_real) return reg.llave_real
  let k
  try {
    k = await fapi<any>(`/organizations/${reg.org_id}/apikeys/live`, llaveUsuario(), { method: "POST" })
  } catch {
    k = await fapi<any>(`/organizations/${reg.org_id}/apikeys/live`, llaveUsuario(), { method: "PUT" })
  }
  const llave = typeof k === "string" ? k : k?.key || k?.api_key
  if (!llave) throw new Error("Facturapi no devolvió la llave real")
  await guardarRegistro(reg.negocio_id, { org_id: reg.org_id, llave_real: llave })
  return llave
}

// ── Estado y configuración ─────────────────────────────────────────────
const REGIMENES = {
  "601": "General de Ley Personas Morales",
  "603": "Personas Morales con Fines no Lucrativos",
  "605": "Sueldos y Salarios",
  "606": "Arrendamiento",
  "612": "Personas Físicas con Actividades Empresariales y Profesionales",
  "616": "Sin obligaciones fiscales",
  "621": "Incorporación Fiscal",
  "625": "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas",
  "626": "Régimen Simplificado de Confianza (RESICO)",
}

export async function estadoCfdi(token: string | undefined) {
  const n = await tallerDeSesion(token)
  const incluidas = facturasIncluidas(n)
  const base = {
    disponible: cfdiDisponible(),
    modo: modoCfdi(),
    plan_permite: incluidas !== 0,
    cupo: { incluidas, usadas: 0, precio_extra: PRECIO_EXTRA },
    regimenes: REGIMENES,
  }
  if (!cfdiDisponible()) return { ...base, configurado: false, listo: false, pendientes: ["La facturación se está activando en HETNA."] }
  const reg = await registroDe(n.id)
  const usadas = await usadasEsteMes(n.id).catch(() => 0)
  if (!reg) return { ...base, cupo: { ...base.cupo, usadas }, configurado: false, listo: false, pendientes: ["Captura tus datos fiscales.", "Sube tu CSD (.cer, .key y contraseña)."] }
  let org: any = {}
  try {
    org = await fapi<any>(`/organizations/${reg.org_id}`, llaveUsuario())
  } catch {
    org = {}
  }
  const pendientes = (org.pending_steps || []).map((p) => p.description || p.type).filter(Boolean)
  const tieneCsd = Boolean(org.certificate?.expires_at || reg.csd_vence)
  return {
    ...base,
    cupo: { ...base.cupo, usadas },
    configurado: true,
    // En prueba basta con datos + CSD; en real Facturapi dice si ya está lista
    listo: modoCfdi() === "real" ? org.is_production_ready === true : Boolean(reg.razon_social && tieneCsd),
    pendientes: pendientes.length ? pendientes : tieneCsd ? [] : ["Sube tu CSD (.cer, .key y contraseña)."],
    datos: {
      razon_social: reg.razon_social || org.legal?.legal_name || "",
      rfc: reg.rfc || org.legal?.tax_id || "",
      regimen: reg.regimen || org.legal?.tax_system || "",
      cp: reg.cp || org.legal?.address?.zip || "",
      csd_vence: org.certificate?.expires_at || reg.csd_vence || null,
      clave_producto: reg.config?.clave_producto || "01010101",
      clave_unidad: reg.config?.clave_unidad || "E48",
      serie: reg.config?.serie || "A",
    },
  }
}

export async function guardarDatosFiscales(token: string | undefined, b: Record<string, any>) {
  if (!cfdiDisponible()) throw new ErrorSuscripcion("La facturación se está activando en HETNA. Intenta más tarde.", 503)
  const n = await tallerDeSesion(token, true)
  const razon = limpio(b.razon_social, 254).toUpperCase()
  const regimen = String(b.regimen || "")
  const cp = String(b.cp || "").replace(/\D/g, "")
  if (!razon) throw new ErrorSuscripcion("Escribe tu razón social tal como aparece en tu Constancia de Situación Fiscal (sin S.A. de C.V. al final si eres persona moral).")
  if (!REGIMENES[regimen]) throw new ErrorSuscripcion("Elige tu régimen fiscal.")
  if (cp.length !== 5) throw new ErrorSuscripcion("El código postal fiscal debe tener 5 dígitos.")
  const config = {
    clave_producto: /^\d{8}$/.test(String(b.clave_producto || "")) ? String(b.clave_producto) : "01010101",
    clave_unidad: /^[A-Z0-9]{2,3}$/.test(String(b.clave_unidad || "")) ? String(b.clave_unidad) : "E48",
    serie: /^[A-Z]{1,10}$/.test(String(b.serie || "").toUpperCase()) ? String(b.serie).toUpperCase() : "A",
  }

  let reg = await registroDe(n.id)
  if (!reg) {
    const cfg = (await supa<any[]>(`/rest/v1/configuracion_empresa?negocio_id=eq.${n.id}&select=nombre_comercial&limit=1`).catch(() => []))[0]
    const org = await fapi<any>(`/organizations`, llaveUsuario(), {
      method: "POST",
      body: JSON.stringify({ name: limpio(cfg?.nombre_comercial || n.nombre || razon, 100) }),
    })
    await guardarRegistro(n.id, { org_id: org.id })
    reg = { negocio_id: n.id, org_id: org.id }
  }
  await fapi(`/organizations/${reg.org_id}/legal`, llaveUsuario(), {
    method: "PUT",
    body: JSON.stringify({ legal_name: razon, tax_system: regimen, address: { zip: cp } }),
  })
  await guardarRegistro(n.id, { org_id: reg.org_id, razon_social: razon, regimen, cp, config })
  return estadoCfdi(token)
}

export async function subirCsd(token: string | undefined, archivos: Record<string, any[]>, password: string) {
  if (!cfdiDisponible()) throw new ErrorSuscripcion("La facturación se está activando en HETNA. Intenta más tarde.", 503)
  const n = await tallerDeSesion(token, true)
  const reg = await registroDe(n.id)
  if (!reg) throw new ErrorSuscripcion("Primero guarda tus datos fiscales.")
  const cer = archivos?.cer?.[0]
  const key = archivos?.key?.[0]
  if (!cer?.buffer?.length || !key?.buffer?.length) throw new ErrorSuscripcion("Sube los dos archivos del CSD: el .cer y el .key.")
  if (!/\.cer$/i.test(cer.originalname || "") || !/\.key$/i.test(key.originalname || ""))
    throw new ErrorSuscripcion("Revisa los archivos: uno termina en .cer y el otro en .key.")
  if (!String(password || "").trim()) throw new ErrorSuscripcion("Escribe la contraseña de tu CSD.")
  const fd = new FormData()
  fd.append("cer", new Blob([cer.buffer]), cer.originalname)
  fd.append("key", new Blob([key.buffer]), key.originalname)
  fd.append("password", String(password))
  const org = await fapi<any>(`/organizations/${reg.org_id}/certificate`, llaveUsuario(), { method: "PUT", body: fd })
  // El RFC lo saca Facturapi del certificado
  await guardarRegistro(n.id, {
    org_id: reg.org_id,
    rfc: org?.legal?.tax_id || reg.rfc || null,
    csd_vence: org?.certificate?.expires_at || null,
    // la llave real cambia al estar lista: se pide de nuevo al emitir
    llave_real: null,
  })
  return estadoCfdi(token)
}

// ── Emitir ─────────────────────────────────────────────────────────────
// Un pedido sólo se timbra una vez a la vez: con dos clics seguidos (o dos
// pestañas) las dos peticiones pasaban la revisión de "ya tiene factura" antes
// de que la primera la guardara, y salían dos CFDI (auditoría del 14 nov 2026).
// El API corre en un solo proceso (pm2), así que basta un candado en memoria.
const timbrando = new Set<string>()

export async function emitirFactura(token: string | undefined, b: Record<string, any>, logger?: any) {
  const llaveCandado = String(b?.pedido_id || "")
  if (llaveCandado && timbrando.has(llaveCandado)) {
    throw new ErrorSuscripcion("Esta factura ya se está emitiendo. Espera unos segundos.", 409)
  }
  if (llaveCandado) timbrando.add(llaveCandado)
  try {
    return await emitirFacturaUnaVez(token, b, logger)
  } finally {
    if (llaveCandado) timbrando.delete(llaveCandado)
  }
}

async function emitirFacturaUnaVez(token: string | undefined, b: Record<string, any>, logger?: any) {
  if (!cfdiDisponible()) throw new ErrorSuscripcion("La facturación se está activando en HETNA. Intenta más tarde.", 503)
  const n = await tallerDeSesion(token)
  const incluidas = facturasIncluidas(n)
  if (incluidas === 0) throw new ErrorSuscripcion("La factura electrónica viene desde el plan Taller.", 402)
  const reg = await registroDe(n.id)
  if (!reg?.razon_social) throw new ErrorSuscripcion("Primero configura tus datos fiscales y tu CSD en Configuración → Factura electrónica.")
  const modo = modoCfdi()

  // Receptor
  const rfc = String(b.rfc || "").toUpperCase().replace(/\s/g, "")
  const razon = limpio(b.razon_social, 254).toUpperCase()
  const cp = String(b.cp || "").replace(/\D/g, "")
  const regimen = String(b.regimen || "")
  const uso = String(b.uso || "G03")
  const correo = limpio(b.correo, 160).toLowerCase()
  if (!RFC.test(rfc)) throw new ErrorSuscripcion("El RFC del cliente no es válido.")
  if (!razon) throw new ErrorSuscripcion("Escribe la razón social del cliente como aparece en su Constancia de Situación Fiscal.")
  if (cp.length !== 5) throw new ErrorSuscripcion("El código postal fiscal del cliente debe tener 5 dígitos.")
  if (!REGIMENES[regimen]) throw new ErrorSuscripcion("Elige el régimen fiscal del cliente.")

  // Pedido y su cotización (del taller)
  const pedidoId = String(b.pedido_id || "")
  if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) throw new ErrorSuscripcion("Elige el pedido a facturar.")
  const ped = (await supa<any[]>(`/rest/v1/pedidos?id=eq.${pedidoId}&negocio_id=eq.${n.id}&select=id,folio,cotizacion_id,cliente_id,total&limit=1`))[0]
  if (!ped) throw new ErrorSuscripcion("No encontramos ese pedido.", 404)
  let previas = await supa<any[]>(`/rest/v1/cfdi_emitidos?pedido_id=eq.${pedidoId}&estado=neq.cancelada&modo=eq.${modo}&select=id,uuid,estado,facturapi_id`)
  if (previas.some((p) => p.estado === "cancelacion_pendiente")) {
    const llavePrev = await llaveDe(reg, modo)
    const estados = await Promise.all(previas.map((p) => (p.estado === "cancelacion_pendiente" ? refrescarCancelacion(p, llavePrev) : p.estado)))
    previas = previas.filter((_, i) => estados[i] !== "cancelada")
  }
  // Ya no se acepta "forzar" desde el cliente: para otra factura, cancelar primero.
  if (previas.length) throw new ErrorSuscripcion("Este pedido ya tiene una factura vigente. Cancélala primero si necesitas otra.", 409)
  const cot = ped.cotizacion_id
    ? (await supa<any[]>(`/rest/v1/cotizaciones?id=eq.${ped.cotizacion_id}&select=id,descuento_pct,descuento_fijo,iva_pct,costo_envio,subtotal,total&limit=1`))[0]
    : null
  const items = cot ? await supa<any[]>(`/rest/v1/cotizacion_items?cotizacion_id=eq.${cot.id}&select=nombre_producto,descripcion,cantidad,precio_unitario,descuento_item_pct,subtotal&order=orden.asc`) : []
  const ivaPct = Number(cot?.iva_pct ?? 16)
  const tasa = ivaPct / 100
  const cfg = reg.config || {}
  const claveProducto = cfg.clave_producto || "01010101"
  const claveUnidad = cfg.clave_unidad || "E48"

  // Partidas: precio sin IVA; el descuento general se reparte proporcional
  let conceptos = items.map((i) => ({
    descripcion: [limpio(i.nombre_producto, 600), limpio(i.descripcion, 400)].filter(Boolean).join(" — ").slice(0, 1000),
    cantidad: Number(i.cantidad) || 1,
    importe: Number(i.subtotal) || (Number(i.cantidad) || 1) * (Number(i.precio_unitario) || 0) * (1 - (Number(i.descuento_item_pct) || 0) / 100),
  }))
  if (!conceptos.length) {
    const total = Number(ped.total) || 0
    conceptos = [{ descripcion: `Pedido ${ped.folio}`, cantidad: 1, importe: r2(total / (1 + tasa)) }]
  }
  const suma = conceptos.reduce((s, c) => s + c.importe, 0)
  const descuento = cot ? suma * (Number(cot.descuento_pct) || 0) / 100 + (Number(cot.descuento_fijo) || 0) : 0
  const factor = suma > 0 ? Math.max(0, (suma - descuento) / suma) : 1
  if (cot && Number(cot.costo_envio) > 0) conceptos.push({ descripcion: "Envío", cantidad: 1, importe: Number(cot.costo_envio) / factor })

  const cuerpo = {
    customer: {
      legal_name: razon,
      tax_id: rfc,
      tax_system: regimen,
      address: { zip: cp },
      ...(correo ? { email: correo } : {}),
    },
    items: conceptos
      .filter((c) => c.importe > 0)
      .map((c) => ({
        quantity: c.cantidad,
        product: {
          description: c.descripcion || "Servicio de maquinado CNC",
          product_key: claveProducto,
          unit_key: claveUnidad,
          price: r2((c.importe * factor) / c.cantidad),
          tax_included: false,
          taxes: [{ type: "IVA", rate: tasa }],
        },
      })),
    use: uso,
    payment_form: /^\d{2}$/.test(String(b.forma_pago || "")) ? String(b.forma_pago) : "03",
    payment_method: b.metodo_pago === "PPD" ? "PPD" : "PUE",
    series: cfg.serie || "A",
    currency: "MXN",
  }
  if (cuerpo.payment_method === "PPD") cuerpo.payment_form = "99"

  // Cupo del mes (sólo modo real)
  const usadas = modo === "real" ? await usadasEsteMes(n.id) : 0
  const extra = modo === "real" && incluidas !== null && usadas >= incluidas

  const llave = await llaveDe(reg, modo)
  const inv = await fapi<any>(`/invoices`, llave, { method: "POST", body: JSON.stringify(cuerpo) })

  const fila = {
    negocio_id: n.id,
    pedido_id: ped.id,
    cotizacion_id: cot?.id || null,
    cliente_id: ped.cliente_id || null,
    facturapi_id: inv.id,
    uuid: inv.uuid || null,
    serie: inv.series || cuerpo.series,
    folio: inv.folio_number || null,
    receptor_rfc: rfc,
    receptor_nombre: razon,
    receptor_correo: correo || null,
    subtotal: r2(Number(inv.total || 0) / (1 + tasa)),
    iva: r2(Number(inv.total || 0) - Number(inv.total || 0) / (1 + tasa)),
    total: Number(inv.total || 0),
    modo,
    extra,
    costo_extra: extra ? PRECIO_EXTRA : 0,
  }
  // Facturapi ya timbró: si no queda registro, el pedido se podría facturar otra
  // vez y la factura no contaría en el cupo. Se reintenta y, si aun así falla,
  // queda en el log con el id de Facturapi para registrarla a mano.
  let guardada: any[] | null = null
  for (let intento = 1; intento <= 3 && !guardada; intento++) {
    guardada = await supa<any[]>(`/rest/v1/cfdi_emitidos`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(fila) }).catch(
      (e: Error) => {
        logger?.error?.(`[cfdi] intento ${intento}: no se guardó el CFDI ${inv.id} (${inv.uuid || "sin uuid"}) de ${n.id}: ${e.message}`)
        return null
      }
    )
    if (!guardada && intento < 3) await new Promise((r) => setTimeout(r, 1000 * intento))
  }
  if (!guardada) logger?.error?.(`[cfdi] CFDI TIMBRADO SIN REGISTRO: facturapi=${inv.id} uuid=${inv.uuid || "?"} negocio=${n.id} pedido=${ped.id}. Regístralo a mano en cfdi_emitidos.`)

  // Datos fiscales del cliente para la próxima vez
  if (ped.cliente_id) {
    supa(`/rest/v1/clientes?id=eq.${ped.cliente_id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ rfc_fiscal: rfc, razon_social: razon, cp_fiscal: cp, regimen_fiscal: regimen, uso_cfdi: uso }),
    }).catch(() => {})
  }
  if (correo) {
    fapi(`/invoices/${inv.id}/email`, llave, { method: "POST", body: JSON.stringify({ email: correo }) }).catch((e) =>
      logger?.warn?.(`[cfdi] correo ${inv.id}: ${(e as Error).message}`)
    )
  }
  logger?.info?.(`[cfdi] ${modo} ${fila.serie}${fila.folio || ""} de ${n.id} por $${fila.total}${extra ? " (extra)" : ""}`)
  return {
    id: guardada?.[0]?.id,
    uuid: fila.uuid,
    serie: fila.serie,
    folio: fila.folio,
    total: fila.total,
    modo,
    extra,
    precio_extra: extra ? PRECIO_EXTRA : 0,
    enviada_a: correo || null,
  }
}

async function facturaDelTaller(token: string | undefined, id: string, soloAdmin = false) {
  const n = await tallerDeSesion(token, soloAdmin)
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErrorSuscripcion("Factura no válida.", 404)
  const f = (await supa<any[]>(`/rest/v1/cfdi_emitidos?id=eq.${id}&negocio_id=eq.${n.id}&select=*&limit=1`))[0]
  if (!f) throw new ErrorSuscripcion("No encontramos esa factura.", 404)
  const reg = await registroDe(n.id)
  const llave = await llaveDe(reg, f.modo)
  return { f, llave }
}

export async function archivoFactura(token: string | undefined, id: string, tipo: "pdf" | "xml") {
  const { f, llave } = await facturaDelTaller(token, id)
  const datos: Buffer = await fapi(`/invoices/${f.facturapi_id}/${tipo}`, llave, {}, true)
  return { datos, nombre: `${f.serie || ""}${f.folio || f.uuid || f.facturapi_id}.${tipo}`, tipo }
}

export async function enviarFactura(token: string | undefined, id: string, correo: string) {
  const { f, llave } = await facturaDelTaller(token, id)
  const c = limpio(correo || f.receptor_correo, 160)
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c)) throw new ErrorSuscripcion("Escribe un correo válido.")
  await fapi(`/invoices/${f.facturapi_id}/email`, llave, { method: "POST", body: JSON.stringify({ email: c }) })
  return { ok: true, enviada_a: c }
}

// Una cancelación que el receptor tiene que aceptar queda pendiente: se vuelve
// a preguntar a Facturapi cuando el taller lo intenta otra vez.
async function refrescarCancelacion(f: any, llave: string): Promise<string> {
  const inv = await fapi<any>(`/invoices/${f.facturapi_id}`, llave).catch(() => null)
  if (inv?.status === "canceled") {
    await supa(`/rest/v1/cfdi_emitidos?id=eq.${f.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ estado: "cancelada" }),
    })
    return "cancelada"
  }
  return f.estado
}

export async function cancelarFactura(token: string | undefined, id: string, motivo: string) {
  const { f, llave } = await facturaDelTaller(token, id, true)
  if (f.estado === "cancelada") return { ok: true, estado: "cancelada" }
  if (f.estado === "cancelacion_pendiente") return { ok: true, estado: await refrescarCancelacion(f, llave) }
  // Motivos 02 (con errores, sin relación) y 03 (no se llevó a cabo). El 01
  // (sustitución) falta: requiere la factura que la sustituye (pendiente).
  const m = motivo === "03" ? "03" : "02"
  const inv = await fapi<any>(`/invoices/${f.facturapi_id}?motive=${m}`, llave, { method: "DELETE" })
  // Si el receptor tiene que aceptar la cancelación, queda pendiente. Una
  // respuesta desconocida ya no se toma como "cancelada" (eso dejaba volver a
  // facturar el pedido con la factura original todavía vigente).
  const estado = inv?.status === "canceled" ? "cancelada" : "cancelacion_pendiente"
  await supa(`/rest/v1/cfdi_emitidos?id=eq.${f.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ estado, motivo_cancelacion: m, cancelado_en: new Date().toISOString() }),
  })
  return { ok: true, estado }
}
