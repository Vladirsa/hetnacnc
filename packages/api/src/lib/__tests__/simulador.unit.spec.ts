import { readFileSync } from "fs"
import { join } from "path"

import { calificar } from "../simulador/calificar"
import { EJERCICIOS, ejercicioPorId } from "../simulador/ejercicios"
import { interpretar } from "../simulador/gcode"
import { interpretarTorno } from "../simulador/torno"

const ex = (id: string) => ejercicioPorId(id)!

describe("simulador: copias del motor", () => {
  it("son iguales al original del storefront", () => {
    for (const f of ["gcode", "material", "torno"]) {
      const api = readFileSync(join(__dirname, "..", "simulador", `${f}.ts`), "utf8").split("\n").slice(2).join("\n")
      const tienda = readFileSync(join(__dirname, "../../../../../apps/storefront/src/lib/simulador", `${f}.ts`), "utf8")
      expect({ f, igual: api === tienda }).toEqual({ f, igual: true })
    }
  })
})

describe("simulador: límites", () => {
  it("coordenadas absurdas no cuelgan el servidor", () => {
    const t = Date.now()
    const r = interpretar("M3 S1000\nG1 X99999999999 Z-1 F100", { ancho: 100, largo: 100, alto: 10, cero: "esquina" })
    expect(r.alarmas.some((a) => /Fuera de recorrido/.test(a.mensaje))).toBe(true)
    const t2 = interpretarTorno("M3 S500\nG1 X999999999 Z-999999 F0.2", { diametro: 40, largo: 80 }, { radioPunta: 0.4 })
    expect(t2.alarmas.some((a) => /Fuera de recorrido/.test(a.mensaje))).toBe(true)
    expect(Date.now() - t).toBeLessThan(2000)
  })
  it("un programa enorme se rechaza", () => {
    const r = calificar(ex("f1-contorno"), "G1 X1\n".repeat(6000))
    expect(r.aprobado).toBe(false)
  })
})

describe("simulador: calificación", () => {
  it("la solución de cada ejercicio aprueba con 100", () => {
    for (const e of EJERCICIOS) {
      const r = calificar(e, e.solucion)
      expect({ id: e.id, aprobado: r.aprobado, calificacion: r.calificacion, errores: r.errores.length }).toEqual({ id: e.id, aprobado: true, calificacion: 100, errores: 0 })
    }
  })
  it("un programa vacío reprueba", () => {
    for (const e of EJERCICIOS) expect({ id: e.id, aprobado: calificar(e, "G21 G90\nM30").aprobado }).toEqual({ id: e.id, aprobado: false })
  })
  it("corrido 1 mm reprueba", () => {
    const e = ex("f4-ranura-arco")
    const r = calificar(e, e.solucion.replace("G0 X20 Y15", "G0 X21 Y15").replace("G2 X80 Y15 R30", "G2 X81 Y15 R30"))
    expect(r.aprobado).toBe(false)
  })
  it("poco profundo es 'falta'; muy profundo es 'sobrecorte'", () => {
    const e = ex("f1-contorno")
    const corto = calificar(e, e.solucion.replace("G1 Z-6 F300", "G1 Z-5 F300"))
    expect(corto.aprobado).toBe(false)
    expect(corto.falta.cantidad).toBeGreaterThan(0)
    expect(corto.mensaje).toMatch(/Falta/)
    const hondo = calificar(e, e.solucion.replace("G1 Z-6 F300", "G1 Z-7 F300"))
    expect(hondo.aprobado).toBe(false)
    expect(hondo.sobrecorte.cantidad).toBeGreaterThan(0)
    expect(hondo.mensaje).toMatch(/de más/)
    const t = ex("t1-cilindrado")
    const delgado = calificar(t, t.solucion.replace("X30", "X29"))
    expect(delgado.aprobado).toBe(false)
    expect(delgado.mensaje).toMatch(/de más/)
  })
  it("un choque reprueba aunque la pieza quede bien", () => {
    const e = ex("f1-contorno")
    const r = calificar(e, e.solucion.replace("G0 Z5\nM5", "G0 X60 Y40\nG0 Z5\nM5"))
    expect(r.aprobado).toBe(false)
    expect(r.errores.length).toBeGreaterThan(0)
  })
  it("otra estrategia que deja la misma pieza aprueba (se califica la pieza, no el programa)", () => {
    // contorno en 3 pasadas en lugar de 2
    const e = ex("f1-contorno")
    const vuelta = "G1 X110 F1200\nG1 Y70\nG1 X10\nG1 Y10\n"
    const tres = `G21 G90\nM3 S18000\nG0 Z5\nG0 X10 Y10\nG1 Z-2 F300\n${vuelta}G1 Z-4 F300\n${vuelta}G1 Z-6 F300\n${vuelta}G0 Z5\nM5\nM30`
    expect(calificar(e, tres).aprobado).toBe(true)
    // torno: G1 a mano en lugar del ciclo G90
    const t = ex("t1-cilindrado")
    const amano = `G21 G99\nT0101\nG97 S1200 M3\nG0 X42 Z2\nG0 X35\nG1 Z-25 F0.25\nG1 X42\nG0 Z2\nG0 X30\nG1 Z-25 F0.2\nG1 X42\nG0 X100 Z50\nM30`
    expect(calificar(t, amano).aprobado).toBe(true)
    // barrenos con G1 en lugar de G81
    const b = ex("f3-barrenos")
    const g1 = ["G21 G90", "M3 S12000", "G0 Z10", ...[[15, 15], [85, 15], [85, 45], [15, 45]].flatMap(([x, y]) => [`G0 X${x} Y${y}`, "G1 Z-13 F400", "G0 Z10"]), "M30"].join("\n")
    expect(calificar(b, g1).aprobado).toBe(true)
  })
})

describe("simulador: torno G71/G70", () => {
  const G71 = `G21 G99
T0101
G96 S200 M3
G50 S2500
G0 X42 Z2
G71 U1.5 R0.5
G71 P10 Q20 U0.5 W0.1 F0.25
N10 G0 X16
G1 X18 Z0 F0.1
X20 Z-1
Z-12
G2 X26 Z-15 R3
G1 X30
Z-35
N20 X42
G70 P10 Q20
G0 X100 Z50
M5
M30`
  it("desbaste G71 + acabado G70 deja la pieza del plano", () => {
    const e = ex("t3-perfil")
    const r = calificar(e, G71)
    expect({ aprobado: r.aprobado, calificacion: r.calificacion, errores: r.errores.length }).toEqual({ aprobado: true, calificacion: 100, errores: 0 })
  })
  it("sin G70 queda el sobrante de acabado", () => {
    const r = calificar(ex("t3-perfil"), G71.replace("G70 P10 Q20\n", ""))
    expect(r.aprobado).toBe(false)
    expect(r.falta.peor).toBeCloseTo(0.5, 1)
  })
  it("P/Q que no existen dan alarma clara", () => {
    const e = ex("t3-perfil")
    const r = interpretarTorno(G71.replace("P10 Q20 U0.5", "P11 Q20 U0.5"), (e as any).barra, (e as any).inserto)
    expect(r.alarmas.some((a) => /no encuentro los bloques N11/.test(a.mensaje))).toBe(true)
  })
})
