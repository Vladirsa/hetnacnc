// Cliente mínimo de Skydropx PRO (OAuth2 client credentials + cotizaciones).
export type SkydropxOpts = { clientId: string; clientSecret: string; sandbox?: boolean }
export type Direccion = { cp: string; estado?: string; ciudad?: string; colonia?: string; pais?: string }
export type Paquete = { largo: number; ancho: number; alto: number; peso: number } // cm y kg

// Estado según los dos primeros dígitos del C.P. (rangos oficiales de SEPOMEX).
const RANGOS_CP: [number, number, string][] = [
  [1, 16, "Ciudad de México"], [20, 20, "Aguascalientes"], [21, 22, "Baja California"],
  [23, 23, "Baja California Sur"], [24, 24, "Campeche"], [25, 27, "Coahuila"], [28, 28, "Colima"],
  [29, 30, "Chiapas"], [31, 33, "Chihuahua"], [34, 35, "Durango"], [36, 38, "Guanajuato"],
  [39, 41, "Guerrero"], [42, 43, "Hidalgo"], [44, 49, "Jalisco"], [50, 57, "Estado de México"],
  [58, 61, "Michoacán"], [62, 62, "Morelos"], [63, 63, "Nayarit"], [64, 67, "Nuevo León"],
  [68, 71, "Oaxaca"], [72, 75, "Puebla"], [76, 76, "Querétaro"], [77, 77, "Quintana Roo"],
  [78, 79, "San Luis Potosí"], [80, 82, "Sinaloa"], [83, 85, "Sonora"], [86, 86, "Tabasco"],
  [87, 89, "Tamaulipas"], [90, 90, "Tlaxcala"], [91, 96, "Veracruz"], [97, 97, "Yucatán"],
  [98, 99, "Zacatecas"],
]
export const estadoPorCP = (cp: string) => {
  const n = Number(String(cp || "").slice(0, 2))
  return RANGOS_CP.find(([a, b]) => n >= a && n <= b)?.[2] || "México"
}

