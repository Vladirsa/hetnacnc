// @ts-nocheck
// Agente de recargas y vencimientos: revisa los servicios de los que depende
// HETNA y avisa ANTES de que se acabe el saldo, se llene el espacio o venza algo.
//
//   Saldos       RunPod (escaneo 3D), Meta Ads, Google Ads
//                (Skydropx ya lo vigila lib/saldos.ts)
//   Uso          Resend (correos del mes y del día), disco del servidor y base de
//                datos de la tienda, Cloudflare R2, Supabase de la app del taller
//   Vencimientos dominio (RDAP), certificado SSL, servicios de Hostinger y una
//                lista manual (VENCIMIENTOS)
//
// Cada revisión es opcional: si faltan sus llaves aparece como "sin configurar"
// en el Centro de control y no genera avisos. Si una plataforma no responde, se
// marca "no se pudo leer" y las demás siguen. Los avisos rojos y ámbar entran a
// los avisos del Centro de control y, por lo tanto, al correo de la mañana
// (jobs/centro-control-avisos.ts).
//
// Variables (.env de packages/api). Ninguna es obligatoria:
//   RUNPOD_API_KEY                       (ya existe)   RUNPOD_SALDO_MINIMO=10 (US$)
//   RESEND_API_KEY                       (ya existe)   RESEND_LIMITE_MES=3000  RESEND_LIMITE_DIA=100
//   META_ADS_TOKEN  META_AD_ACCOUNT_ID                 META_ADS_SALDO_MINIMO=200
//   GOOGLE_ADS_DEVELOPER_TOKEN  GOOGLE_ADS_CLIENT_ID  GOOGLE_ADS_CLIENT_SECRET
//   GOOGLE_ADS_REFRESH_TOKEN  GOOGLE_ADS_CUSTOMER_ID  [GOOGLE_ADS_LOGIN_CUSTOMER_ID]
//                                                      GOOGLE_ADS_SALDO_MINIMO=200
//   CLOUDFLARE_API_TOKEN  CLOUDFLARE_ACCOUNT_ID        R2_LIMITE_GB=10
//   COTIZADOR_SUPABASE_URL/_SERVICE_KEY  (ya existen)  SUPABASE_LIMITE_BD_MB=500  SUPABASE_LIMITE_ARCHIVOS_MB=1024
//   HOSTINGER_API_TOKEN
//   VIGILAR_DOMINIOS=hetnacnc.com        VIGILAR_SSL=hetnacnc.com
//   VENCIMIENTOS="Google Workspace=2027-01-10;Otro servicio=2027-05-01"
//   VIGILANCIA_DIAS_AVISO=15  VIGILANCIA_PCT_AMBAR=80  VIGILANCIA_PCT_ROJO=90
import { statfs } from "fs/promises"
import tls from "tls"

export type EstadoServicio = "ok" | "ambar" | "rojo" | "error" | "sin_config"
export type GrupoServicio = "saldo" | "uso" | "vence"
export type Servicio = {
  id: string
  nombre: string
  grupo: GrupoServicio
  estado: EstadoServicio
  valor?: string // la cifra principal: "US$12.40", "1,820 de 3,000 este mes", "vence en 40 días"
  detalle?: string
  alerta?: string // título del aviso cuando está en rojo o ámbar
  url?: string // dónde recargar o renovar
  falta?: string // qué variable agregar cuando está sin configurar
}

const DIA = 86_400_000
const env = (k: string) => (process.env[k] || "").trim()
const num = (k: string, d: number) => {
  const v = env(k)
  const n = Number(v)
  return v && Number.isFinite(n) ? n : d
}
const DIAS_AVISO = () => num("VIGILANCIA_DIAS_AVISO", 15)
const PCT_AMBAR = () => num("VIGILANCIA_PCT_AMBAR", 80)
const PCT_ROJO = () => num("VIGILANCIA_PCT_ROJO", 90)

const miles = (n: number) => Math.round(Number(n) || 0).toLocaleString("es-MX")
const dinero = (n: number, moneda = "MXN") =>
  `${moneda === "USD" ? "US$" : "$"}${(Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${
    moneda && moneda !== "USD" && moneda !== "MXN" ? ` ${moneda}` : ""
  }`
