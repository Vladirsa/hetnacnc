import { readFileSync } from "fs"
import { join } from "path"

import { correoSeguimiento } from "../estimados"
import { DXF_MAX, HERRAMIENTAS, correoHerramientaHtml, esDxf, validarHerramientaCorreo } from "../herramienta-correo"

// "Mándamelo por correo" de las herramientas del Estudio (lib/herramienta-correo.ts)
describe("Mándamelo por correo (herramientas del Estudio)", () => {
  const dxf = readFileSync(join(__dirname, "fixtures/estudio-muestra.dxf"), "utf8") // salida real de dibujoDXF
  const base = { email: "Ana@Ejemplo.com", acepta: true, herramienta: "celosias", archivo: "Celosía 60×90" }

  it("la lista de herramientas es la misma que la del Estudio", () => {
    const catalogo = readFileSync(join(__dirname, "../../../../../apps/storefront/src/lib/hetna/disenar.ts"), "utf8")
    const slugs = [...catalogo.matchAll(/^\s{4}slug: "([^"]+)",/gm)].map((m) => m[1]).concat("imagen-a-3d")
    expect(Object.keys(HERRAMIENTAS).sort()).toEqual([...new Set(slugs)].sort())
    // las que cobran la descarga con créditos no mandan el archivo
    for (const s of catalogo.matchAll(/slug: "([^"]+)",[^{}]*?acceso: "creditos"/g)) expect(HERRAMIENTAS[s[1]]?.[1]).toBe(true)
  })

  it("acepta el DXF del Estudio y rechaza lo que no es DXF", () => {
    expect(esDxf(dxf)).toBe(true)
    expect(esDxf("hola")).toBe(false)
    expect(esDxf("<html><script>x</script></html>")).toBe(false)
    expect(esDxf(dxf.replace("EOF", "XYZ"))).toBe(false)
    expect(esDxf(dxf + "\x00")).toBe(false)
    expect(esDxf(dxf.replace("ENTITIES", "ENTITIES\n" + "x".repeat(DXF_MAX)))).toBe(false)
  })

  it("valida permiso, correo y herramienta; limpia el nombre del archivo", () => {
    expect(validarHerramientaCorreo({ ...base, acepta: false }).ok).toBe(false)
    expect(validarHerramientaCorreo({ ...base, email: "no-es-correo" }).ok).toBe(false)
    expect(validarHerramientaCorreo({ ...base, herramienta: "../../admin" }).ok).toBe(false)
    const v = validarHerramientaCorreo({ ...base, dxf })
    expect(v.ok && v.datos.email).toBe("ana@ejemplo.com")
    expect(v.ok && v.datos.archivo).toBe("Celosia-60-90")
    expect(v.ok && v.datos.dxf).toBe(dxf)
  })

  it("nunca manda el archivo de una herramienta de pago", () => {
    expect(validarHerramientaCorreo({ ...base, herramienta: "muebles-ensamble", dxf }).ok).toBe(false)
    expect(validarHerramientaCorreo({ ...base, herramienta: "muebles-ensamble" }).ok).toBe(true)
  })

  it("sólo toma el precio de servicios conocidos y con medidas", () => {
    const con = validarHerramientaCorreo({ ...base, precio: { servicio: "plasma", material: "Acero al carbón", ancho: 60, largo: 90, cantidad: 2 } })
    expect(con.ok && con.datos.precio).toMatchObject({ servicio: "plasma", ancho: 60, largo: 90, cantidad: 2 })
    const raro = validarHerramientaCorreo({ ...base, precio: { servicio: "<b>", ancho: 60, largo: 90 } })
    expect(raro.ok && raro.datos.precio).toBeNull()
  })

  it("el correo lleva archivo, precio y ligas; escapa lo que escribe el cliente", () => {
    const v = validarHerramientaCorreo({ ...base, nombre: "<img src=x>", dxf, precio: { servicio: "plasma", material: "Acero <b>", ancho: 60, largo: 90 } })
    if (!v.ok) throw new Error("no validó")
    const c = correoHerramientaHtml(v.datos, { minimo: 850, maximo: 1200 })
    expect(c.asunto).toContain("Tu archivo de Celosías")
    expect(c.html).toContain("Celosia-60-90.dxf")
    expect(c.html).toContain("$850")
    expect(c.html).toContain("/mx/disenar/celosias")
    expect(c.html).not.toContain("<img src=x>")
    expect(c.html).not.toContain("Acero <b>")
  })

  it("el seguimiento de una herramienta habla del diseño y regresa a la herramienta", () => {
    const e = { email: "a@b.mx", servicio: "Corte plasma", material: "Acero al carbón", herramienta: "celosias", estimado_min: 850, estimado_max: 1200 }
    const t1 = correoSeguimiento(e, 0)
    expect(t1.html).toContain("Celosías y paneles decorativos")
    expect(t1.html).toContain("herramienta_t1")
    expect(t1.html).not.toContain("calculaste el precio")
    expect(correoSeguimiento(e, 1).html).toContain("wa.me")
    // los estimados de /cotizar siguen igual
    expect(correoSeguimiento({ ...e, herramienta: null }, 0).html).toContain("calculaste el precio")
  })
})
