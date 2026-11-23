import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { STORE_URL } from "../../../lib/licitacion"

// Ligas públicas de cotizaciones del módulo viejo "cotizador" de Medusa (ya
// retirado: las cotizaciones de los talleres viven en la app del Cotizador y
// sus ligas son /c/<token>). Quien abra una liga vieja ve este aviso en lugar
// de un error.
const AVISO = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Cotización no disponible · HETNA CNC</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#FAF9F6;color:#1B1B18;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.caja{max-width:440px;background:#fff;border:1px solid #E7E4DC;border-radius:16px;padding:28px;text-align:center}
h1{font-size:21px;margin:0 0 10px}p{font-size:15px;line-height:1.5;color:#40403A;margin:0 0 18px}
a{display:inline-block;background:#C2560A;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px}</style></head>
<body><div class="caja"><h1>Esta cotización ya no está disponible</h1>
<p>La liga es de un sistema anterior. Pídele al taller que te mande una cotización nueva, o cotiza tu pieza directo en HETNA CNC.</p>
<a href="${STORE_URL}/mx/cotizar">Cotizar en HETNA CNC</a></div></body></html>`

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.status(410).type("text/html").send(AVISO)
}
