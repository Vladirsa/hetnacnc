import net from "node:net"

import { PELIGROSAS, nombresZip, revisarArchivo } from "../archivo-seguro"

// ZIP mínimo armado a mano (sin comprimir): cabeceras locales, directorio central y cierre.
function zipCon(nombres: string[]): Buffer {
  const locales: Buffer[] = []
  const centrales: Buffer[] = []
  let pos = 0
  for (const n of nombres) {
    const nombre = Buffer.from(n, "utf8")
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(nombre.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(nombre.length, 28)
    central.writeUInt32LE(pos, 42)
    locales.push(local, nombre)
    centrales.push(central, nombre)
    pos += 30 + nombre.length
  }
  const dir = Buffer.concat(centrales)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(nombres.length, 8)
  fin.writeUInt16LE(nombres.length, 10)
  fin.writeUInt32LE(dir.length, 12)
  fin.writeUInt32LE(pos, 16)
  return Buffer.concat([...locales, dir, fin])
}

const RAR = Buffer.concat([Buffer.from("Rar!\x1a\x07\x00", "latin1"), Buffer.alloc(64)])
const SIETE_Z = Buffer.concat([Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]), Buffer.alloc(64)])

describe("revisión de archivos subidos (lib/archivo-seguro)", () => {
  const antes = { host: process.env.CLAMAV_HOST, port: process.env.CLAMAV_PORT, socket: process.env.CLAMAV_SOCKET }
  beforeEach(() => {
    // Sin antivirus: un socket que no existe
    delete process.env.CLAMAV_HOST
    delete process.env.CLAMAV_PORT
    process.env.CLAMAV_SOCKET = ""
  })
  afterAll(() => {
    for (const [k, v] of [["CLAMAV_HOST", antes.host], ["CLAMAV_PORT", antes.port], ["CLAMAV_SOCKET", antes.socket]] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it("el ZIP de prueba se lee bien", () => {
    expect(nombresZip(zipCon(["a/plano.dxf", "b.pdf"]))?.nombres).toEqual(["a/plano.dxf", "b.pdf"])
  })

  it("acepta un ZIP de planos", async () => {
    const r = await revisarArchivo(zipCon(["pieza.dxf", "planos/vista.pdf", "foto.jpg", "modelo.step"]), "proyecto.zip")
    expect(r.ok).toBe(true)
  })

  it("la lista incluye accesos directos, imágenes de disco, páginas y macros", () => {
    for (const e of ["lnk", "iso", "img", "vhd", "vhdx", "chm", "url", "html", "htm", "hta", "docm", "xlsm", "pptm", "jar", "msi", "scr", "ps1", "vbs", "js", "wsf", "reg"]) {
      expect(PELIGROSAS.has(e)).toBe(true)
    }
  })

  it.each(["factura.pdf.lnk", "disco.iso", "respaldo.IMG", "disco.vhdx", "ayuda.chm", "liga.url", "ver.html", "index.HTM", "cotizacion.docm", "lista.xlsm", "presenta.pptm", "instalar.exe", "x.js"])(
    "rechaza un ZIP que trae %s",
    async (malo) => {
      const r = await revisarArchivo(zipCon(["pieza.dxf", `carpeta/${malo}`]), "proyecto.zip")
      expect(r.ok).toBe(false)
      expect((r as { motivo: string }).motivo).toContain(malo)
    }
  )

  it("sin antivirus rechaza RAR y 7z (no se pueden revisar por dentro)", async () => {
    for (const [b, n] of [[RAR, "planos.rar"], [SIETE_Z, "planos.7z"]] as const) {
      const r = await revisarArchivo(b, n)
      expect(r.ok).toBe(false)
      expect((r as { motivo: string }).motivo).toContain("ZIP")
    }
  })

  it("sin antivirus un ZIP limpio sigue entrando, marcado sin antivirus", async () => {
    const r = await revisarArchivo(zipCon(["pieza.dxf"]), "proyecto.zip")
    expect(r).toMatchObject({ ok: true, antivirus: "sin_antivirus" })
  })

  describe("con antivirus", () => {
    let servidor: net.Server
    let respuesta = "stream: OK\0"
    beforeAll(
      () =>
        new Promise<void>((listo) => {
          // clamd de mentira: contesta al recibir el trozo final (4 bytes en cero)
          servidor = net.createServer((s) => {
            let todo = Buffer.alloc(0)
            s.on("data", (d) => {
              todo = Buffer.concat([todo, d])
              if (todo.length >= 4 && todo.subarray(todo.length - 4).equals(Buffer.alloc(4))) s.end(respuesta)
            })
            s.on("error", () => undefined)
          })
          servidor.listen(0, "127.0.0.1", () => listo())
        })
    )
    afterAll(() => new Promise<void>((listo) => servidor.close(() => listo())))
    beforeEach(() => {
      process.env.CLAMAV_HOST = "127.0.0.1"
      process.env.CLAMAV_PORT = String((servidor.address() as net.AddressInfo).port)
    })

    it("acepta un RAR que el antivirus revisó y dio por limpio", async () => {
      respuesta = "stream: OK\0"
      expect(await revisarArchivo(RAR, "planos.rar")).toMatchObject({ ok: true, antivirus: "limpio" })
    })

    it("rechaza lo que el antivirus marca", async () => {
      respuesta = "stream: Win.Test.EICAR_HDB-1 FOUND\0"
      const r = await revisarArchivo(SIETE_Z, "planos.7z")
      expect(r.ok).toBe(false)
      expect((r as { motivo: string }).motivo).toContain("amenaza")
    })

    it("rechaza un RAR que el antivirus no alcanzó a revisar", async () => {
      respuesta = "INSTREAM size limit exceeded. ERROR\0"
      expect((await revisarArchivo(RAR, "planos.rar")).ok).toBe(false)
    })
  })
})
