// Utilidades compartidas por las pruebas k6 de HETNA.
// Sólo tráfico de LECTURA: nada de carritos, login, cotizaciones ni contadores.

export const BASE_URL = (__ENV.BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")
export const PAIS = __ENV.PAIS || "mx"

// Perfiles de carga. Por omisión "humo": 1 usuario, 30 s (seguro en producción).
// "carga" y "estres" pegan fuerte al VPS: correrlos sólo en horario de poco tráfico.
export const PERFILES = {
  humo: { vus: 1, duration: "30s" },
  carga: {
    stages: [
      { duration: "1m", target: 10 },
      { duration: "3m", target: 10 },
      { duration: "30s", target: 0 },
    ],
  },
  // Capacidad: sube por escalones y se DETIENE sola en cuanto la tienda se
  // degrada (ver abortOnFail en tienda.js). El escalón donde se detuvo es el límite.
  capacidad: {
    stages: [
      { duration: "1m", target: 5 },
      { duration: "1m", target: 10 },
      { duration: "1m", target: 20 },
      { duration: "1m", target: 30 },
      { duration: "1m", target: 40 },
      { duration: "30s", target: 0 },
    ],
  },
  // Techo: sigue desde donde termina "capacidad" (40) hasta 100, con el mismo
  // corte automático. Sólo tiene sentido con la microcaché de nginx activa.
  techo: {
    stages: [
      { duration: "1m", target: 40 },
      { duration: "1m", target: 60 },
      { duration: "1m", target: 80 },
      { duration: "1m", target: 100 },
      { duration: "1m", target: 100 },
      { duration: "30s", target: 0 },
    ],
  },
  estres: {
    stages: [
      { duration: "1m", target: 20 },
      { duration: "2m", target: 40 },
      { duration: "1m", target: 60 },
      { duration: "1m", target: 0 },
    ],
  },
}

export function perfil() {
  const nombre = __ENV.PERFIL || "humo"
  const p = PERFILES[nombre]
  if (!p) throw new Error(`PERFIL desconocido: ${nombre} (usa: ${Object.keys(PERFILES).join(", ")})`)
  return p
}

// Saca rutas de producto del sitemap público (no requiere llaves).
export function productosDelSitemap(http, max = 50) {
  const r = http.get(`${BASE_URL}/sitemap.xml`, { tags: { pagina: "sitemap" } })
  if (r.status !== 200) return []
  const rutas = []
  const re = /<loc>([^<]+\/products\/[^<]+)<\/loc>/g
  let m
  while ((m = re.exec(r.body)) && rutas.length < max) {
    const url = m[1]
    const ruta = url.replace(/^https?:\/\/[^/]+/, "")
    if (ruta.startsWith(`/${PAIS}/`)) rutas.push(ruta)
  }
  return rutas
}

export function elegir(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}
