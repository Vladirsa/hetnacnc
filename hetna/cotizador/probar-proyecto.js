// Pruebas de proyecto.js con el motor real (engine.js) y las tarifas reales (datos.json).
// Correr:  node hetna/cotizador/probar-proyecto.js
// Regla principal: N piezas iguales = 1 pieza con cantidad N (las tres opciones de precio),
// y mínimos y cargos únicos se cobran una sola vez por proyecto.
const fs = require("fs")
const path = require("path")
const vm = require("vm")

const aqui = __dirname
const ctx = {}
vm.createContext(ctx)
vm.runInContext(fs.readFileSync(path.join(aqui, "engine.js"), "utf8") + "\nthis.calcular = calcular;", ctx)
const calc = ctx.calcular
const PROYECTO = require("./proyecto.js")
const DATOS = JSON.parse(fs.readFileSync(path.join(aqui, "datos.json"), "utf8"))

let fallas = 0
const casi = (a, b, tol) => Math.abs(a - b) <= tol
const revisar = (nombre, ok, extra = "") => {
  if (!ok) fallas++
  console.log(`${ok ? "✓" : "✗"} ${nombre}${extra ? " · " + extra : ""}`)
}

const costos = { ...DATOS.costos, get costoHoraTotal() { return this.costoHoraTaller + this.costoHoraMaquina + this.costoHoraOperador } }
const base = (clave, tipoN, extra = {}) => {
  const s = DATOS.servicios.find((x) => x.clave === clave)
  const t = s.tipos.find((x) => x.n === tipoN)
  return { cfg: { tarifas: { ...s.tarifas }, rangos: s.rangos }, costos, tipo: { nombre: t.n, formula: t.f, factor: t.k }, nombreServicio: s.nombre, aplicarIva: false, extrasSeleccionados: [], ...extra }
}

function equivalencia(nombre, b, pieza, n) {
  const una = calc({ ...b, ...pieza, cantidad: n })
  const p = PROYECTO.cotizar(b, Array.from({ length: n }, (_, i) => ({ nombre: `P${i + 1}`, params: { ...pieza, cantidad: 1 } })), calc)
  const tol = 0.011 * n + 0.02
  const ok = ["pvMinimo", "pvRecomendado", "pvPremium", "tiempoHoras"].every((k) => casi(una[k], p[k], tol))
  revisar(`${nombre}: ${n} piezas = 1 pieza ×${n}`, ok, `${una.pvRecomendado} vs ${p.pvRecomendado}${p.minimo ? " (mínimo aplicado)" : ""}`)
  return { una, p }
}

const chica = { largo: 5, ancho: 4, alto: 0, metros: 0, perimetroRealMm: 0, volumenRealCm3: 0, materialLibrePrecio: 0 }
const grande = { largo: 60, ancho: 40, alto: 0, metros: 2, perimetroRealMm: 2400, volumenRealCm3: 0, materialLibrePrecio: 30 }

// Impresión 3D: piezas chicas que por separado caerían en el mínimo de $200 cada una
const p3dChica = { largo: 3, ancho: 3, alto: 3, volumenRealCm3: 8, materialLibrePrecio: 0 }
const p3dGrande = { largo: 15, ancho: 15, alto: 15, volumenRealCm3: 900, materialLibrePrecio: 0 }
const b3d = base("impresion_3d", "Pieza funcional", { materialImpresion: "pla" })
for (const n of [1, 3, 12]) equivalencia("Impresión 3D chica", b3d, p3dChica, n)
for (const n of [1, 4]) equivalencia("Impresión 3D grande", b3d, p3dGrande, n)
{
  const lineas = Array.from({ length: 12 }, (_, i) => ({ nombre: `P${i}`, params: { ...p3dChica, cantidad: 1 } }))
  const sumaSueltas = lineas.reduce((s, l) => s + calc({ ...b3d, ...l.params }).pvRecomendado, 0)
  const p = PROYECTO.cotizar(b3d, lineas, calc)
  revisar("Impresión 3D: el mínimo de $200 se cobra una vez, no 12", p.pvRecomendado < sumaSueltas / 3, `proyecto ${p.pvRecomendado} vs 12 sueltas ${sumaSueltas.toFixed(2)}`)
}

