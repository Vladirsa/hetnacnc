// Velocidad que percibe el cliente (Core Web Vitals: LCP, FCP, CLS, TTFB) con un
// navegador real. Un solo usuario: no es prueba de carga, es medición de experiencia.
//   k6 run pruebas/k6/navegador.js
// Necesita Chromium (K6_BROWSER_EXECUTABLE_PATH si no está en el PATH).
import { browser } from "k6/browser"
import http from "k6/http"
import { check } from "k6"
import { BASE_URL, PAIS, productosDelSitemap } from "./comun.js"

export const options = {
  scenarios: {
    vitals: {
      executor: "shared-iterations",
      vus: 1,
      iterations: Number(__ENV.ITERACIONES || 3),
      options: { browser: { type: "chromium" } },
    },
  },
  thresholds: {
    // Umbrales "buenos" de Google para Core Web Vitals.
    browser_web_vital_lcp: ["p(75)<2500"],
    browser_web_vital_fcp: ["p(75)<1800"],
    browser_web_vital_cls: ["p(75)<0.1"],
    browser_web_vital_ttfb: ["p(75)<800"],
  },
}

export function setup() {
  return { producto: productosDelSitemap(http, 1)[0] }
}

async function visitar(page, ruta) {
  const r = await page.goto(`${BASE_URL}${ruta}`, { waitUntil: "load" })
  // goto devuelve null cuando la navegación la atiende el service worker del
  // sitio; en ese caso no hay código HTTP y se valida por el título.
  const titulo = await page.title()
  const ok = (!r || r.status() === 200) && titulo.includes("HETNA CNC")
  if (!ok) console.warn(`FALLO ${ruta}: ${r ? r.status() : "sin respuesta"} "${titulo}"`)
  check(ok, { [`${ruta}: carga con título`]: (x) => x })
  await page.waitForTimeout(1500) // deja que se reporten LCP y CLS
}

export default async function ({ producto }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // celular: la mayoría del tráfico de anuncios
    userAgent:
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36 k6-hetna",
  })
  const page = await context.newPage()
  try {
    await visitar(page, `/${PAIS}`)
    if (producto) await visitar(page, producto)
  } finally {
    await page.close()
    await context.close()
  }
}
