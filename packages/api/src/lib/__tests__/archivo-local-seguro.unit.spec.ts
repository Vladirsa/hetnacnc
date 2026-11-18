import fs from "fs"
import os from "os"
import path from "path"

import { ArchivoLocalSeguroService, motivoArchivoProhibido, nombreSeguro, pareceHtml, tipoServido } from "../../modules/archivo-local-seguro/service"

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

  it("no se salta con un nombre que es sólo la extensión ni con la familia XML", () => {
    // file-local lo guarda como "<hora>-.html" y /static lo serviría como página
    expect(tipoServido(".html")).toBe("text/html")
    for (const n of [".html", ".svg", " .html", "a.xsd", "ruta.kml", "x.gpx", "feed.rss", "x.xhtml", "m.mjs", "c.htc", "w.wasm", "dir/.htm"]) {
      expect(motivoArchivoProhibido({ filename: n, content: b64("x") })).toBeTruthy()
    }
    // Lo que se sirve como descarga o texto sí pasa
    for (const n of ["x.html.", "notas.txt", "programa.nc", "post.cps", "sinextension"]) {
      expect(motivoArchivoProhibido({ filename: n, content: b64("x") })).toBeNull()
    }
  })

  it("los entregables privados con página o script se guardan como descarga", async () => {
    expect(nombreSeguro({ filename: "hoja.html", access: "private" })).toBe("hoja.html.descarga")
    expect(nombreSeguro({ filename: "post.js", access: "private" })).toBe("post.js.descarga")
    expect(nombreSeguro({ filename: "hoja.html", access: "public" })).toBeNull()
    expect(nombreSeguro({ filename: "foto.png", access: "private" })).toBeNull()
    expect(nombreSeguro({ filename: "setup.exe", access: "private" })).toBeNull()
    expect(tipoServido("hoja.html.descarga")).toBe("application/octet-stream")
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "archivos-"))
    const svc = new ArchivoLocalSeguroService({} as any, { upload_dir: dir, private_upload_dir: dir, backend_url: "https://ejemplo.mx/static" } as any)
    const r = await svc.upload({ filename: "hoja.html", mimeType: "text/html", content: b64("<html></html>"), access: "private" })
    expect(r.url).toMatch(/hoja\.html\.descarga$/)
    await expect(svc.upload({ filename: "setup.exe", mimeType: "application/octet-stream", content: b64("MZ"), access: "private" })).rejects.toThrow()
    fs.rmSync(dir, { recursive: true, force: true })
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