const tamano = (bytes: number) => {
  const b = Number(bytes) || 0
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`
  if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)} MB`
  return `${Math.round(b / 1024)} KB`
}
const nivelUso = (pct: number | null): EstadoServicio =>
  pct === null ? "ok" : pct >= PCT_ROJO() ? "rojo" : pct >= PCT_AMBAR() ? "ambar" : "ok"
const peor = (...e: EstadoServicio[]): EstadoServicio =>
  e.includes("rojo") ? "rojo" : e.includes("ambar") ? "ambar" : e.includes("error") ? "error" : "ok"
const diasHasta = (fecha: string | number | Date) => Math.floor((new Date(fecha).getTime() - Date.now()) / DIA)
const fechaCorta = (fecha: string | number | Date) =>
  new Date(fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Mexico_City" })
const venceEn = (d: number) => (d < 0 ? `venció hace ${-d} día${d === -1 ? "" : "s"}` : d === 0 ? "vence hoy" : `vence en ${d} día${d === 1 ? "" : "s"}`)

/** fetch con tiempo límite; lanza un error corto y legible (sin llaves) si la respuesta no es 2xx. */
async function pedir(url: string, opciones: RequestInit = {}, ms = 12_000) {
  const r = await fetch(url, { ...opciones, signal: AbortSignal.timeout(ms) })
  const texto = await r.text()
  let d = null
  try {
    d = texto ? JSON.parse(texto) : null
  } catch {
    d = null
  }
  if (!r.ok) {
    const m = d?.error?.message || d?.error?.error_user_msg || d?.message || d?.errors?.[0]?.message || texto || r.statusText
    const e = new Error(`${r.status} ${String(typeof m === "string" ? m : JSON.stringify(m)).slice(0, 160)}`)
    ;(e as any).status = r.status
    throw e
  }
  return d
}

/** "Saldo disponible ($1,234.56 MXN)" -> 1234.56 ; también "1.234,56". */
function montoDeTexto(s: string): number | null {
  const m = String(s || "").match(/(\d[\d.,]*)(?!.*\d)/)
  if (!m) return null
  let t = m[1]
  const coma = t.lastIndexOf(","),
    punto = t.lastIndexOf(".")
  if (coma > punto && t.length - coma === 3) t = t.replace(/\./g, "").replace(",", ".")
  else t = t.replace(/,/g, "")
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

async function revisar(
  base: Omit<Servicio, "estado">,
  falta: string | null,
  fn: () => Promise<Partial<Servicio>>
): Promise<Servicio> {
  if (falta) return { ...base, estado: "sin_config", falta }
  try {
    return { estado: "ok", ...base, ...(await fn()) }
  } catch (e) {
    return { ...base, estado: "error", detalle: `No se pudo leer: ${String(e?.message || e).slice(0, 180)}` }
  }
}

// ---- Saldos ---------------------------------------------------------------------

function runpod() {
  const llave = env("RUNPOD_API_KEY")
  return revisar(
    { id: "runpod", nombre: "RunPod (escaneo 3D)", grupo: "saldo", url: "https://www.runpod.io/console/user/billing" },
    llave ? null : "RUNPOD_API_KEY",
    async () => {
      const d = await pedir(`https://api.runpod.io/graphql?api_key=${encodeURIComponent(llave)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "query { myself { clientBalance currentSpendPerHr } }" }),
      })
      if (d?.errors?.length) throw new Error(d.errors[0].message)
      const saldo = Number(d?.data?.myself?.clientBalance)
      if (!Number.isFinite(saldo)) throw new Error("RunPod no devolvió el saldo")
      const porHora = Number(d?.data?.myself?.currentSpendPerHr) || 0
      const minimo = num("RUNPOD_SALDO_MINIMO", 10)
      const horas = porHora > 0 ? saldo / porHora : null
      const alcanza = horas === null ? "" : horas < 48 ? `≈${Math.round(horas)} h` : `≈${Math.round(horas / 24)} días`
      const estado: EstadoServicio =
        saldo <= minimo / 2 || (horas !== null && horas < 6) ? "rojo" : saldo <= minimo || (horas !== null && horas < 24) ? "ambar" : "ok"
      return {
        estado,
        valor: dinero(saldo, "USD"),
        detalle:
          porHora > 0
            ? `Gastas ${dinero(porHora, "USD")} por hora ahora mismo · alcanza para ${alcanza}`
            : `Sin GPUs encendidas · avisamos debajo de ${dinero(minimo, "USD")}`,
        alerta: `Recarga RunPod: te quedan ${dinero(saldo, "USD")}${alcanza ? ` (${alcanza})` : ""}. Sin saldo se detienen los escaneos 3D.`,
      }
    }
  )
}

function metaAds() {
  const token = env("META_ADS_TOKEN")
  const cuenta = env("META_AD_ACCOUNT_ID").replace(/^act_/, "")
  const v = env("META_GRAPH_VERSION") || "v23.0"
  return revisar(
    {
      id: "meta_ads",
      nombre: "Meta Ads (Facebook e Instagram)",
      grupo: "saldo",
      url: cuenta ? `https://business.facebook.com/billing_hub/accounts/details?asset_id=${cuenta}` : "https://business.facebook.com/billing_hub",
    },
    token && cuenta ? null : "META_ADS_TOKEN y META_AD_ACCOUNT_ID",
    async () => {
      const base = `https://graph.facebook.com/${v}/act_${cuenta}`
      const t = `access_token=${encodeURIComponent(token)}`
      const a = await pedir(
        `${base}?fields=name,account_status,currency,balance,amount_spent,spend_cap,is_prepay_account,funding_source_details&${t}`
      )
      const hoy = await pedir(`${base}/insights?date_preset=today&fields=spend&${t}`).catch(() => null)
      const moneda = a?.currency || "MXN"
      const gastoHoy = Number(hoy?.data?.[0]?.spend) || 0
      const minimo = num("META_ADS_SALDO_MINIMO", 200)
      const estadoCuenta = Number(a?.account_status)
      const partes: string[] = []
      let estado: EstadoServicio = "ok"
      let alerta = ""

      // Estado de la cuenta: 1 activa, 2 deshabilitada, 3 pago pendiente, 7/8/9 revisión o gracia, 100/101 cerrada
      if (estadoCuenta === 2 || estadoCuenta === 3 || estadoCuenta >= 100) {
        estado = "rojo"
        alerta =
          estadoCuenta === 3
            ? "Meta Ads tiene un pago pendiente: tus anuncios están detenidos hasta que pagues."
            : "Tu cuenta de Meta Ads está deshabilitada o cerrada: tus anuncios no se muestran."
      } else if ([7, 8, 9].includes(estadoCuenta)) {
        estado = "ambar"
        alerta = "Tu cuenta de Meta Ads está en revisión o en periodo de gracia."
      }

      // Prepago (OXXO, tarjeta de débito): el saldo disponible viene en el texto del método de pago
      const disponible = a?.is_prepay_account ? montoDeTexto(a?.funding_source_details?.display_string) : null
      let valor = ""
      if (disponible !== null) {
        valor = dinero(disponible, moneda)
        const dias = gastoHoy > 0 ? Math.floor(disponible / gastoHoy) : null
        partes.push(`Saldo prepagado${dias !== null ? ` · alcanza ≈${dias} día${dias === 1 ? "" : "s"} al ritmo de hoy` : ""}`)
        if (disponible <= minimo / 2 || (dias !== null && dias < 2)) estado = peor(estado, "rojo")
        else if (disponible <= minimo || (dias !== null && dias < 5)) estado = peor(estado, "ambar")
        if (!alerta && estado !== "ok") alerta = `Recarga Meta Ads: te quedan ${dinero(disponible, moneda)}. Sin saldo se detienen tus anuncios.`
      } else {
        const debe = (Number(a?.balance) || 0) / 100
        valor = debe > 0 ? `${dinero(debe, moneda)} por pagar` : "Al corriente"
        partes.push("Cuenta con cobro a tarjeta")
      }
      const tope = (Number(a?.spend_cap) || 0) / 100
      if (tope > 0) {
        const restante = tope - (Number(a?.amount_spent) || 0) / 100
        partes.push(`Límite de gasto de la cuenta: quedan ${dinero(restante, moneda)}`)
        if (restante <= minimo) {
          estado = peor(estado, restante <= 0 ? "rojo" : "ambar")
          if (!alerta) alerta = `Meta Ads está por llegar a su límite de gasto (quedan ${dinero(restante, moneda)}). Súbelo o tus anuncios se detienen.`
        }
      }
      partes.push(`Gasto de hoy: ${dinero(gastoHoy, moneda)}`)
      return { estado, valor, detalle: partes.join(" · "), alerta: alerta || undefined }
    }
  )
}

function googleAds() {
  const req = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"]
  const faltan = req.filter((k) => !env(k))
  const cliente = env("GOOGLE_ADS_CUSTOMER_ID").replace(/\D/g, "")
  const v = env("GOOGLE_ADS_API_VERSION") || "v24"
  return revisar(
    { id: "google_ads", nombre: "Google Ads", grupo: "saldo", url: "https://ads.google.com/aw/billing/summary" },
    faltan.length ? faltan.join(", ") : null,
    async () => {
      const tk = await pedir("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: env("GOOGLE_ADS_CLIENT_ID"),
          client_secret: env("GOOGLE_ADS_CLIENT_SECRET"),
          refresh_token: env("GOOGLE_ADS_REFRESH_TOKEN"),
        }).toString(),
      })
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        authorization: `Bearer ${tk?.access_token}`,
        "developer-token": env("GOOGLE_ADS_DEVELOPER_TOKEN"),
      }
      const login = env("GOOGLE_ADS_LOGIN_CUSTOMER_ID").replace(/\D/g, "")
      if (login) headers["login-customer-id"] = login
      const buscar = async (query: string) =>
        ((await pedir(`https://googleads.googleapis.com/${v}/customers/${cliente}/googleAds:search`, {
          method: "POST",
          headers,
          body: JSON.stringify({ query }),
        }))?.results || []) as any[]

      const hoy = await buscar("SELECT customer.currency_code, metrics.cost_micros FROM customer WHERE segments.date DURING TODAY")
      const moneda = hoy[0]?.customer?.currencyCode || "MXN"
      const gastoHoy = hoy.reduce((s, r) => s + Number(r?.metrics?.costMicros || 0), 0) / 1e6

      const camp = await buscar(
        "SELECT campaign_budget.resource_name, campaign_budget.amount_micros FROM campaign WHERE campaign.status = 'ENABLED'"
      ).catch(() => [])
      const presupuestos = new Map<string, number>()
      for (const r of camp) presupuestos.set(r?.campaignBudget?.resourceName, Number(r?.campaignBudget?.amountMicros || 0) / 1e6)
      const presupuestoDia = [...presupuestos.values()].reduce((s, n) => s + n, 0)

      // Facturación mensual: presupuesto de la cuenta aprobado vs. lo ya gastado. Con
      // pagos manuales (prepago) Google no da el saldo por la API.
      const cuenta = await buscar(
        "SELECT account_budget.approved_spending_limit_micros, account_budget.adjusted_spending_limit_micros, account_budget.amount_served_micros, account_budget.approved_end_date_time FROM account_budget WHERE account_budget.status = 'APPROVED'"
      ).catch(() => [])
      const ab = cuenta[0]?.accountBudget
      const minimo = num("GOOGLE_ADS_SALDO_MINIMO", 200)
      let estado: EstadoServicio = "ok"
      let alerta: string | undefined
      const partes = [
        `Gasto de hoy: ${dinero(gastoHoy, moneda)}`,
        presupuestos.size ? `presupuesto diario de campañas activas: ${dinero(presupuestoDia, moneda)}` : "sin campañas activas",
      ]
      let valor = dinero(gastoHoy, moneda) + " hoy"
      const limite = Number(ab?.adjustedSpendingLimitMicros || ab?.approvedSpendingLimitMicros || 0) / 1e6
      if (limite > 0) {
        const restante = limite - Number(ab?.amountServedMicros || 0) / 1e6
        valor = `quedan ${dinero(restante, moneda)}`
        partes.push(`presupuesto de la cuenta: ${dinero(limite, moneda)}`)
        if (restante <= minimo || (presupuestoDia > 0 && restante < presupuestoDia * 3)) {
          estado = restante <= presupuestoDia ? "rojo" : "ambar"
          alerta = `Google Ads está por agotar el presupuesto de la cuenta (quedan ${dinero(restante, moneda)}).`
        }
      } else if (presupuestos.size) {
        partes.push("si pagas por adelantado, revisa el saldo en Facturación")
      }
      return { estado, valor, detalle: partes.join(" · "), alerta }
    }
  )
}

