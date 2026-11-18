// @ts-nocheck
// Borra del almacenamiento del servidor las imágenes y videos que el sistema
// GENERÓ para redes (Estudio, plan, promociones, temporada, Fábrica…) cuando ya
// pasaron N días (Configuración → borrar_medios_dias; 0 = nunca). Las redes
// guardan su propia copia, así que lo publicado no se pierde.
//
// Nunca toca: fotos de productos, archivos de talleres o clientes, la
// Biblioteca de fondos y música, ni lo que todavía está en una publicación
// pendiente (borrador / programada / publicando).
import fs from "fs"
import path from "path"

import { T_POST, leerConfig } from "./social-hub"

// Sólo archivos con estos prefijos (los pone fabrica/index.subir: "<marca de tiempo>-<prefijo>-…")
export const GENERADOS = /^\d{10,}-(estudio|plan|promo|temporada|fabrica|tarjeta|semanal|oportunidad|campana)-[\w.-]+\.(mp4|png|jpe?g|webp|wav|mp3)$/i

export const carpetaArchivos = () => path.resolve(process.env.FILE_UPLOAD_DIR || "static")

export function candidatos(archivos: { nombre: string; mtimeMs: number }[], dias: number, ahora = Date.now()) {
  if (!dias || dias <= 0) return []
  const limite = ahora - dias * 86_400_000
  return archivos.filter((a) => GENERADOS.test(a.nombre) && a.mtimeMs < limite)
}

export async function limpiarMedios(knex: any, logger?: any, o: { dias?: number; simular?: boolean } = {}) {
  const cfg: any = await leerConfig(knex)
  const dias = o.dias ?? Number(cfg.borrar_medios_dias ?? 30)
  const dir = carpetaArchivos()
  if (!dias || dias <= 0 || !fs.existsSync(dir)) return { borrados: 0, mb: 0, dias }
  const archivos = fs.readdirSync(dir).map((nombre) => {
    try { return { nombre, mtimeMs: fs.statSync(path.join(dir, nombre)).mtimeMs, tam: fs.statSync(path.join(dir, nombre)).size } } catch { return null }
  }).filter(Boolean) as any[]
  const lista = candidatos(archivos, dias)
  if (!lista.length) return { borrados: 0, mb: 0, dias }
  // Lo que sigue en una publicación pendiente no se borra
  const pendientes = await knex(T_POST).whereIn("estado", ["borrador", "programada", "publicando"]).pluck("medios").catch(() => [])
  const enUso = JSON.stringify(pendientes)
  let borrados = 0, bytes = 0
  for (const a of lista) {
    if (enUso.includes(a.nombre)) continue
    if (!o.simular) {
      try { fs.unlinkSync(path.join(dir, a.nombre)) } catch { continue }
    }
    borrados++
    bytes += a.tam || 0
  }
  const mb = +(bytes / 1048576).toFixed(1)
  if (borrados) logger?.info?.(`[limpieza] ${o.simular ? "se borrarían" : "borrados"} ${borrados} archivos generados de más de ${dias} días (${mb} MB)`)
  return { borrados, mb, dias }
}
