// GET /store/hetna-cloud/:token — lo que se ve en una liga compartida de
// HetNa Cloud: el proyecto, sus piezas y los archivos (sólo la última
// revisión de cada uno; por defecto sólo los liberados), con ligas firmadas
// de 1 hora. Nunca los datos del cliente ni las notas internas del taller.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrls } from "../../../../lib/backblaze"
import { CATEGORIAS, ESTADOS, ORDEN_REVISIONES, T_ARCHIVO, T_LIGA, T_PIEZA, T_PROYECTO, asegurarCloud, esDeMedusa, ligaMedusa, vigentes } from "../../../../lib/cloud"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  res.setHeader("Cache-Control", "no-store")
  const token = String(req.params.token || "")
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return res.status(404).json({ message: "Liga no válida." })
  await asegurarCloud(knex)
  const l = await knex(T_LIGA).where({ token }).first()
  if (!l || l.revocada_en || new Date(l.vence).getTime() < Date.now()) {
    return res.status(404).json({ message: "Esta liga ya venció o el taller la desactivó." })
  }
  const [p, taller] = await Promise.all([
    knex(T_PROYECTO).where({ id: l.proyecto_id, seller_id: l.seller_id }).first("id", "nombre", "estado"),
    knex("seller").where({ id: l.seller_id }).first("name", "handle"),
  ])
  if (!p) return res.status(404).json({ message: "El proyecto ya no existe." })

  const q = vigentes(knex(T_ARCHIVO).where({ proyecto_id: p.id, seller_id: l.seller_id }))
  if (l.solo_liberados) q.where({ estado: "liberado" })
  const [piezas, filas] = await Promise.all([
    knex(T_PIEZA).where({ proyecto_id: p.id }).orderBy("created_at").select("id", "nombre", "material", "cantidad"),
    q.orderByRaw(ORDEN_REVISIONES).select("id", "pieza_id", "nombre", "ext", "tamano", "categoria", "revision", "estado", "clave", "created_at"),
  ])
  // Sólo la última revisión de cada nombre en cada pieza
  const vistos = new Set<string>()
  const ultimos = (filas as any[]).filter((a) => {
    const k = `${a.pieza_id || ""}|${String(a.nombre).toLowerCase()}`
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  }).slice(0, 200)
  // Los del taller se firman por carpeta del proyecto; los del cliente, uno por uno.
  const carpeta = `cloud/${l.seller_id}/${p.id}/`
  const ligas = await getSignedDownloadUrls(
    ultimos.map((a) => a.clave).filter((c) => !esDeMedusa(c)),
    15 * 60,
    (c) => (c.startsWith(carpeta) ? carpeta : c),
    "attachment"
  ).catch(() => new Map<string, string>())
  for (const a of ultimos.filter((x) => esDeMedusa(x.clave))) {
    const url = await ligaMedusa(req.scope, a.clave)
    if (url) ligas.set(a.clave, url)
  }
  const archivos = ultimos.map((a) => ({
    id: a.id,
    pieza_id: a.pieza_id,
    nombre: a.nombre,
    ext: a.ext,
    tamano: Number(a.tamano) || 0,
    categoria: (CATEGORIAS as any)[a.categoria] || a.categoria,
    revision: a.revision,
    estado: (ESTADOS as any)[a.estado] || a.estado,
    fecha: a.created_at,
    url: ligas.get(a.clave) || null,
  }))
  await knex(T_LIGA).where({ token }).increment("vistas", 1)
  return res.json({
    taller: taller ? { nombre: taller.name, handle: taller.handle } : null,
    proyecto: { nombre: p.nombre },
    piezas,
    archivos,
    vence: l.vence,
    solo_liberados: l.solo_liberados,
  })
}