// ---- Uso y límites ----------------------------------------------------------------

function resend() {
  const llave = env("RESEND_API_KEY")
  return revisar(
    { id: "resend", nombre: "Resend (correos)", grupo: "uso", url: "https://resend.com/settings/billing" },
    llave ? null : "RESEND_API_KEY",
    async () => {
      let mes: { used: number; limit: number | null } | null = null
      let dia: { used: number; limit: number | null } | null = null
      try {
        const u = await pedir("https://api.resend.com/usage", { headers: { authorization: `Bearer ${llave}` } })
        mes = u?.emails?.monthly || null
        dia = u?.emails?.daily || null
      } catch (e) {
        // Una llave "solo envío" no puede leer /usage: se usa lo que Resend
        // reportó en los encabezados del último correo enviado (lib/resend.ts).
        const { cuotaResend } = await import("./resend")
        const c = cuotaResend()
        if (!c) throw new Error(`${e?.message || e}. Se llenará solo con el siguiente correo que salga.`)
        mes = c.mes === null ? null : { used: c.mes, limit: num("RESEND_LIMITE_MES", 3000) }
        const deHoy = Date.now() - Date.parse(c.cuando) < DIA
        dia = c.dia === null || !deHoy ? null : { used: c.dia, limit: num("RESEND_LIMITE_DIA", 100) }
      }
      if (!mes && !dia) throw new Error("Resend no devolvió el uso")
      const pct = (x) => (x && x.limit ? (Number(x.used) / Number(x.limit)) * 100 : null)
      const estado = peor(nivelUso(pct(mes)), nivelUso(pct(dia)))
      const partes: string[] = []
      if (dia) partes.push(`Hoy: ${miles(dia.used)}${dia.limit ? ` de ${miles(dia.limit)}` : ""}`)
      partes.push(mes?.limit ? "el cupo del mes se reinicia el día 1" : "plan sin tope mensual")
      return {
        estado,
        valor: mes ? `${miles(mes.used)}${mes.limit ? ` de ${miles(mes.limit)}` : ""} este mes` : `${miles(dia.used)} hoy`,
        detalle: partes.join(" · "),
        alerta:
          estado === "ok"
            ? undefined
            : `Resend está por llegar a su límite de correos (${mes?.limit ? `${Math.round(pct(mes))}% del mes` : `${Math.round(pct(dia))}% del día`}). Si se pasa, dejan de salir bienvenidas, pedidos y avisos.`,
      }
    }
  )
}

