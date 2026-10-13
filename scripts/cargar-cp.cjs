// Descarga el Catálogo Nacional de Códigos Postales de Correos de México y lo guarda
// compacto en ~/hetna-data/cp-mx.json (fuera del repo: no se borra al actualizar).
// Uso (desde ~/hetnacnc): node scripts/cargar-cp.cjs   ·   Repetir cada 2-3 meses.
const fs = require("fs")
const os = require("os")
const path = require("path")

const URL_CP = "https://www.correosdemexico.gob.mx/datosabiertos/cp/cpdescarga.txt"
const DESTINO = process.env.HETNA_CP_FILE || path.join(os.homedir(), "hetna-data", "cp-mx.json")

;(async () => {
  const r = await fetch(URL_CP)
  if (!r.ok) throw new Error(`Correos de México respondió ${r.status}`)
  const texto = Buffer.from(await r.arrayBuffer()).toString("latin1")
  const lineas = texto.split(/\r?\n/)
  const iCab = lineas.findIndex((l) => l.startsWith("d_codigo|"))
  if (iCab < 0) throw new Error("No encontré el encabezado del catálogo (d_codigo|...)")
  const cab = lineas[iCab].split("|")
  const col = (n) => cab.indexOf(n)
  const [cCp, cAs, cTipo, cMun, cEdo, cCiu] = ["d_codigo", "d_asenta", "d_tipo_asenta", "D_mnpio", "d_estado", "d_ciudad"].map(col)
  if ([cCp, cAs, cMun, cEdo].some((i) => i < 0)) throw new Error("Faltan columnas en el catálogo")

  const mapa = {}
  let filas = 0
  for (const l of lineas.slice(iCab + 1)) {
    const f = l.split("|")
    const cp = (f[cCp] || "").trim()
    if (!/^\d{5}$/.test(cp)) continue
    filas++
    const e = (mapa[cp] ||= { e: f[cEdo].trim(), m: f[cMun].trim(), c: (f[cCiu] || "").trim(), a: [] })
    const nombre = f[cAs].trim()
    const tipo = (f[cTipo] || "").trim()
    if (nombre && !e.a.some((x) => x[0] === nombre)) e.a.push([nombre, tipo])
  }
  for (const v of Object.values(mapa)) v.a.sort((x, y) => x[0].localeCompare(y[0], "es"))

  fs.mkdirSync(path.dirname(DESTINO), { recursive: true })
  fs.writeFileSync(DESTINO + ".tmp", JSON.stringify(mapa))
  fs.renameSync(DESTINO + ".tmp", DESTINO)
  const kb = Math.round(fs.statSync(DESTINO).size / 1024)
  console.log(`LISTO: ${Object.keys(mapa).length} códigos postales, ${filas} colonias -> ${DESTINO} (${kb} KB)`)
  const m = mapa["64000"]
  console.log("Ejemplo 64000:", m ? `${m.e} / ${m.m} / ${m.a.map((x) => x[0]).join(", ")}` : "no encontrado")
})().catch((e) => {
  console.error("ERROR:", e.message)
  process.exit(1)
})
