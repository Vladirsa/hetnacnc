import { leerCfdi } from "../conta/cfdi"
import type { FilaCfdi } from "../conta/motor"
import { categoriaInicial } from "../conta/almacen"
import { auditar } from "../conta/auditor"
import { leerListaCsv, partirCsv } from "../conta/sat"
import { RFC_YO, cfdi, rep } from "../conta/__tests__/cfdi-fixtures"

const fila = (xml: string, extra: Partial<FilaCfdi> = {}): FilaCfdi => { const c = leerCfdi(xml); const d = c.emisor_rfc === RFC_YO ? "emitido" : "recibido"; return { uuid: c.uuid, direccion: d, tipo: c.tipo, categoria: categoriaInicial(c, d), datos: c, ...extra } }
const PROV = { emisor: "AAA010101AAA", emisorNombre: "PROVEEDOR SA", receptor: RFC_YO, receptorRegimen: "612", receptorCp: "90000", uso: "G03" }
const ctx = { rfc: RFC_YO, regimen: "612", cp: "90000", listas: {} as any, hoy: new Date("2026-11-15T12:00:00") }
const reglas = (filas: FilaCfdi[], c = ctx) => auditar(filas, c).map((h) => `${h.regla}:${h.uuid}`).sort()

describe("Auditor fiscal y forense", () => {
  it("una factura limpia no genera hallazgos", () => {
    expect(reglas([fila(cfdi({ uuid: "ok1", fecha: "2026-11-10T10:00:00", ...PROV }))])).toEqual([])
  })

  it("lista negra 69-B y no localizados", () => {
    const f = [fila(cfdi({ uuid: "efos", fecha: "2026-11-10T10:00:00", ...PROV, emisor: "EFO010101AAA" })), fila(cfdi({ uuid: "pres", fecha: "2026-11-10T10:00:00", ...PROV, emisor: "PRE010101AAA" })), fila(cfdi({ uuid: "nl", fecha: "2026-11-10T10:00:00", ...PROV, emisor: "NOL010101AAA" }))]
    const listas = { EFO010101AAA: [{ lista: "69B", situacion: "Definitivo" }], PRE010101AAA: [{ lista: "69B", situacion: "Presunto" }], NOL010101AAA: [{ lista: "NO_LOCALIZADO", situacion: "NO LOCALIZADOS" }] }
    const hs = auditar(f, { ...ctx, listas })
    expect(hs.find((h) => h.uuid === "EFOS")?.severidad).toBe("alta")
    expect(hs.find((h) => h.uuid === "PRES")?.regla).toBe("X01b")
    expect(hs.find((h) => h.uuid === "NL")?.regla).toBe("X02")
    // Desvirtuado o sentencia favorable: no se marca
    expect(auditar(f, { ...ctx, listas: { EFO010101AAA: [{ lista: "69B", situacion: "Desvirtuado" }] } }).length).toBe(0)
  })

  it("cancelada en el SAT, no encontrada y duplicada", () => {
    const r = reglas([
      fila(cfdi({ uuid: "can", fecha: "2026-11-10T10:00:00", ...PROV }), { estatus_sat: "cancelado" }),
      fila(cfdi({ uuid: "nf", fecha: "2026-11-11T10:00:00", ...PROV, subtotal: 777 }), { estatus_sat: "no_encontrado" }),
      fila(cfdi({ uuid: "d1", fecha: "2026-11-12T10:00:00", ...PROV, subtotal: 4321 })),
      fila(cfdi({ uuid: "d2", fecha: "2026-11-12T18:00:00", ...PROV, subtotal: 4321 })),
    ])
    expect(r).toEqual(["X03:CAN", "X03b:NF", "X06:D1", "X06:D2"])
  })

  it("datos del receptor, efectivo, combustible, uso S01 y restaurante", () => {
    const r = reglas([
      fila(cfdi({ uuid: "reg", fecha: "2026-11-10T10:00:00", ...PROV, receptorRegimen: "626", subtotal: 1001 })),
      fila(cfdi({ uuid: "cp", fecha: "2026-11-10T10:00:00", ...PROV, receptorCp: "01000", subtotal: 1002 })),
      fila(cfdi({ uuid: "efe", fecha: "2026-11-10T10:00:00", ...PROV, forma: "01", subtotal: 5000 })),
      fila(cfdi({ uuid: "gas", fecha: "2026-11-10T10:00:00", ...PROV, forma: "01", subtotal: 500, descripcion: "Gasolina magna" })),
      fila(cfdi({ uuid: "s01", fecha: "2026-11-10T10:00:00", ...PROV, uso: "S01", subtotal: 1003 })),
      fila(cfdi({ uuid: "res", fecha: "2026-11-10T10:00:00", ...PROV, forma: "04", descripcion: "Consumo de alimentos en restaurante", subtotal: 1004 })),
    ])
    expect(r).toEqual(["F01:REG", "F01b:CP", "F05:EFE", "F06:GAS", "F07:RES"]) // S01 queda como no deducible, no como gasto
  })

  it("PPD sin complemento a 60 días, y se calla cuando llega el pago", () => {
    const ppd = fila(cfdi({ uuid: "ppd", fecha: "2026-08-01T10:00:00", metodo: "PPD", forma: "99", receptor: "EKU9003173C9" }))
    expect(reglas([ppd])).toEqual(["F03:PPD"])
    const pago = fila(rep({ uuid: "rp", fechaPago: "2026-08-20T10:00:00", doc: "PPD", pagado: 1160, saldoAnt: 1160 }))
    expect(reglas([ppd, pago])).toEqual([])
  })

  it("forma de pago incoherente, nota de crédito suelta, IVA 0% y timbrado tardío", () => {
    const r = reglas([
      fila(cfdi({ uuid: "f8", fecha: "2026-11-10T10:00:00", metodo: "PPD", forma: "03", receptor: "EKU9003173C9" })),
      fila(cfdi({ uuid: "nc", fecha: "2026-11-10T10:00:00", tipo: "E", receptor: "EKU9003173C9" })),
    ])
    expect(r).toEqual(["F08:F8", "F09:NC"])
  })

  it("monto redondo con concepto genérico", () => {
    const r = reglas([fila(cfdi({ uuid: "red", fecha: "2026-11-10T10:00:00", ...PROV, subtotal: 80000, descripcion: "Servicios", claveProd: "01010101" }))])
    expect(r).toEqual(["X07:RED"])
  })
})

describe("Listas del SAT", () => {
  it("lee el CSV con avisos antes del encabezado y nombres con comas", () => {
    const csv = `"Aviso del SAT, información actualizada",,,\nListado completo,,,\nNo,RFC,Nombre del Contribuyente,Situación del contribuyente\n1,AAA080808HL8,"ASESORES, S.A. DE C.V.",Definitivo\n2,MAL,"X",Presunto\n`
    expect(leerListaCsv(csv, "69B")).toEqual([{ rfc: "AAA080808HL8", situacion: "Definitivo", nombre: "ASESORES, S.A. DE C.V." }])
    expect(partirCsv('a,"b ""c"", d",e')).toEqual(["a", 'b "c", d', "e"])
  })
})