function servidor(container) {
  return revisar({ id: "servidor", nombre: "Servidor (disco del VPS)", grupo: "uso", url: "https://hpanel.hostinger.com/vps" }, null, async () => {
    const s = await statfs(env("VIGILAR_DISCO") || "/")
    const total = Number(s.blocks) * Number(s.bsize)
    const libre = Number(s.bavail) * Number(s.bsize)
    const pct = total ? ((total - libre) / total) * 100 : null
    let bd = ""
    try {
      const knex = container.resolve("__pg_connection__")
      const r = await knex.raw("select pg_database_size(current_database()) as n")
      bd = ` · base de datos de la tienda: ${tamano(Number((r.rows || r)[0]?.n))}`
    } catch {
      bd = ""
    }
    const estado = nivelUso(pct)
    return {
      estado,
      valor: `${Math.round(pct ?? 0)}% usado`,
      detalle: `Libres: ${tamano(libre)} de ${tamano(total)}${bd}`,
      alerta:
        estado === "ok"
          ? undefined
          : `El disco del servidor va en ${Math.round(pct)}% (quedan ${tamano(libre)}). Si se llena, la tienda deja de guardar pedidos y fotos.`,
    }
  })
}

function r2() {
  const token = env("CLOUDFLARE_API_TOKEN")
  const cuenta = env("CLOUDFLARE_ACCOUNT_ID")
  return revisar(
    { id: "r2", nombre: "Cloudflare R2 (archivos)", grupo: "uso", url: "https://dash.cloudflare.com/?to=/:account/r2/overview" },
    token && cuenta ? null : "CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID",
    async () => {
      const hasta = new Date()
      const desde = new Date(Date.now() - 2 * DIA)
      const d = await pedir("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query: `query ($a: String!, $desde: Time!, $hasta: Time!) { viewer { accounts(filter: { accountTag: $a }) {
            r2StorageAdaptiveGroups(limit: 1000, filter: { datetime_geq: $desde, datetime_leq: $hasta }, orderBy: [datetime_DESC]) {
              max { payloadSize metadataSize objectCount } dimensions { bucketName datetime } } } } }`,
          variables: { a: cuenta, desde: desde.toISOString(), hasta: hasta.toISOString() },
        }),
      })
      if (d?.errors?.length) throw new Error(d.errors[0].message)
      const filas = d?.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups || []
      const porBucket = new Map<string, any>()
      for (const f of filas) if (!porBucket.has(f.dimensions.bucketName)) porBucket.set(f.dimensions.bucketName, f.max)
      const bytes = [...porBucket.values()].reduce((s, m) => s + Number(m.payloadSize || 0) + Number(m.metadataSize || 0), 0)
      const objetos = [...porBucket.values()].reduce((s, m) => s + Number(m.objectCount || 0), 0)
      const limite = num("R2_LIMITE_GB", 10) * 1024 ** 3
      const pct = (bytes / limite) * 100
      const estado = nivelUso(pct)
      return {
        estado,
        valor: `${tamano(bytes)} de ${tamano(limite)}`,
        detalle: `${miles(objetos)} archivos en ${porBucket.size} bucket(s)`,
        alerta: estado === "ok" ? undefined : `Cloudflare R2 va en ${Math.round(pct)}% de tu límite (${tamano(bytes)}). Arriba del plan gratuito cobra por GB.`,
      }
    }
  )
}

function supabaseApp() {
  const url = env("COTIZADOR_SUPABASE_URL").replace(/\/$/, "")
  const llave = env("COTIZADOR_SUPABASE_SERVICE_KEY")
  return revisar(
    { id: "supabase", nombre: "Supabase (app del taller)", grupo: "uso", url: "https://supabase.com/dashboard/org/_/usage" },
    url && llave ? null : "COTIZADOR_SUPABASE_URL y COTIZADOR_SUPABASE_SERVICE_KEY",
    async () => {
      let d
      try {
        d = await pedir(`${url}/rest/v1/rpc/hetna_uso`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: llave, authorization: `Bearer ${llave}` },
          body: "{}",
        })
      } catch (e) {
        if (e?.status === 404) throw new Error("falta crear la función hetna_uso en Supabase (ver SQL en lib/vigilancia.ts)")
        throw e
      }
      const bd = Number(d?.bd_bytes) || 0
      const archivos = Number(d?.archivos_bytes) || 0
      const limBd = num("SUPABASE_LIMITE_BD_MB", 500) * 1024 ** 2
      const limArch = num("SUPABASE_LIMITE_ARCHIVOS_MB", 1024) * 1024 ** 2
      const pBd = (bd / limBd) * 100
      const pArch = (archivos / limArch) * 100
      const estado = peor(nivelUso(pBd), nivelUso(pArch))
      return {
        estado,
        valor: `BD ${Math.round(pBd)}% · archivos ${Math.round(pArch)}%`,
        detalle: `Base de datos ${tamano(bd)} de ${tamano(limBd)} · archivos ${tamano(archivos)} de ${tamano(limArch)}`,
        alerta:
          estado === "ok"
            ? undefined
            : `Supabase de la app va en ${Math.round(Math.max(pBd, pArch))}% de su límite. Si se pasa, la app de talleres puede quedar en solo lectura.`,
      }
    }
  )
}
// SQL para pegar una vez en Supabase (SQL Editor) del proyecto de la app:
//
//   create or replace function public.hetna_uso() returns json
//   language sql security definer set search_path = public, storage as $$
//     select json_build_object(
//       'bd_bytes', pg_database_size(current_database()),
//       'archivos_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0))
//   $$;
//   revoke all on function public.hetna_uso() from public, anon, authenticated;
//   grant execute on function public.hetna_uso() to service_role;

// ---- Vencimientos -----------------------------------------------------------------

function itemVence(id: string, nombre: string, fecha: string | number | Date, extra: Partial<Servicio> = {}, renovacionAuto = false): Servicio {
  const d = diasHasta(fecha)
  const estado: EstadoServicio =
    d <= (renovacionAuto ? 2 : 5) ? "rojo" : d <= (renovacionAuto ? 5 : DIAS_AVISO()) ? "ambar" : "ok"
  return {
    id,
    nombre,
    grupo: "vence",
    estado,
    valor: venceEn(d),
    detalle: `${fechaCorta(fecha)}${renovacionAuto ? " · renovación automática" : ""}`,
    alerta: `${nombre} ${venceEn(d)} (${fechaCorta(fecha)}). ${renovacionAuto ? "Revisa que tu tarjeta tenga fondos." : "Renuévalo para que el sitio no se caiga."}`,
    ...extra,
  }
}

const lista = (k: string, porDefecto: string) =>
  (env(k) || porDefecto)
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

async function dominios(): Promise<Servicio[]> {
  return Promise.all(
    lista("VIGILAR_DOMINIOS", "hetnacnc.com").map(async (dom) => {
      const base = { id: `dominio_${dom}`, nombre: `Dominio ${dom}`, grupo: "vence" as const, url: "https://hpanel.hostinger.com/domains" }
      try {
        const d = await pedir(`https://rdap.org/domain/${encodeURIComponent(dom)}`, { headers: { accept: "application/rdap+json" } })
        const ev = (d?.events || []).find((e) => e.eventAction === "expiration")
        if (!ev?.eventDate) throw new Error("el registro no publica la fecha de vencimiento")
        return itemVence(base.id, base.nombre, ev.eventDate, { url: base.url })
      } catch (e) {
        return { ...base, estado: "error" as const, detalle: `No se pudo leer: ${String(e?.message || e).slice(0, 160)}` }
      }
    })
  )
}

