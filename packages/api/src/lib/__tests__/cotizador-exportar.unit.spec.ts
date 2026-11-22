import { strFromU8, unzipSync } from "fflate"

import { TABLAS_EXCLUIDAS, aCsv, exportarTaller, negocioDeAdmin } from "../cotizador-exportar"

const NEG = "11111111-2222-3333-4444-555555555555"
const llamadas: string[] = []
const datos: Record<string, any[]> = {
  negocios: [{ id: NEG, nombre: "Taller Ñandú", api_key: "SECRETA" }],
  clientes: [{ id: "c1", negocio_id: NEG, nombre: 'Ana "La jefa"', telefono: "555" }],
  cotizaciones: [{ id: "q1", negocio_id: NEG, total: 100 }],
  pedidos: [{ id: "p1", negocio_id: NEG, folio: "P-1" }],
  cotizacion_items: [{ id: "i1", cotizacion_id: "q1", descripcion: "Corte" }],
  pedido_avances: [{ id: "a1", pedido_id: "p1", etapa: "Produccion" }],
}

beforeEach(() => {
  llamadas.length = 0
  process.env.COTIZADOR_SUPABASE_SERVICE_KEY = "k"
  global.fetch = (async (url: string) => {
    const u = new URL(url)
    llamadas.push(u.pathname + u.search)
    const tabla = u.pathname.split("/").pop()!
    if (tabla === "gastos") return new Response("no existe", { status: 400 })
    if (u.search.includes("offset=") && !u.search.includes("offset=0")) return new Response("[]", { status: 200 })
    return new Response(JSON.stringify(datos[tabla] || []), { status: 200 })
  }) as any
})

describe("Exportar los datos del taller", () => {
  it("ZIP con CSV y JSON por tabla, hijas por su padre, sin secretos ni tablas de llaves", async () => {
    const r = await exportarTaller(NEG, "Taller Ñandú")
    const z = unzipSync(r.zip)
    const leeme = strFromU8(z["LEEME.txt"])
    expect(leeme).toMatch(/clientes: 1/)
    expect(leeme).toMatch(/cotizacion_items: 1/)
    expect(leeme).toMatch(/No se pudieron leer[\s\S]*gastos/)
    expect(strFromU8(z["csv/clientes.csv"])).toContain('"Ana ""La jefa"""')
    expect(strFromU8(z["json/negocios.json"])).not.toContain("SECRETA")
    expect(llamadas.some((l) => l.includes("cotizacion_items?cotizacion_id=in.(q1)"))).toBe(true)
    expect(llamadas.some((l) => l.includes("pedido_avances?pedido_id=in.(p1)"))).toBe(true)
    for (const t of TABLAS_EXCLUIDAS) expect(llamadas.some((l) => l.includes(`/${t}?`))).toBe(false)
    expect(llamadas.every((l) => l.includes(NEG) || l.includes("in.("))).toBe(true)
  })

  it("rechaza un id raro y sólo el administrador puede exportar", async () => {
    await expect(exportarTaller("1 or 1=1", "x")).rejects.toThrow(/inválido/)
    global.fetch = (async (url: string) => {
      if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "u1" }), { status: 200 })
      if (url.includes("usuarios_negocio")) return new Response(JSON.stringify([{ negocio_id: NEG, rol: "vendedor" }]), { status: 200 })
      return new Response("[]", { status: 200 })
    }) as any
    await expect(negocioDeAdmin("tok")).rejects.toThrow(/administrador/)
    await expect(negocioDeAdmin(undefined)).rejects.toThrow(/Inicia sesión/)
  })

  it("CSV listo para Excel: BOM y comillas", () => {
    expect(aCsv([{ a: 1, b: { x: 2 } }])).toBe('﻿"a","b"\r\n"1","{""x"":2}"')
    expect(aCsv([])).toBe("﻿")
  })
})
