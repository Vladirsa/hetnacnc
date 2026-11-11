// Recorrido de un comprador por la tienda (páginas públicas, sólo GET).
//   k6 run pruebas/k6/tienda.js                       → humo, 1 usuario 30 s
//   PERFIL=carga k6 run pruebas/k6/tienda.js          → 10 usuarios, ~4.5 min
//   BASE_URL=http://localhost:3000 k6 run ...         → contra el entorno local
import http from "k6/http"
import { check, group, sleep } from "k6"
import { Trend } from "k6/metrics"
import { BASE_URL, PAIS, perfil, productosDelSitemap, elegir } from "./comun.js"

const pesoHtml = new Trend("peso_html_kb")

export const options = {
  ...perfil(),
  thresholds: {
    http_req_failed: ["rate<0.01"], // menos de 1 % de errores
    checks: ["rate>0.99"],
    "http_req_duration{pagina:inicio}": ["p(95)<1500"],
    "http_req_duration{pagina:producto}": ["p(95)<1500"],
    "http_req_duration{pagina:categorias}": ["p(95)<1500"],
    "http_req_duration{pagina:feed}": ["p(95)<3000"],
    "http_req_waiting": ["p(95)<1200"], // TTFB: tiempo que tarda el servidor en contestar
  },
}

export function setup() {
  const productos = productosDelSitemap(http)
  if (!productos.length) console.warn("No se encontraron productos en el sitemap; se omite esa página")
  return { productos }
}

function pagina(nombre, ruta, marcador) {
  const r = http.get(`${BASE_URL}${ruta}`, { tags: { pagina: nombre } })
  pesoHtml.add(r.body ? r.body.length / 1024 : 0, { pagina: nombre })
  check(r, {
    [`${nombre}: 200`]: (x) => x.status === 200,
    [`${nombre}: contenido`]: (x) => !marcador || (x.body || "").includes(marcador),
  })
  return r
}

export default function (datos) {
  group("inicio", () => pagina("inicio", `/${PAIS}`, "</html>"))
  sleep(1 + Math.random() * 2)

  group("categorias", () => pagina("categorias", `/${PAIS}/categories`, "</html>"))
  sleep(1 + Math.random() * 2)

  if (datos.productos.length) {
    group("producto", () => pagina("producto", elegir(datos.productos), "</html>"))
    sleep(2 + Math.random() * 3)
  }

  group("talleres", () => pagina("talleres", `/${PAIS}/talleres`, "</html>"))
  sleep(1)

  // Los feeds los leen Google y Meta para los anuncios automáticos.
  if (__ITER % 5 === 0) {
    group("feed", () => {
      const r = http.get(`${BASE_URL}/feeds/resumen.json`, { tags: { pagina: "feed" } })
      check(r, {
        "feed: 200": (x) => x.status === 200,
        "feed: con productos": (x) => (x.json("en_catalogo") || 0) > 0,
      })
    })
  }
}
