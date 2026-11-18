jest.mock("../backblaze", () => ({ uploadFile: jest.fn(async (_b: Buffer, k: string) => ({ ok: true, storageKey: k })) }))
jest.mock("../fabrica/estudio", () => ({ fal: jest.fn() }))
jest.mock("../fabrica/index", () => ({ subir: jest.fn() }))

import { extension, guardarArchivo, nombreSeguro, nuevoSku, prepararImagen, revisarParaPublicar, slug } from "../subir-disenos"

describe("subir diseños", () => {
  it("SKU único con fecha", () => {
    expect(nuevoSku(new Date("2026-11-18T12:00:00Z"))).toMatch(/^HCNC-S-261118-[0-9A-F]{4}$/)
    expect(nuevoSku()).not.toBe(nuevoSku())
  })
  it("nombres seguros para la llave", () => {
    expect(nombreSeguro("Bandeja Navideña (2).DXF")).toBe("Bandeja-Navidena-2.dxf")
    expect(extension("a.b.STL")).toBe("stl")
    expect(slug("Bandeja navideña 30x20 — DXF HCNC-S-1")).toBe("bandeja-navidena-30x20-dxf-hcnc-s-1")
  })
  it("guarda en originales/<sku>/ y rechaza formatos raros", async () => {
    const r = await guardarArchivo(Buffer.from("x"), "Mi Diseño.dxf", "HCNC-S-261118-AB12")
    expect(r).toMatchObject({ sku: "HCNC-S-261118-AB12", storage_key: "originales/HCNC-S-261118-AB12/Mi-Diseno.dxf", formato: "DXF" })
    await expect(guardarArchivo(Buffer.from("x"), "virus.exe")).rejects.toThrow(/no permitido/)
  })
  it("no publica sin derechos, archivo, imagen o precio", () => {
    const ok = { derechos_confirmados: true, archivo_storage_key: "originales/HCNC-S-1/a.dxf", sku: "HCNC-S-1", titulo: "Bandeja", handle: "bandeja-hcnc-s-1", descripcion_larga: "Una bandeja navideña", precio_mxn: 49, imagen_url: "https://x/y.jpg" }
    expect(revisarParaPublicar(ok)).toBeNull()
    expect(revisarParaPublicar({ ...ok, derechos_confirmados: false })).toMatch(/derecho/)
    expect(revisarParaPublicar({ ...ok, archivo_storage_key: "solicitudes/x" })).toMatch(/archivo/)
    expect(revisarParaPublicar({ ...ok, imagen_url: "" })).toMatch(/imagen/)
    expect(revisarParaPublicar({ ...ok, precio_mxn: 0 })).toMatch(/precio/)
    expect(revisarParaPublicar({ ...ok, precio_mxn: 0, gratis: true })).toBeNull()
    expect(revisarParaPublicar({ ...ok, handle: "Mala Dirección" })).toMatch(/handle/)
  })
})

describe("imagen tal cual", () => {
  it("la deja cuadrada de 1200 px en JPG sobre blanco", async () => {
    const sharp = (await import("sharp")).default
    const { subir } = jest.requireMock("../fabrica/index")
    let guardado: Buffer = Buffer.alloc(0)
    subir.mockImplementation(async (_s: any, _n: string, _m: string, b: Buffer) => { guardado = b; return "https://cdn/x.jpg" })
    const png = await sharp({ create: { width: 800, height: 400, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
    const r = await prepararImagen({}, png, "foto.png", "original")
    expect(r).toEqual({ url: "https://cdn/x.jpg", modo: "original" })
    const meta = await sharp(guardado).metadata()
    expect([meta.width, meta.height, meta.format]).toEqual([1200, 1200, "jpeg"])
  })
})
