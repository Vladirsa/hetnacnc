// "El taller vende más": cargador de catálogo (plantilla) y reglas de posventa.
const supaMock = jest.fn()
const avisoMock = jest.fn()
const subirMock = jest.fn()

jest.mock("../cotizador-suscripciones", () => {
  class ErrorSuscripcion extends Error {
    constructor(m: string, public status = 400) { super(m) }
  }
  return { ErrorSuscripcion, supa: (...a: any[]) => supaMock(...a), adminDesdeToken: jest.fn() }
})
jest.mock("../avisos-taller", () => ({ avisarTaller: (...a: any[]) => avisoMock(...a) }))
jest.mock("../cotizador-archivos", () => {
  const real = jest.requireActual("../cotizador-archivos")
  return { ...real, subirArchivo: (...a: any[]) => subirMock(...a) }
})
jest.mock("../resend", () => ({ sendEmail: jest.fn(async () => ({ sent: true })) }))
jest.mock("../cotizacion-liga", () => ({
  cotizacionPorToken: async (t: string) => {
    if (t !== TOKEN) throw Object.assign(new Error("no existe"), { status: 404 })
    return { id: "cot1", negocio_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }
  },
}))

import ExcelJS from "exceljs"

import { adminCargar, leerPlantilla, numero, plantillaXlsx } from "../cotizador-catalogo"
import { posventaPublica, reportarPosventa } from "../cotizador-posventa"

const PEDIDO = "11111111-2222-3333-4444-555555555555"
const TOKEN = "AbCdEfGh12345678XyZ"
const NEG = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

beforeEach(() => {
  supaMock.mockReset()
  avisoMock.mockReset()
  subirMock.mockReset()
})

describe("numero", () => {
  it("entiende precios escritos de varias formas", () => {
    expect(numero("$1,250.50 MXN")).toBe(1250.5)
    expect(numero("1.250,50")).toBe(1250.5)
    expect(numero(99)).toBe(99)
    expect(numero("")).toBeNull()
    expect(numero("gratis")).toBeNull()
  })
})

describe("leerPlantilla", () => {
  it("lee la plantilla oficial", async () => {
    const { filas, errores } = await leerPlantilla(await plantillaXlsx(), "p.xlsx")
    expect(errores).toEqual([])
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({ nombre: "Corte láser MDF 3 mm (por hoja 60×90)", precio: 180, unidad: "Hoja", categoria: "Corte láser", sku: "LAS-MDF3", costo: 95, iva: true })
  })

  it("acepta un Excel propio con encabezados parecidos y títulos arriba", async () => {
    const wb = new ExcelJS.Workbook()
    const h = wb.addWorksheet("Lista")
    h.addRow(["LISTA DE PRECIOS 2026"])
    h.addRow([])
    h.addRow(["Código", "Producto", "Precio", "IVA"])
    h.addRow(["A1", "Fresa 1/4", "$120.00", "No"])
    h.addRow(["A2", "Fresa 1/4", "$130.00", "No"])
    h.addRow(["A3", "Broca", "", ""])
    const { filas, errores } = await leerPlantilla(Buffer.from(await wb.xlsx.writeBuffer()), "lista.xlsx")
    expect(filas).toEqual([expect.objectContaining({ nombre: "Fresa 1/4", precio: 120, sku: "A1", iva: false, unidad: "Pieza" })])
    expect(errores).toHaveLength(2) // repetido y sin precio
  })

  it("lee CSV con punto y coma y comillas", async () => {
    const csv = '﻿Nombre;Precio de venta;Descripción\n"Grabado; logo";250;"Dice ""hola"""\n'
    const { filas } = await leerPlantilla(Buffer.from(csv), "a.csv")
    expect(filas[0]).toMatchObject({ nombre: "Grabado; logo", precio: 250, descripcion: 'Dice "hola"' })
  })

  it("rechaza archivos sin encabezados", async () => {
    await expect(leerPlantilla(Buffer.from("a,b\n1,2"), "x.csv")).rejects.toThrow(/encabezados/)
    await expect(leerPlantilla(Buffer.from("x"), "x.pdf")).rejects.toThrow(/xlsx o .csv/)
  })
})

