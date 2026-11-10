// Icono del HETNA Panel: el icono de HETNA con una franja naranja "PANEL".
// Se arma aquí (sharp) para no guardar binarios en el repositorio.
// /icons/panel-192.png · /icons/panel-512.png
import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(_: Request, { params }: { params: Promise<{ tam: string }> }) {
  const { tam } = await params
  const n = tam === "192" ? 192 : 512
  const cab = { "content-type": "image/png", "cache-control": "public, max-age=86400" }
  try {
    const sharp = (await import("sharp")).default
    const base = await readFile(path.join(process.cwd(), "public", "icons", "icon-512.png"))
    const franja = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
        <rect x="0" y="378" width="512" height="134" fill="#C2560A"/>
        <text x="256" y="474" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="88" fill="#ffffff">PANEL</text>
      </svg>`
    )
    const base512 = await sharp(base).resize(512, 512).png().toBuffer()
    const con = await sharp(base512).composite([{ input: franja }]).png().toBuffer()
    const png = n === 512 ? con : await sharp(con).resize(n, n).png().toBuffer()
    return new NextResponse(png, { headers: cab })
  } catch {
    // Si sharp no está, se sirve el icono normal de HETNA
    const base = await readFile(path.join(process.cwd(), "public", "icons", n === 192 ? "icon-192.png" : "icon-512.png"))
    return new NextResponse(base, { headers: cab })
  }
}
