"use client"

// Muebles de ensamble sin tornillos (2D Studio, Muebles): exhibidor con
// gabinete y repisas, de ranura y espiga, listo para router CNC o láser.
// Ver en 3D, medidas y material es gratis; la descarga de archivos va con créditos.
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"

import { CampoNum, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { EXHIBIDOR_INICIO, type Herramienta, type OpcionesExhibidor, type PiezaEnsamble, aMueble, exhibidor, piezaPrueba } from "@/lib/generador/ensamble"
import { type Trazo, dibujo } from "@/lib/generador/geo2d"

import { Visor3D } from "./Visor3D"

const Malla3D = dynamic(() => import("./Malla3D"), { ssr: false })
const TABLERO = { ancho: 1220, largo: 2440 }

const FRESAS = [
  { id: "laser", nombre: "Láser" },
  { id: "3.175", nombre: "Fresa 1/8″" },
  { id: "6.35", nombre: "Fresa 1/4″" },
] as const

// piezas tendidas en renglones para la vista 2D (Y hacia arriba)
function piezasTendidas(piezas: PiezaEnsamble[]): Trazo[] {
  const trazos: Trazo[] = []
  let x = 0
  let y = 0
  let altoRenglon = 0
  const maxAncho = 3000
  for (const p of piezas) {
    const us = p.contorno.map((q) => q[0]), vs = p.contorno.map((q) => q[1])
    const u0 = Math.min(...us), v0 = Math.min(...vs)
    const w = Math.max(...us) - u0, h = Math.max(...vs) - v0
    if (x > 0 && x + w > maxAncho) {
      x = 0
      y -= altoRenglon + 40
      altoRenglon = 0
    }
    const mover = (pts: [number, number][]) => pts.map(([u, v]) => [x + u - u0, y + v - v0 - h] as [number, number])
    trazos.push({ pts: mover(p.contorno), cerrado: true, capa: "corte" })
    for (const hh of p.huecos) trazos.push({ pts: mover(hh), cerrado: true, capa: "corte" })
    x += w + 40
    altoRenglon = Math.max(altoRenglon, h)
  }
  return trazos
}

// malla del mueble armado: cada pieza extruida a su grosor y llevada a su lugar
async function mallaArmada(piezas: PiezaEnsamble[]) {
  const { extruir } = await import("@/lib/generador/extruir")
  const tris: number[] = []
  for (const p of piezas) {
    const r = extruir(
      { trazos: [{ pts: p.contorno, cerrado: true, capa: "c" }, ...p.huecos.map((h) => ({ pts: h, cerrado: true, capa: "c" }))], avisos: [], unidades: "mm" },
      { alto: p.grosor, base: 0, margenBase: 0, redondearBase: 0, espejo: false },
    )
    const t = r.malla.tris
    for (let i = 0; i < t.length; i += 3) tris.push(...aMueble(p, t[i], t[i + 1], t[i + 2]))
  }
  return tris
}

export function GeneradorEnsamble({ cabecera }: { cabecera?: React.ReactNode }) {
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(EXHIBIDOR_INICIO)
        .filter(([, x]) => typeof x === "number")
        .map(([k, x]) => [k, String(x)]),
    ),
  )
  const [divisores, setDivisores] = useState<OpcionesExhibidor["divisores"]>(EXHIBIDOR_INICIO.divisores)
  const [ranuras, setRanuras] = useState(true)
  const [conGabinete, setConGabinete] = useState(true)
  const [herr, setHerr] = useState<(typeof FRESAS)[number]["id"]>("6.35")
  const [prueba, setPrueba] = useState(false)
  const [ver3D, setVer3D] = useState(false)
  const [tris, setTris] = useState<number[] | null>(null)
  const cambiar = (k: string) => (x: string) => setV((s) => ({ ...s, [k]: x }))
  const n = (k: keyof OpcionesExhibidor) => numero(v[k as string] ?? "") || 0

  const herramienta: Herramienta = herr === "laser" ? { tipo: "laser" } : { tipo: "fresa", diametro: Number(herr) }
  const opciones: OpcionesExhibidor = {
    ancho: n("ancho"),
    fondoGabinete: n("fondoGabinete"),
    fondoRepisas: n("fondoRepisas"),
    altoGabinete: conGabinete ? n("altoGabinete") : 0,
    repisas: n("repisas"),
    espacioSobreGabinete: n("espacioSobreGabinete"),
    separacion: n("separacion"),
    sobreUltima: n("sobreUltima"),
    divisores,
    numDivisores: n("numDivisores"),
    altoDivisor: n("altoDivisor"),
    ranurasDivisor: ranuras,
    barrote: n("barrote"),
    grosor: n("grosor"),
    holgura: numero(v.holgura ?? "") >= 0 ? numero(v.holgura ?? "") : 0.3,
    saliente: numero(v.saliente ?? "") >= 0 ? numero(v.saliente ?? "") : 15,
    herramienta,
  }
  const clave = JSON.stringify(opciones) + prueba
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => exhibidor(opciones), [clave])
  const piezas = useMemo(() => (prueba ? [...m.piezas, ...piezaPrueba(opciones.grosor, opciones.holgura, herramienta)] : m.piezas), [m, prueba]) // eslint-disable-line react-hooks/exhaustive-deps
  const d = useMemo(() => (m.errores.length ? null : dibujo(piezasTendidas(piezas))), [m, piezas])

  // material: área de las piezas y tableros (con 80% de aprovechamiento)
  const areaM2 = useMemo(() => {
    let a = 0
    for (const p of m.piezas) {
      let s = 0
      const c = p.contorno
      for (let i = 0, j = c.length - 1; i < c.length; j = i++) s += (c[j][0] - c[i][0]) * (c[j][1] + c[i][1])
      a += Math.abs(s / 2)
    }
    return a / 1e6
  }, [m])
  const tableros = Math.max(1, Math.ceil(areaM2 / ((TABLERO.ancho * TABLERO.largo) / 1e6) / 0.8))

  useEffect(() => {
    if (!ver3D || m.errores.length) return
    let vivo = true
    setTris(null)
    mallaArmada(m.piezas).then((t) => vivo && setTris(t))
    return () => {
      vivo = false
    }
  }, [ver3D, m])

  const avisos = [...m.errores, ...m.avisos]
  const panel = (
    <div className="flex flex-col gap-4">
      <div className="rounded-[10px] border border-[#2A3546] bg-[#141B26] p-3 text-[12.5px] text-[#C9D2E0]">
        <b className="text-white">Exhibidor con gabinete.</b> Laterales con mortajas, repisas con espigas pasantes, frente y respaldo que lo hacen firme, travesaño trasero y divisores ranurados. Sin tornillos ni herrajes.
      </div>
      <Seccion titulo="Medidas generales">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Ancho total" valor={v.ancho} cambiar={cambiar("ancho")} sufijo="mm" />
          <CampoNum etiqueta="Fondo de repisas" valor={v.fondoRepisas} cambiar={cambiar("fondoRepisas")} sufijo="mm" />
        </div>
      </Seccion>
      <Seccion titulo="Gabinete de abajo">
        <Opciones opciones={[{ id: "si", nombre: "Con gabinete" }, { id: "no", nombre: "Sin gabinete" }]} valor={conGabinete ? "si" : "no"} cambiar={(x) => setConGabinete(x === "si")} />
        {conGabinete && (
          <div className="grid grid-cols-2 gap-2">
            <CampoNum etiqueta="Alto" valor={v.altoGabinete} cambiar={cambiar("altoGabinete")} sufijo="mm" />
            <CampoNum etiqueta="Fondo" valor={v.fondoGabinete} cambiar={cambiar("fondoGabinete")} sufijo="mm" />
          </div>
        )}
      </Seccion>
      <Seccion titulo="Repisas">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Cuántas" valor={v.repisas} cambiar={cambiar("repisas")} />
          <CampoNum etiqueta="Separación" valor={v.separacion} cambiar={cambiar("separacion")} sufijo="mm" />
          <CampoNum etiqueta={conGabinete ? "Sobre el gabinete" : "Altura de la primera"} valor={v.espacioSobreGabinete} cambiar={cambiar("espacioSobreGabinete")} sufijo="mm" />
          <CampoNum etiqueta="Laterales arriba" valor={v.sobreUltima} cambiar={cambiar("sobreUltima")} sufijo="mm" />
          <CampoNum etiqueta="Barrote (0 = sin)" valor={v.barrote} cambiar={cambiar("barrote")} sufijo="mm" />
        </div>
      </Seccion>
      <Seccion titulo="Divisores ranurados">
        <Opciones
          opciones={[
            { id: "ninguno", nombre: "Sin" },
            { id: "abajo", nombre: "Abajo" },
            { id: "arriba", nombre: "Arriba" },
            { id: "ambos", nombre: "Ambos" },
          ]}
          valor={divisores}
          cambiar={setDivisores}
        />
        {divisores !== "ninguno" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <CampoNum etiqueta="Por repisa" valor={v.numDivisores} cambiar={cambiar("numDivisores")} />
              <CampoNum etiqueta="Alto" valor={v.altoDivisor} cambiar={cambiar("altoDivisor")} sufijo="mm" />
            </div>
            <Opciones opciones={[{ id: "si", nombre: "Con muescas" }, { id: "no", nombre: "Lisos" }]} valor={ranuras ? "si" : "no"} cambiar={(x) => setRanuras(x === "si")} />
          </>
        )}
      </Seccion>
      <Seccion titulo="Tablero y máquina">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Grosor real (medido)" valor={v.grosor} cambiar={cambiar("grosor")} sufijo="mm" />
          <CampoNum etiqueta="Holgura de ensamble" valor={v.holgura} cambiar={cambiar("holgura")} sufijo="mm" />
          <CampoNum etiqueta="Espiga sobresale" valor={v.saliente} cambiar={cambiar("saliente")} sufijo="mm" />
        </div>
        <Opciones opciones={FRESAS.map((f) => ({ id: f.id, nombre: f.nombre }))} valor={herr} cambiar={setHerr} />
        <span className="text-[12px] text-[#8A97AB]">
          Mide el grosor del tablero con vernier: el triplay de «15 mm» suele medir 14.5 o 15.5. Con fresa, las mortajas y los hombros de las espigas llevan alivio en las esquinas para que asienten.
        </span>
        <Opciones opciones={[{ id: "no", nombre: "Sin pieza de prueba" }, { id: "si", nombre: "Con pieza de prueba" }]} valor={prueba ? "si" : "no"} cambiar={(x) => setPrueba(x === "si")} />
      </Seccion>
      <button
        type="button"
        disabled={!!m.errores.length}
        onClick={() => setVer3D(true)}
        className="rounded-[8px] bg-[#243045] px-3 py-2.5 text-[14px] font-semibold text-white ring-1 ring-[#C2560A] hover:bg-[#2C3A52] disabled:opacity-50"
      >
        Ver armado en 3D
      </button>
    </div>
  )

  return (
    <>
      {ver3D && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Mueble armado en 3D">
          <div className="w-full max-w-[1000px] overflow-hidden rounded-[14px] border border-[#1F2937] bg-[#0F151E]">
            <div className="flex items-center justify-between gap-3 border-b border-[#1F2937] px-4 py-2.5">
              <span className="text-[14px] font-semibold text-white">
                Armado · {Math.round(m.medidas.ancho)} × {Math.round(m.medidas.fondo)} × {Math.round(m.medidas.alto)} mm
              </span>
              <button type="button" onClick={() => setVer3D(false)} className="rounded-[8px] bg-[#1C2431] px-3 py-1.5 text-[13px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
                Cerrar
              </button>
            </div>
            {tris ? (
              <Visor3D oscuro alto="h-[70vh]">
                <Malla3D oscuro tris={tris} color={0xd8b98e} />
              </Visor3D>
            ) : (
              <div className="grid h-[70vh] place-items-center text-[14px] text-[#8A97AB]">Armando el mueble…</div>
            )}
          </div>
        </div>
      )}
      <Estudio2D
        titulo="Muebles de ensamble"
        acento="2D"
        subtitulo="Sin tornillos, listos para router CNC o láser"
        icono={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 3v18M19 3v18M5 8h14M5 13h14M5 18h14" />
          </svg>
        }
        panel={
          <>
            {cabecera}
            {panel}
          </>
        }
        dibujo={d}
        avisos={avisos}
        archivo={`exhibidor-${Math.round(m.medidas.ancho)}x${Math.round(m.medidas.alto)}-${opciones.grosor}mm`}
        pieza={`Exhibidor de ensamble ${Math.round(m.medidas.ancho)} × ${Math.round(m.medidas.fondo)} × ${Math.round(m.medidas.alto)} mm, ${m.piezas.length} piezas`}
        material={`Triplay o MDF de ${opciones.grosor} mm`}
        datos={[
          ["Armado", `${Math.round(m.medidas.ancho)} × ${Math.round(m.medidas.fondo)} × ${Math.round(m.medidas.alto)} mm`],
          ["Piezas", String(m.piezas.length)],
          ["Tablero", `${areaM2.toFixed(2)} m² · ${tableros} ${tableros === 1 ? "hoja" : "hojas"} de ${TABLERO.largo} × ${TABLERO.ancho}`],
          ...m.compras.map((c) => [c.nombre, c.nota || String(c.cantidad)] as [string, string]),
        ]}
        descargas={() => (
          <div className="flex flex-col gap-2">
            <button type="button" disabled className="rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[13px] font-semibold text-[#8A97AB]">
              Descargar DXF, SVG y PDF · con créditos (muy pronto)
            </button>
            <span className="text-[12px] text-[#8A97AB]">Ver el armado, las medidas y el material es gratis. Mientras tanto, pide que un taller lo fabrique con Fabrícamelo.</span>
          </div>
        )}
      />
    </>
  )
}