describe("adminCargar", () => {
  const SOL = "99999999-8888-7777-6666-555555555555"
  const responder = (insertados: any[]) =>
    supaMock.mockImplementation(async (ruta: string, init?: any) => {
      if (ruta.startsWith("/rest/v1/catalogo_solicitudes?id=eq.") && !init) return [{ id: SOL, negocio_id: NEG, estado: "en_proceso", productos_cargados: 0 }]
      if (ruta.startsWith("/rest/v1/negocios")) return [{ id: NEG, nombre: "Taller Uno" }]
      if (ruta.startsWith("/rest/v1/productos?negocio_id")) return [{ nombre: "maquinado cnc aluminio (hora)" }]
      if (ruta.startsWith("/rest/v1/categorias_producto?negocio_id")) return []
      if (ruta === "/rest/v1/categorias_producto") return [{ id: "cat1" }]
      if (ruta === "/rest/v1/productos") { insertados.push(...JSON.parse(init.body)); return null }
      return null
    })

  it("probar no escribe nada y avisa cuáles ya existían", async () => {
    const insertados: any[] = []
    responder(insertados)
    const r: any = await adminCargar(SOL, { originalname: "p.xlsx", mimetype: "", size: 1, buffer: await plantillaXlsx() }, true)
    expect(r).toMatchObject({ taller: "Taller Uno", total: 2, nuevos: 1, ya_existian: 1 })
    expect(insertados).toEqual([])
    expect(avisoMock).not.toHaveBeenCalled()
  })

  it("carga sólo los nuevos en el taller correcto y le avisa", async () => {
    const insertados: any[] = []
    responder(insertados)
    const r: any = await adminCargar(SOL, { originalname: "p.xlsx", mimetype: "", size: 1, buffer: await plantillaXlsx() }, false)
    expect(r.cargados).toBe(1)
    expect(insertados).toEqual([expect.objectContaining({ negocio_id: NEG, nombre: "Corte láser MDF 3 mm (por hoja 60×90)", precio_venta: 180, categoria_id: "cat1", activo: true })])
    expect(avisoMock).toHaveBeenCalledWith(expect.objectContaining({ negocioId: NEG, tipo: "catalogo_listo" }), undefined)
  })
})

describe("adminCargar cuando la base rechaza todo", () => {
  it("no marca lista ni avisa, y dice por qué", async () => {
    const SOL = "99999999-8888-7777-6666-555555555555"
    supaMock.mockImplementation(async (ruta: string, init?: any) => {
      if (ruta.startsWith("/rest/v1/catalogo_solicitudes?id=eq.") && !init) return [{ id: SOL, negocio_id: NEG, estado: "en_proceso", productos_cargados: 0 }]
      if (ruta.startsWith("/rest/v1/negocios")) return [{ id: NEG, nombre: "Taller Uno" }]
      if (ruta.startsWith("/rest/v1/productos?negocio_id")) return []
      if (ruta.startsWith("/rest/v1/categorias_producto")) return []
      if (ruta === "/rest/v1/productos") throw new Error("Supabase 400: column negocio_id does not exist")
      return null
    })
    await expect(adminCargar(SOL, { originalname: "p.xlsx", mimetype: "", size: 1, buffer: await plantillaXlsx() }, false)).rejects.toThrow(/negocio_id/)
    expect(supaMock.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false)
    expect(avisoMock).not.toHaveBeenCalled()
  })
})