function certificado(host: string): Promise<string> {
  return new Promise((ok, mal) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 10_000 }, () => {
      const c = s.getPeerCertificate()
      s.end()
      c?.valid_to ? ok(c.valid_to) : mal(new Error("sin certificado"))
    })
    s.on("timeout", () => {
      s.destroy()
      mal(new Error("tiempo agotado"))
    })
    s.on("error", mal)
  })
}

async function ssl(): Promise<Servicio[]> {
  return Promise.all(
    lista("VIGILAR_SSL", "hetnacnc.com").map(async (host) => {
      const base = { id: `ssl_${host}`, nombre: `Certificado SSL ${host}`, grupo: "vence" as const }
      try {
        const vence = await certificado(host)
        const s = itemVence(base.id, base.nombre, vence, {}, true)
        // Let's Encrypt se renueva solo ~30 días antes: si llega a 15 días es que la renovación falló.
        const d = diasHasta(vence)
        s.estado = d <= 7 ? "rojo" : d <= 15 ? "ambar" : "ok"
        s.detalle = `${fechaCorta(vence)} · se renueva solo unos 30 días antes`
        s.alerta = `El certificado SSL de ${host} ${venceEn(d)} y no se ha renovado solo. En el servidor corre: sudo certbot renew`
        return s
      } catch (e) {
        return { ...base, estado: "error" as const, detalle: `No se pudo leer: ${String(e?.message || e).slice(0, 160)}` }
      }
    })
  )
}

