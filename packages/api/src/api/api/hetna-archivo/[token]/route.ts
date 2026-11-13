// GET /api/hetna-archivo/:token[?ver=1]
// Abre un archivo de una solicitud: revisa la firma y el permiso EN ESTE
// MOMENTO, anota quién lo bajó y redirige a una liga de Backblaze de 2 minutos.
// Ver lib/archivo-acceso.ts. Pública a propósito (la abre el navegador del
// taller o de HETNA, sin llave publicable): la seguridad está en el token.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrls } from "../../../../lib/backblaze"
import { SEGUNDOS_LIGA_B2, anotarAcceso, leerTokenArchivo } from "../../../../lib/archivo-acceso"
import { ipCliente } from "../../../../lib/ip-cliente"
import { T_SOLICITUD } from "../../../../lib/licitacion"
import { puedeDescargarAhora, relacionTaller } from "../../../../lib/licitacion-privacidad"

const pagina = (res: MedusaResponse, codigo: number, texto: string) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.status(codigo).send(
    `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>HETNA</title>` +
      `<body style="font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#142033">` +
      `<h1 style="font-size:20px">No se puede abrir el archivo</h1><p>${texto}</p></body>`
  )
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const p = leerTokenArchivo(String(req.params.token || ""))
  if (!p) return pagina(res, 403, "La liga venció o no es válida. Vuelve a pedirla desde tu panel: cada liga dura una hora.")

  const ver = String((req.query as any)?.ver || "") === "1"
  const s = await knex(T_SOLICITUD).where({ id: p.s }).first()
  const archivo = ((s?.trabajo?.archivos || []) as { clave: string; nombre: string }[]).find((a) => a.clave === p.k)
  if (!s || !archivo) return pagina(res, 404, "Este archivo ya no existe: el cliente lo borró o se eliminó por la política de conservación.")

  let nombreActor: string | null = p.a === "hetna" ? "HETNA" : p.a === "cliente" ? "Cliente" : null
  if (p.a === "taller") {
    const rel = await relacionTaller(knex, s, p.i)
    const v = await knex("seller").where({ id: p.i }).first("name").catch(() => null)
    nombreActor = v?.name || p.i
    if (!puedeDescargarAhora(s, rel, archivo.nombre)) {
      await anotarAcceso(knex, {
        solicitud_id: s.id, clave: p.k, nombre: archivo.nombre, actor: "taller", actor_id: p.i, actor_nombre: nombreActor,
        accion: "negada", ip: ipCliente(req), agente: req.headers["user-agent"] as string,
      }).catch(() => null)
      return pagina(res, 403, "Ya no tienes acceso a este archivo: el cliente eligió otra propuesta, la solicitud cerró o el cliente cambió sus permisos.")
    }
  }

  const url = (await getSignedDownloadUrls([p.k], SEGUNDOS_LIGA_B2, undefined, ver ? undefined : "attachment").catch(() => new Map<string, string>())).get(p.k)
  if (!url) return pagina(res, 503, "No pudimos preparar la descarga. Intenta de nuevo en un momento.")

  // Si no se puede anotar, no se entrega: el registro es parte del permiso.
  try {
    await anotarAcceso(knex, {
      solicitud_id: s.id, clave: p.k, nombre: archivo.nombre, actor: p.a, actor_id: p.i, actor_nombre: nombreActor,
      accion: ver ? "vista" : "descarga", ip: ipCliente(req), agente: req.headers["user-agent"] as string,
    })
  } catch (e) {
    logger.error(`[hetna-archivo] no se pudo registrar el acceso: ${(e as Error).message}`)
    return pagina(res, 503, "No pudimos preparar la descarga. Intenta de nuevo en un momento.")
  }
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Referrer-Policy", "no-referrer")
  return res.redirect(302, url)
}
