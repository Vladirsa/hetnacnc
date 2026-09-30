// Subir una foto del foro. El navegador ya la reduce (máx. 1600 px, WebP o JPG).
import { NextResponse } from "next/server"

import { sesionForo } from "@/lib/foro/consultas"
import { claveError, db } from "@/lib/foro/db"
import { MENSAJES, urlFoto } from "@/lib/foro/tipos"

const TIPOS = ["image/webp", "image/jpeg", "image/png"]
const MAX = 1024 * 1024

const error = (clave: string, status = 400) =>
  NextResponse.json({ ok: false, error: MENSAJES[clave] || clave }, { status })

// Revisa la firma del archivo, no solo lo que dice el navegador
function tipoReal(b: Buffer): string | null {
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp"
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  if (b.length > 8 && b.toString("hex", 0, 8) === "89504e470d0a1a0a") return "image/png"
  return null
}

export async function POST(req: Request) {
  const s = await sesionForo()
  if (!s) return error("sin_sesion", 401)
  if (!s.perfil) return error("sin_perfil", 403)
  if (s.perfil.suspendido) return error("perfil_suspendido", 403)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return error("error")
  }
  const archivo = form.get("foto")
  if (!(archivo instanceof Blob)) return error("Elige una foto.")
  if (archivo.size > MAX) return error("La foto pesa más de 1 MB.")
  const datos = Buffer.from(await archivo.arrayBuffer())
  const tipo = tipoReal(datos)
  if (!tipo || !TIPOS.includes(tipo)) return error("Solo fotos JPG, PNG o WebP.")
  const ancho = Math.round(Number(form.get("ancho")))
  const alto = Math.round(Number(form.get("alto")))
  if (!(ancho >= 1 && ancho <= 4000 && alto >= 1 && alto <= 4000)) return error("error")

  try {
    const hoy = await db().query(
      `select count(*) as n from foro.fotos where perfil_id = $1 and creado > now() - interval '1 day'`,
      [s.perfil.id]
    )
    if (Number(hoy.rows[0].n) >= 40 && s.perfil.rol === "usuario") return error("limite_diario", 429)
    const { rows } = await db().query(
      `insert into foro.fotos (perfil_id, tipo, ancho, alto, datos) values ($1, $2, $3, $4, $5) returning id`,
      [s.perfil.id, tipo, ancho, alto, datos]
    )
    return NextResponse.json({ ok: true, id: rows[0].id, url: urlFoto(rows[0].id) })
  } catch (e) {
    return error(claveError(e), 500)
  }
}