async function hostinger(): Promise<Servicio[]> {
  const token = env("HOSTINGER_API_TOKEN")
  const base = { id: "hostinger", nombre: "Hostinger (VPS y servicios)", grupo: "vence" as const, url: "https://hpanel.hostinger.com/billing/subscriptions" }
  if (!token) return [{ ...base, estado: "sin_config", falta: "HOSTINGER_API_TOKEN (o la fecha a mano en VENCIMIENTOS)" }]
  try {
    const d = await pedir("https://developers.hostinger.com/api/billing/v1/subscriptions", {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    })
    const subs = (Array.isArray(d) ? d : d?.data || []).filter((s) => !["cancelled", "canceled", "expired"].includes(String(s?.status || "").toLowerCase()))
    const items = subs
      .map((s) => ({ s, fecha: s?.expires_at || s?.next_billing_at }))
      .filter((x) => x.fecha)
      .map(({ s, fecha }) =>
        itemVence(`hostinger_${s.id}`, `Hostinger: ${s.name || "servicio"}`, fecha, { url: base.url }, s?.is_auto_renewed === true)
      )
    return items.length ? items : [{ ...base, estado: "ok", valor: "sin servicios por vencer" }]
  } catch (e) {
    return [{ ...base, estado: "error", detalle: `No se pudo leer: ${String(e?.message || e).slice(0, 160)}` }]
  }
}

