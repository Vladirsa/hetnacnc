"use client"

// Esferas navideñas con nombre (2D Studio, Decoración): una esfera de una
// sola pieza por cada nombre, lista para corte láser, plotter o impresión.
import { T } from "@/components/hetna/i18n/Idioma"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"

import { CampoNum, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { type DisenoEsfera, DISENOS_ESFERA, armarEsfera, marcoEsfera, nombreEsfera, resolucionEsfera } from "@/lib/generador/esferas"
import { FUENTES } from "@/lib/generador/fuentes"
import { type Trazo, dibujo } from "@/lib/generador/geo2d"
import { type Dibujo, mallaSTL } from "@/lib/generador/vectores"

import { useFuente } from "./useFuente"
import { Visor3D } from "./Visor3D"

// three.js se carga sólo al abrir la vista 3D o al descargar el STL
const Malla3D = dynamic(() => import("./Malla3D"), { ssr: false })
const MATERIALES = [
  { id: "abedul", nombre: "Triplay de abedul", color: 0xd8b98e },
  { id: "mdf", nombre: "MDF", color: 0xa6835c },
  { id: "cerezo", nombre: "Cerezo", color: 0x9a5534 },
  { id: "rojo", nombre: "Acrílico rojo", color: 0xc8202c },
  { id: "verde", nombre: "Acrílico verde", color: 0x1f7a3d },
  { id: "dorado", nombre: "Acrílico dorado", color: 0xc9a227 },
  { id: "blanco", nombre: "Acrílico blanco", color: 0xf2f2ee },
] as const

async function extruirEsferas(d: Dibujo, grosor: number) {
  const { extruir } = await import("@/lib/generador/extruir")
  return extruir(d, { alto: grosor, base: 0, margenBase: 0, redondearBase: 0, espejo: false })
}
function descargarArchivo(nombre: string, datos: BlobPart, tipo: string) {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const MAX_NOMBRES = 12
// tipografías que funcionan bien en la banda (las de esténcil y las muy delgadas no)
const LETRAS = FUENTES.filter((f) => f.grupo !== "Esténcil" && !["great-vibes", "sacramento"].includes(f.id))

export function GeneradorEsferas({ cabecera }: { cabecera?: React.ReactNode }) {
  const [diseno, setDiseno] = useState<DisenoEsfera>("copos")
  const [nombres, setNombres] = useState("Sofía")
  const [letra, setLetra] = useState("anton")
  const [mayusculas, setMayusculas] = useState(true)
  const [ancho, setAncho] = useState("75")
  const [grosor, setGrosor] = useState("3")
  const [material, setMaterial] = useState<(typeof MATERIALES)[number]["id"]>("abedul")
  const [ver3D, setVer3D] = useState(false)
  const [tris, setTris] = useState<number[] | null>(null)
  const [aviso3D, setAviso3D] = useState("")
  const { fuente, error } = useFuente(letra)
  const tipo = LETRAS.find((f) => f.id === letra) || LETRAS[0]
  const cursiva = tipo.grupo === "Cursiva"

  const D = Math.max(40, Math.min(300, numero(ancho) || 75))
  const px = resolucionEsfera(D)
  // la lista de nombres se procesa sin trabar la escritura
  const lista = useDeferredValue(
    nombres
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, MAX_NOMBRES)
      .map((n) => (mayusculas && !cursiva ? n.toLocaleUpperCase("es-MX") : n)),
  )
  const clave = lista.join("\n")
  const sobran = nombres.split("\n").filter((n) => n.trim()).length > MAX_NOMBRES

  const marco = useMemo(() => marcoEsfera(diseno, D, px), [diseno, D, px])
  const r = useMemo(() => {
    const avisos: string[] = []
    if (!fuente) return { d: null, avisos, n: 0, alto: marco.medidas.alto, soportes: 0 }
    const nombresOk = clave ? clave.split("\n") : [""]
    const cols = Math.max(1, Math.ceil(Math.sqrt(nombresOk.length)))
    const sep = 6
    const trazos: Trazo[] = []
    let soportes = 0
    const angostos: string[] = []
    const faltan = new Set<string>()
    nombresOk.forEach((nom, i) => {
      const n = nom ? nombreEsfera(fuente, nom, { diseno, diametro: D, cursiva }, px) : null
      const fila = Math.floor(i / cols)
      const col = i % cols
      const e = armarEsfera(marco, n, col * (marco.medidas.ancho + sep), -fila * (marco.medidas.alto + sep))
      trazos.push(...e.trazos)
      soportes += e.soportes
      if (e.compresion < 0.55) angostos.push(nom)
      e.faltan.forEach((c) => faltan.add(c))
    })
    if (angostos.length)
      avisos.push(`${angostos.join(", ")}: el nombre es largo y las letras quedan muy angostas. Usa una letra más angosta (Bebas Neue, Anton, Oswald) o una esfera más grande.`)
    if (faltan.size) avisos.push(`La tipografía no tiene: ${[...faltan].join(" ")}. Elige otra o quita esos caracteres.`)
    if (D < 60) avisos.push("En esferas de menos de 60 mm las paredes quedan delgadas: córtalas en MDF o acrílico de 3 mm como máximo.")
    return { d: dibujo(trazos), avisos, n: nombresOk.filter(Boolean).length, alto: marco.medidas.alto, soportes }
  }, [fuente, clave, diseno, D, px, cursiva, marco])

  const G = Math.max(1, Math.min(20, numero(grosor) || 3))
  useEffect(() => {
    if (!ver3D || !r.d) return
    let vivo = true
    setTris(null)
    extruirEsferas(r.d, G).then((m) => {
      if (!vivo) return
      if (m.errores.length || !m.malla.tris.length) setAviso3D(m.errores[0] || "No se pudo armar el modelo 3D.")
      else {
        setAviso3D("")
        setTris(m.malla.tris)
      }
    })
    return () => {
      vivo = false
    }
  }, [ver3D, r.d, G])
  const descargarSTL = async () => {
    if (!r.d) return
    const m = await extruirEsferas(r.d, G)
    if (m.errores.length || !m.malla.tris.length) return setAviso3D(m.errores[0] || "No se pudo armar el modelo 3D.")
    descargarArchivo(`esferas-${diseno}-${Math.round(D)}mm-${G}mm.stl`, mallaSTL(m.malla), "model/stl")
  }
  const color = MATERIALES.find((x) => x.id === material)?.color ?? 0xd8b98e

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Diseño">
        <Opciones opciones={DISENOS_ESFERA} valor={diseno} cambiar={setDiseno} columnas={4} />
      </Seccion>
      <Seccion titulo={`Nombres (uno por renglón, hasta ${MAX_NOMBRES})`}>
        <textarea
          value={nombres}
          onChange={(e) => setNombres(e.target.value)}
          rows={4}
          maxLength={400}
          placeholder={"Sofía\nMateo\nAbuela"}
          className="w-full resize-y rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[15px] font-semibold text-white outline-none placeholder:text-[#5B6880] focus:ring-1 focus:ring-[#C2560A]"
        />
        <span className="text-[12px] text-[#8A97AB]"><T>Cada nombre sale en su propia esfera, todas en el mismo archivo.</T></span>
        {sobran && <span className="text-[12px] text-[#F6B8AE]"><T>Sólo se usan los primeros</T> {MAX_NOMBRES} <T>nombres.</T></span>}
      </Seccion>
      <Seccion titulo="Letra">
        <select
          value={letra}
          onChange={(e) => setLetra(e.target.value)}
          className="w-full rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[14px] text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
        >
          {(["Molde", "Cursiva"] as const).map((g) => (
            <optgroup key={g} label={g === "Molde" ? "De molde" : "Cursiva (letras unidas)"}>
              {LETRAS.filter((f) => f.grupo === g).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {!cursiva && (
          <Opciones
            opciones={[{ id: "si", nombre: "MAYÚSCULAS" }, { id: "no", nombre: "Como lo escribo" }]}
            valor={mayusculas ? "si" : "no"}
            cambiar={(v) => setMayusculas(v === "si")}
          />
        )}
        {error && <span className="text-[12px] text-[#F6B8AE]"><T>No se pudo cargar la letra. Revisa tu conexión o elige otra.</T></span>}
      </Seccion>
      <Seccion titulo="Tamaño">
        <CampoNum etiqueta="Ancho de la esfera" valor={ancho} cambiar={setAncho} sufijo="mm" />
        <span className="text-[12px] text-[#8A97AB]">
          {Math.round(D)} × {Math.round(marco.medidas.alto)} <T>mm con la argolla. De 40 a 300 mm.</T>
        </span>
      </Seccion>
      <Seccion titulo="3D e impresión 3D">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Grosor" valor={grosor} cambiar={setGrosor} sufijo="mm" />
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[12.5px] text-[#C9D2E0]"><T>Material</T></span>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value as typeof material)}
              className="w-full rounded-[8px] bg-[#1C2431] px-2.5 py-2 text-[14px] text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
            >
              {MATERIALES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!r.d}
            onClick={() => setVer3D(true)}
            className="rounded-[8px] bg-[#243045] px-2 py-2.5 text-[13px] font-semibold text-white ring-1 ring-[#C2560A] hover:bg-[#2C3A52] disabled:opacity-50"
          >
            <T>Ver en 3D</T>
          </button>
          <button
            type="button"
            disabled={!r.d}
            onClick={descargarSTL}
            className="rounded-[8px] bg-[#1C2431] px-2 py-2.5 text-[13px] font-semibold text-[#C9D2E0] hover:bg-[#243045] disabled:opacity-50"
          >
            <T>Descargar STL</T>
          </button>
        </div>
        <span className="text-[12px] text-[#8A97AB]"><T>El grosor y el material sólo cambian la vista 3D y el STL; el DXF y el SVG siguen siendo el corte en 2D.</T></span>
        {aviso3D && <span className="text-[12px] text-[#F6B8AE]">{aviso3D}</span>}
      </Seccion>
    </div>
  )

  return (
    <>
      {ver3D && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Vista 3D de las esferas">
          <div className="w-full max-w-[960px] overflow-hidden rounded-[14px] border border-[#1F2937] bg-[#0F151E]">
            <div className="flex items-center justify-between gap-3 border-b border-[#1F2937] px-4 py-2.5">
              <span className="text-[14px] font-semibold text-white">
                <T>Vista 3D ·</T> {MATERIALES.find((x) => x.id === material)?.nombre} <T>de</T> {G} <T>mm</T>
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={descargarSTL} className="rounded-[8px] bg-[#C2560A] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#A84A08]">
                  <T>Descargar STL</T>
                </button>
                <button type="button" onClick={() => setVer3D(false)} className="rounded-[8px] bg-[#1C2431] px-3 py-1.5 text-[13px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
                  <T>Cerrar</T>
                </button>
              </div>
            </div>
            {tris ? (
              <Visor3D oscuro alto="h-[60vh]">
                <Malla3D oscuro tris={tris} color={color} />
              </Visor3D>
            ) : (
              <div className="grid h-[60vh] place-items-center text-[14px] text-[#8A97AB]"><T>{aviso3D || "Armando el modelo 3D…"}</T></div>
            )}
          </div>
        </div>
      )}
      <Estudio2D
      stl={async () => {
        if (!r.d) return null
        const m = await extruirEsferas(r.d, G)
        return m.errores.length || !m.malla.tris.length ? null : mallaSTL(m.malla)
      }}
      titulo="Esferas navideñas con nombre"
      acento="2D"
      subtitulo="Una pieza por nombre, lista para corte láser"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="14" r="7" />
          <path d="M10 7h4V5h-4zM12 5V3M5.5 13h13" />
        </svg>
      }
      panel={
        <>
          {cabecera}
          {panel}
        </>
      }
      dibujo={r.d}
      avisos={r.avisos}
      archivo={`esferas-${diseno}-${Math.round(D)}mm`}
      pieza={`${r.n || 1} esfera${r.n === 1 ? "" : "s"} navideña${r.n === 1 ? "" : "s"} de ${Math.round(D)} mm con nombre`}
      material="MDF de 3 mm"
      datos={[
        ["Medida de cada esfera", `${Math.round(D)} × ${Math.round(r.alto)} mm`],
        ["Esferas", String(r.n)],
        ...(r.soportes ? ([["Soportes agregados", String(r.soportes)]] as [string, string][]) : []),
      ]}
      vacio={!fuente && !error ? <span className="text-[13px] text-[#8A97AB]"><T>Cargando la letra…</T></span> : undefined}
      />
    </>
  )
}
