import fs from "fs"
import os from "os"
import path from "path"

import { ArchivoLocalSeguroService, motivoArchivoProhibido, pareceHtml } from "../../modules/archivo-local-seguro/service"

const b64 = (s: string | Buffer) => Buffer.from(s as any).toString("base64")
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82])

describe("Archivos locales con filtro", () => {
  it("rechaza páginas, SVG, scripts e instaladores por extensión", () => {
    for (const n of ["factura.html", "logo.SVG", "x.htm", "foto.jpg.html", "a.js", "setup.exe", "acceso.lnk", "pagina.xhtml", "macro.hta", "datos.xml"]) {
      expect(motivoArchivoProhibido({ filename: n, content: b64("hola") })).toMatch(/No se permiten/)
    }
  })

  it("rechaza por tipo declarado y por contenido aunque el nombre diga imagen", () => {
    expect(motivoArchivoProhibido({ filename: "foto.png", mimeType: "text/html", content: b64(PNG) })).toBeTruthy()
    expect(motivoArchivoProhibido({ filename: "foto.jpg", mimeType: "image/jpeg", content: b64("<html><script>alert(1)</script></html>") })).toMatch(/no es lo que dice/)
    expect(motivoArchivoProhibido({ filename: "foto.png", content: "<svg xmlns='http://www.w3.org/2000/svg' onload='x()'>" })).toMatch(/no es lo que dice/)
    expect(pareceHtml("﻿  <!DOCTYPE html><html>")).toBe(true)
  })

  it("deja pasar lo normal: imágenes, video, pdf, csv, modelos 3D y sin extensión", () => {
    expect(motivoArchivoProhibido({ filename: "foto.png", mimeType: "image/png", content: b64(PNG) })).toBeNull()
    expect(motivoArchivoProhibido({ filename: "foto.html.jpg", mimeType: "image/jpeg", content: b64(Buffer.from([0xff, 0xd8, 0xff, 0xe0])) })).toBeNull()
    for (const n of ["productos.csv", "pieza.step", "pieza.stl", "video.mp4", "plano.pdf", "datos.json", "export"]) {
      expect(motivoArchivoProhibido({ filename: n, content: b64("contenido cualquiera, con <b> en medio") })).toBeNull()
    }
  })

  it("el proveedor guarda la imagen y no guarda la página", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "archivos-"))
    const svc = new ArchivoLocalSeguroService({} as any, { upload_dir: dir, private_upload_dir: dir, backend_url: "https://ejemplo.mx/static" } as any)
    const ok = await svc.upload({ filename: "foto.png", mimeType: "image/png", content: b64(PNG), access: "public" })
    expect(ok.url).toMatch(/^https:\/\/ejemplo\.mx\/static\/\d+-foto\.png$/)
    await expect(svc.upload({ filename: "factura.html", mimeType: "text/html", content: b64("<html></html>"), access: "public" })).rejects.toThrow(/No se permiten/)
    await expect(svc.getUploadStream({ filename: "x.svg", mimeType: "image/svg+xml", access: "public" })).rejects.toThrow(/No se permiten/)
    expect(fs.readdirSync(dir)).toHaveLength(1)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
