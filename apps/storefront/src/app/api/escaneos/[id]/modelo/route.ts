// Entrega el STL de un escaneo al visor 3D del propio cliente.
//
// El archivo vive en el bucket privado de Backblaze. El backend sólo firma la
// descarga si el escaneo es de quien tiene la sesión (cargarEscaneo usa sus
// cookies), y aquí se baja del lado del servidor: el navegador nunca ve el
// enlace firmado ni necesita permiso de CORS hacia Backblaze.
import { NextResponse } from "next/server"

import { cargarEscaneo } from "@/lib/escaneos/acciones"

const MAX = 150 * 1024 * 1024

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^esc3d_[A-Za-z0-9]+$/.test(id)) return NextResponse.json({ mensaje: "Escaneo inválido" }, { status: 400 })

  const res = await cargarEscaneo(id)
  if (!res.ok) return NextResponse.json({ mensaje: "No encontrado" }, { status: 404 })
  const glb = new URL(req.url).searchParams.get("formato") === "glb"
  const url = glb ? res.datos.descargas?.glb : res.datos.descargas?.stl
  if (!url) return NextResponse.json({ mensaje: "El escaneo todavía no tiene archivo" }, { status: 404 })

  const archivo = await fetch(url, { cache: "no-store" })
  if (!archivo.ok || !archivo.body) return NextResponse.json({ mensaje: "No se pudo leer el archivo" }, { status: 502 })
  const largo = Number(archivo.headers.get("content-length") || 0)
  if (largo > MAX) return NextResponse.json({ mensaje: "El archivo es demasiado grande para la vista 3D" }, { status: 413 })

  return new NextResponse(archivo.body, {
    headers: {
      "content-type": glb ? "model/gltf-binary" : "model/stl",
      "cache-control": "private, max-age=600",
      ...(largo ? { "content-length": String(largo) } : {}),
    },
  })
}