export class SkydropxClient {
  private token?: string
  private exp = 0
  constructor(private o: SkydropxOpts) {}
  get base() {
    return this.o.sandbox ? "https://sb-pro.skydropx.com/api/v1" : "https://api-pro.skydropx.com/api/v1"
  }
  private async auth() {
    if (this.token && Date.now() < this.exp) return this.token
    const r = await fetch(`${this.base}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.o.clientId,
        client_secret: this.o.clientSecret,
      }).toString(),
    })
    if (!r.ok) throw new Error(`Skydropx auth ${r.status}`)
    const j: any = await r.json()
    this.token = j.access_token
    this.exp = Date.now() + Math.max(60, (j.expires_in ?? 3600) - 120) * 1000
    return this.token!
  }
  async req(method: string, path: string, body?: unknown) {
    const r = await fetch(`${this.base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await this.auth()}` },
      body: body ? JSON.stringify(body) : undefined,
    })
    const txt = await r.text()
    if (!r.ok) throw new Error(`Skydropx ${method} ${path} ${r.status}: ${txt.slice(0, 300)}`)
    return txt ? JSON.parse(txt) : {}
  }
  // Skydropx exige estado, municipio y colonia aunque la tarifa sale del C.P.
  // Si no los tenemos (cotizador rápido, checkout sin colonia), se llenan con el
  // estado que corresponde al C.P. para que la cotización no falle.
  private dir(d: Direccion) {
    const estado = (d.estado || "").trim() || estadoPorCP(d.cp)
    const ciudad = (d.ciudad || "").trim() || estado
    return {
      country_code: d.pais || "MX",
      postal_code: d.cp,
      area_level1: estado,
      area_level2: ciudad,
      area_level3: (d.colonia || "").trim() || "Centro",
    }
  }
  // Devuelve la cotización completa (con tarifas) tras esperar a que termine.
  async cotizar(origen: Direccion, destino: Direccion, p: Paquete) {
    const q: any = await this.req("POST", "/quotations", {
      quotation: {
        address_from: this.dir(origen),
        address_to: this.dir(destino),
        parcel: { length: p.largo, width: p.ancho, height: p.alto, weight: p.peso },
      },
    })
    let cur = q
    for (let i = 0; i < 8 && !cur.is_completed; i++) {
      await new Promise((r) => setTimeout(r, 1200))
      cur = await this.req("GET", `/quotations/${q.id}`)
    }
    return cur
  }

  // ── Guías ──────────────────────────────────────────────────────────────────────
  // Compra la guía con una tarifa de una cotización (cobra del saldo de la
  // cuenta de Skydropx). La guía se genera unos segundos después: hay que
  // consultarla con envio() hasta que traiga la etiqueta.
  async crearEnvio(shipment: Record<string, unknown>) {
    return this.req("POST", "/shipments", { shipment })
  }
  async envio(id: string) {
    return this.req("GET", `/shipments/${encodeURIComponent(id)}`)
  }
  // Descarga un archivo (la etiqueta PDF) con la sesión de la API
  async descargar(url: string): Promise<{ contenido: Buffer; tipo: string }> {
    const r = await fetch(url, { headers: url.startsWith(this.base) ? { Authorization: `Bearer ${await this.auth()}` } : {} })
    if (!r.ok) throw new Error(`Skydropx etiqueta ${r.status}`)
    return { contenido: Buffer.from(await r.arrayBuffer()), tipo: (r.headers.get("content-type") || "application/pdf").split(";")[0] }
  }
}

// Lee la respuesta (formato JSON:API) de una guía: el envío en data y los
// paquetes en included. Se busca con cuidado porque Skydropx no siempre manda
// todo en el mismo lugar.
export type Envio = {
  id: string
  estado: string
  paqueteria: string
  costo: number | null
  guia: string | null
  etiqueta: string | null
  rastreo_url: string | null
  rastreo_estado: string | null
  error: string | null
}

function buscarLiga(nodo: any, prof = 0): string | null {
  if (!nodo || typeof nodo !== "object" || prof > 6) return null
  for (const [k, v] of Object.entries(nodo)) {
    if (typeof v === "string" && /^https:\/\//i.test(v) && /^(label_?url|label|pdf_?url|label_?pdf)$/i.test(k)) return v
  }
  for (const v of Object.values(nodo)) {
    const f = Array.isArray(v) ? v.map((x) => buscarLiga(x, prof + 1)).find(Boolean) : buscarLiga(v, prof + 1)
    if (f) return f
  }
  return null
}

export function leerEnvio(json: any): Envio | null {
  const d = json?.data
  if (!d) return null
  const a = d.attributes || {}
  const paquetes = (json.included || []).filter(
    (x: any) => x?.attributes && (x.attributes.tracking_number !== undefined || x.attributes.label_url !== undefined)
  )
  const p = paquetes[0]?.attributes || {}
  const err = a.error_detail
  return {
    id: String(d.id || a.id || ""),
    estado: String(a.workflow_status || ""),
    paqueteria: String(a.carrier_name || a.carrier || a.provider || ""),
    costo: a.total != null ? Number(a.total) : null,
    guia: a.master_tracking_number || p.tracking_number || a.tracking_number || null,
    etiqueta: p.label_url || a.label_url || buscarLiga(json),
    rastreo_url: p.tracking_url_provider || a.tracking_url_provider || null,
    rastreo_estado: p.tracking_status || a.tracking_status || null,
    error: (err && (err.error_message_detail || err.error_message)) || (typeof err === "string" ? err : null),
  }
}

// Elige la tarifa más barata que sea realmente usable y le suma el margen de HETNA (%).
// Excluye: fallidas, precios absurdos, "Sin Recolección", LTL (carga), plataformas y puntos de entrega.
// ENVIO_PAQUETERIAS (opcional, separadas por coma) limita las paqueterías permitidas.
export function mejorTarifa(cot: any, margenPct = 0) {
  const permitidas = (process.env.ENVIO_PAQUETERIAS || "")
    .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
  const minimo = Number(process.env.ENVIO_TARIFA_MINIMA || 20)
  const ok = (cot.rates || []).filter((x: any) => {
    const nombre = `${x.provider_display_name} ${x.provider_service_name}`.toLowerCase()
    if (x.success !== true || Number(x.total) < minimo) return false
    if (/sin recolecci|ltl|plataforma|punto/.test(nombre)) return false
    if (permitidas.length && !permitidas.some((p) => nombre.includes(p))) return false
    return true
  })
  if (!ok.length) return null
  ok.sort((a: any, b: any) => Number(a.total) - Number(b.total))
  const t = ok[0]
  return {
    rateId: String(t.id || ""),
    paqueteria: t.provider_display_name,
    servicio: t.provider_service_name,
    dias: t.days,
    costo: Number(t.total),
    precio: Math.ceil(Number(t.total) * (1 + margenPct / 100)),
  }
}

