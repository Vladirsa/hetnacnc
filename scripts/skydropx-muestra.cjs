// Solo lectura: muestra qué datos regresa Skydropx por tarifa y prueba la descarga
// del catálogo de códigos postales de Correos de México. No imprime claves.
// Uso (desde ~/hetnacnc): node scripts/skydropx-muestra.cjs
const fs = require("fs")
const env = Object.fromEntries(
  fs.readFileSync("packages/api/.env", "utf8").split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")] })
)
const base = env.SKYDROPX_SANDBOX === "true" ? "https://sb-pro.skydropx.com/api/v1" : "https://api-pro.skydropx.com/api/v1"

async function skydropx() {
  const t = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: env.SKYDROPX_CLIENT_ID, client_secret: env.SKYDROPX_CLIENT_SECRET }).toString(),
  })
  if (!t.ok) return console.log("auth falló", t.status)
  const { access_token } = await t.json()
  const h = { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` }
  const dir = (cp, e, m, c) => ({ country_code: "MX", postal_code: cp, area_level1: e, area_level2: m, area_level3: c })
  let q = await (await fetch(`${base}/quotations`, { method: "POST", headers: h, body: JSON.stringify({ quotation: {
    address_from: dir("90300", "Tlaxcala", "Tlaxcala", "Centro"), address_to: dir("64000", "Nuevo León", "Monterrey", "Monterrey Centro"),
    parcel: { length: 30, width: 60, height: 20, weight: 2 } } }) })).json()
  for (let i = 0; i < 8 && !q.is_completed; i++) { await new Promise((r) => setTimeout(r, 1200)); q = await (await fetch(`${base}/quotations/${q.id}`, { headers: h })).json() }
  const { rates, ...resto } = q
  console.log("== COTIZACION (sin tarifas):", JSON.stringify(resto))
  const ok = (rates || []).filter((r) => r.success)
  console.log(`== TARIFAS: ${rates?.length} total, ${ok.length} disponibles`)
  console.log("== EJEMPLO FedEx:", JSON.stringify(ok.find((r) => /fedex/i.test(r.provider_display_name)) || ok[0], null, 1))
  console.log("== EJEMPLO 99minutos:", JSON.stringify(ok.find((r) => /99/i.test(r.provider_display_name)) || null))
  const ups = (rates || []).find((r) => /ups/i.test(r.provider_display_name))
  console.log("== UPS:", JSON.stringify(ups || null))
}

async function sepomex() {
  for (const url of ["https://www.correosdemexico.gob.mx/datosabiertos/cp/cpdescarga.txt", "http://www.correosdemexico.gob.mx/datosabiertos/cp/cpdescarga.txt", "https://www.correosdemexico.gob.mx/SSLServicios/ConsultaCP/CodigoPostal_Exportar.aspx"]) {
    try {
      const r = await fetch(url, { redirect: "follow" })
      const b = Buffer.from(await r.arrayBuffer())
      console.log(`== SEPOMEX ${url}\n   estado ${r.status} tipo ${r.headers.get("content-type")} tamaño ${b.length}\n   inicio: ${JSON.stringify(b.subarray(0, 160).toString("latin1"))}`)
    } catch (e) { console.log(`== SEPOMEX ${url} error: ${e.message}`) }
  }
}

skydropx().catch((e) => console.log("skydropx error", e.message)).then(sepomex)
