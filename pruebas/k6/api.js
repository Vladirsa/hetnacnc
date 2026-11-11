// API de la tienda (Medusa /store), sólo lectura. Requiere la llave publicable:
//   PUBLISHABLE_KEY=pk_... k6 run pruebas/k6/api.js
// La llave es la misma de NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY. NO la subas al repo.
import http from "k6/http"
import { check, sleep, fail } from "k6"
import { BASE_URL, perfil, elegir } from "./comun.js"

const API = (__ENV.API_URL || BASE_URL).replace(/\/$/, "")
const KEY = __ENV.PUBLISHABLE_KEY

export const options = {
  ...perfil(),
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    "http_req_duration{api:productos}": ["p(95)<800"],
    "http_req_duration{api:producto}": ["p(95)<600"],
    "http_req_duration{api:categorias}": ["p(95)<600"],
  },
}

const cab = () => ({ headers: { "x-publishable-api-key": KEY } })

export function setup() {
  if (!KEY) fail("Falta PUBLISHABLE_KEY")
  const r = http.get(`${API}/store/products?limit=50&fields=handle`, cab())
  if (r.status !== 200) fail(`/store/products respondió ${r.status}`)
  return { handles: (r.json("products") || []).map((p) => p.handle) }
}

export default function ({ handles }) {
  const p = { ...cab() }
  let r = http.get(`${API}/store/products?limit=12`, { ...p, tags: { api: "productos" } })
  check(r, { "productos: 200": (x) => x.status === 200 })
  sleep(1)

  if (handles.length) {
    r = http.get(`${API}/store/products?handle=${encodeURIComponent(elegir(handles))}`, { ...p, tags: { api: "producto" } })
    check(r, { "producto: 200": (x) => x.status === 200, "producto: encontrado": (x) => (x.json("products") || []).length === 1 })
    sleep(1)
  }

  r = http.get(`${API}/store/product-categories?limit=50`, { ...p, tags: { api: "categorias" } })
  check(r, { "categorias: 200": (x) => x.status === 200 })
  sleep(1)
}