function manuales(): Servicio[] {
  return env("VENCIMIENTOS")
    .split(/[;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => {
      const [nombre, fecha] = p.split("=").map((s) => s.trim())
      const t = Date.parse(fecha || "")
      if (!nombre || Number.isNaN(t)) {
        return { id: `manual_${i}`, nombre: nombre || p, grupo: "vence" as const, estado: "error" as const, detalle: "Fecha inválida en VENCIMIENTOS (usa Nombre=AAAA-MM-DD)" }
      }
      return itemVence(`manual_${i}`, nombre, `${fecha}T12:00:00-06:00`)
    })
}

// ---- Todo junto -------------------------------------------------------------------

let cache: { t: number; datos: Servicio[] } | null = null
const CACHE_MS = 10 * 60_000

export async function vigilarServicios(container, { fresco = false }: { fresco?: boolean } = {}): Promise<Servicio[]> {
  if (!fresco && cache && Date.now() - cache.t < CACHE_MS) return cache.datos
  const grupos = await Promise.all([
    runpod(),
    metaAds(),
    googleAds(),
    resend(),
    servidor(container),
    r2(),
    supabaseApp(),
    dominios(),
    ssl(),
    hostinger(),
    Promise.resolve(manuales()),
  ])
  const datos = grupos.flat()
  cache = { t: Date.now(), datos }
  return datos
}

/** Avisos para el Centro de control: rojo y ámbar tal cual; "no se pudo leer" como aviso azul. */
export function avisosDeServicios(servicios: Servicio[], urlControl: string) {
  return servicios
    .filter((s) => s.estado === "rojo" || s.estado === "ambar" || s.estado === "error")
    .map((s) =>
      s.estado === "error"
        ? {
            nivel: "azul" as const,
            tipo: "servicio_sin_leer",
            titulo: `No se pudo revisar ${s.nombre}`,
            detalle: `${s.detalle || ""} Revisa sus llaves en el .env del servidor.`.trim(),
            url: urlControl,
          }
        : {
            nivel: s.estado,
            tipo: s.grupo === "vence" ? "vencimiento" : s.grupo === "saldo" ? "saldo_servicio" : "limite_servicio",
            titulo: s.alerta || `${s.nombre}: ${s.valor || ""}`,
            detalle: [s.valor, s.detalle].filter(Boolean).join(" · "),
            url: s.url || urlControl,
          }
    )
}
