// GET /api/ubicacion: estado y ciudad APROXIMADOS del visitante por su IP, para
// ordenar "talleres cerca de ti" antes de que escriba su código postal.
//
// La IP no sale del servidor: se busca en una base local de DB-IP ("IP to City
// Lite", licencia CC BY 4.0) que baja scripts/actualizar-ubicacion-ip.sh cada
// mes a ~/hetna-data/dbip-city-lite.mmdb (o la ruta en DBIP_CIUDAD_MMDB). Sin
// el archivo contesta {} y la tienda sólo usa el código postal.
//
// Respuesta privada y sin caché: depende de quién pregunta.
import { readFile, stat } from "fs/promises"
import { homedir } from "os"
import { join } from "path"

import { Reader, type CityResponse } from "mmdb-lib"

import { normalizarEstado } from "@/lib/ubicacion/cercania"
import { ipDe } from "@/lib/seguridad/ip-cliente"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Una sola lectura del archivo (pesa ~130 MB) aunque lleguen muchas visitas a la
// vez: todas esperan la misma promesa. Cada minuto se revisa si el script
// mensual lo cambió.
let carga: { mtime: number; reader: Promise<Reader<CityResponse> | null> } | null = null
let revisado = 0

async function lector(): Promise<Reader<CityResponse> | null> {
  const ruta = process.env.DBIP_CIUDAD_MMDB || join(homedir(), "hetna-data", "dbip-city-lite.mmdb")
  if (carga && Date.now() - revisado < 60_000) return carga.reader
  revisado = Date.now()
  try {
    const { mtimeMs } = await stat(ruta)
    if (!carga || carga.mtime !== mtimeMs)
      carga = { mtime: mtimeMs, reader: readFile(ruta).then((b) => new Reader<CityResponse>(b)).catch(() => null) }
  } catch {
    carga = null // no hay base: sólo código postal
  }
  return carga ? carga.reader : null
}

const privada = { "Cache-Control": "private, no-store", Vary: "X-Forwarded-For" }

export async function GET(req: Request) {
  const ip = ipDe(req.headers)
  const r = ip ? await lector() : null
  let dato: CityResponse | null = null
  try {
    dato = r ? r.get(ip) : null
  } catch {
    dato = null // IP mal formada
  }
  if (!dato || dato.country?.iso_code !== "MX") return Response.json({}, { headers: privada })
  const sub = dato.subdivisions?.[0]?.names
  const estado = normalizarEstado(sub?.es || sub?.en)
  const ciudad = dato.city?.names?.es || dato.city?.names?.en || ""
  return Response.json(estado ? { estado, ciudad } : {}, { headers: privada })
}