describe("reportarPosventa", () => {
  const pedido = (estado: string, casos: any[] = []) =>
    supaMock.mockImplementation(async (ruta: string) => {
      if (ruta.startsWith("/rest/v1/pedidos?cotizacion_id=eq.cot1")) return [{ id: PEDIDO, negocio_id: NEG, folio: "P-10", estado, cliente_id: "c1" }]
      if (ruta.startsWith("/rest/v1/posventa_casos?")) return casos
      return null
    })
  const ok = { tipo: "garantia", descripcion: "La pieza llegó con una rebaba grande", nombre: "Ana" }
  let ip = 0
  const nuevaIp = () => `10.0.0.${++ip}`

  it("la trampa para robots no guarda nada", async () => {
    await expect(reportarPosventa(TOKEN, { ...ok, sitio_web: "x" }, [], nuevaIp())).resolves.toEqual({ ok: true })
    expect(supaMock).not.toHaveBeenCalled()
  })

  it("sólo se abre con el pedido entregado (no basta 'listo para entrega')", async () => {
    pedido("Entrega")
    await expect(reportarPosventa(TOKEN, ok, [], nuevaIp())).rejects.toThrow(/entregado/)
  })

  it("sin la tabla, la liga dice que no está disponible en lugar de fallar", async () => {
    supaMock.mockImplementation(async (ruta: string) => {
      if (ruta.startsWith("/rest/v1/pedidos")) return [{ id: PEDIDO, negocio_id: NEG, folio: "P-10", estado: "Entregado" }]
      if (ruta.startsWith("/rest/v1/posventa_casos")) throw new Error('Supabase 404: {"code":"PGRST205","message":"posventa_casos"}')
      return null
    })
    await expect(posventaPublica(TOKEN)).resolves.toEqual({ disponible: false, casos: [] })
    await expect(reportarPosventa(TOKEN, ok, [], nuevaIp())).rejects.toThrow(/todavía no activa/)
  })

  it("pide una descripción y fotos válidas", async () => {
    pedido("Entregado")
    await expect(reportarPosventa(TOKEN, { descripcion: "mal" }, [], nuevaIp())).rejects.toThrow(/detalle/)
    await expect(
      reportarPosventa(TOKEN, ok, [{ originalname: "virus.exe", mimetype: "application/x", size: 10, buffer: Buffer.from("") }], nuevaIp())
    ).rejects.toThrow(/JPG/)
  })

  it("limita los casos abiertos por pedido", async () => {
    pedido("Entregado", [{ estado: "nuevo" }, { estado: "en_revision" }, { estado: "nuevo" }])
    await expect(reportarPosventa(TOKEN, ok, [], nuevaIp())).rejects.toThrow(/abiertos/)
  })

  it("guarda el caso con sus fotos en la carpeta del taller y le avisa", async () => {
    pedido("Entregado", [{ estado: "resuelto" }])
    const r = await reportarPosventa(TOKEN, ok, [{ originalname: "foto 1.JPG", mimetype: "image/jpeg", size: 100, buffer: Buffer.from("x") }], nuevaIp())
    expect(r.ok).toBe(true)
    expect(subirMock.mock.calls[0][0]).toMatch(new RegExp(`^${NEG}/posventa/[0-9a-f-]{36}/1_foto_1\\.JPG$`))
    const alta = supaMock.mock.calls.find((c) => c[0] === "/rest/v1/posventa_casos")
    expect(JSON.parse(alta![1].body)).toMatchObject({ negocio_id: NEG, pedido_id: PEDIDO, tipo: "garantia", folio: "P-10", fotos: [{ ruta: expect.any(String) }] })
    expect(avisoMock).toHaveBeenCalledWith(expect.objectContaining({ tipo: "posventa", negocioId: NEG, pedidoId: PEDIDO }), undefined)
  })

  it("frena a quien manda demasiados reportes", async () => {
    pedido("Entregado")
    const misma = "10.9.9.9"
    for (let i = 0; i < 5; i++) await reportarPosventa(TOKEN, ok, [], misma)
    await expect(reportarPosventa(TOKEN, ok, [], misma)).rejects.toThrow(/una hora/)
  })
})