// Plasma por m² (mínimo de apertura en piezas chicas)
const bPl = base("plasma", "Corte por m²", { calibre: "Cal 14", material: "acero_negro" })
for (const n of [1, 2, 5]) equivalencia("Plasma chica", bPl, chica, n)
for (const n of [1, 3]) equivalencia("Plasma grande", bPl, grande, n)
for (const n of [1, 3]) equivalencia("Plasma metro lineal", base("plasma", "Metro lineal", { calibre: "Cal 14" }), grande, n)

// Láser CO2 por minuto, router por m², carpintería, herrería
for (const tipo of ["Solo corte", "Solo grabado", "Corte + Grabado"]) equivalencia(`Láser CO2 ${tipo}`, base("laser_co2", tipo, { materialLaser: "mdf_fino", densidadLaser: "normal", tipoLaser: tipo === "Solo corte" ? "corte" : tipo === "Solo grabado" ? "grabado" : "ambos" }), grande, 4)
equivalencia("Router corte simple", base("router", "Corte simple"), grande, 5)
equivalencia("Router relieve 3D", base("router", "Relieve 3D"), { ...grande, alto: 3 }, 3)
equivalencia("Carpintería mueble MDF", base("carpinteria", "Mueble/Repisa MDF"), grande, 6)

// Láser fibra: precio escalonado por piezas totales y mínimo de apertura una vez
for (const n of [1, 3, 15, 60]) equivalencia("Láser fibra marcado", base("laser_fibra", "Marcado superficial"), chica, n)

// Cargos únicos: diseño del router, flete y DXF de plasma, plantilla de fibra
equivalencia("Router con diseño adicional", base("router", "Corte simple", { llevaDiseno: true }), grande, 4)
equivalencia("Plasma con flete y preparar DXF", base("plasma", "Corte por m²", { calibre: "Cal 14", llevaFlete: true, llevaDisenoPlasma: true, clienteTraeArchivoDXF: true, llevaLimpieza: true }), grande, 4)
equivalencia("Fibra con plantilla", base("laser_fibra", "Marcado superficial", { llevaPlantilla: true }), chica, 20)
{
  const b = base("router", "Corte simple", { llevaDiseno: true })
  const p = PROYECTO.cotizar(b, [{ nombre: "A", params: { ...grande, cantidad: 1 } }, { nombre: "B", params: { ...chica, cantidad: 2 } }], calc)
  const tarifa = b.cfg.tarifas.costo_diseno > 0 ? b.cfg.tarifas.costo_diseno : 300
  revisar("Diseño adicional se cobra una sola vez en piezas distintas", casi(p.unicos, tarifa, 0.01), `cargo único ${p.unicos} (tarifa ${tarifa})`)
}

// Piezas distintas: el total es la suma de las líneas (sin mínimos ni únicos de por medio)
{
  const b = base("laser_co2", "Solo corte", { materialLaser: "mdf_fino", tipoLaser: "corte" })
  const A = { ...grande, cantidad: 2 }, B = { ...grande, largo: 30, ancho: 20, perimetroRealMm: 1100, cantidad: 3 }
  const p = PROYECTO.cotizar(b, [{ nombre: "A", params: A }, { nombre: "B", params: B }], calc)
  const s = calc({ ...b, ...A }).pvRecomendado + calc({ ...b, ...B }).pvRecomendado
  revisar("Láser: piezas distintas suman sus líneas", casi(p.pvRecomendado, s, 0.02), `${p.pvRecomendado} vs ${s.toFixed(2)} · ${p.lineas.length} líneas, ${p.unidades} piezas`)
}

// Por hora y por diseño: se cotizan como un solo trabajo
revisar("Herrería por hora → un solo trabajo", PROYECTO.cotizar(base("herreria", "Mueble industrial"), [{ nombre: "A", params: grande }], calc) === null)
revisar("Diseño → un solo trabajo", PROYECTO.cotizar(base("diseno", "2D Simple"), [{ nombre: "A", params: grande }], calc) === null)

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : "\nTodas las pruebas pasaron")
process.exit(fallas ? 1 : 0)
