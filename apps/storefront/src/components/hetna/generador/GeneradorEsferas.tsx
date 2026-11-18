"use client"

// Esferas navideñas con nombre (2D Studio, Decoración): una esfera de una
// sola pieza por cada nombre, lista para corte láser, plotter o impresión.
import { useDeferredValue, useMemo, useState } from "react"

import { CampoNum, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { type DisenoEsfera, DISENOS_ESFERA, armarEsfera, marcoEsfera, nombreEsfera, resolucionEsfera } from "@/lib/generador/esferas"
import { FUENTES } from "@/lib/generador/fuentes"
import { type Trazo, dibujo } from "@/lib/generador/geo2d"

import { useFuente } from "./useFuente"

const MAX_NOMBRES = 12
// tipografías que funcionan bien en la banda (las de esténcil y las muy delgadas no)
const LETRAS = FUENTES.filter((f) => f.grupo !== "Esténcil" && !["great-vibes", "sacramento"].includes(f.id))

export function GeneradorEsferas({ cabecera }: { cabecera?: React.ReactNode }) {
  const [diseno, setDiseno] = useState<DisenoEsfera>("copos")
  const [nombres, setNombres] = useState("Sofía")
  const [letra, setLetra] = useState("anton")
  const [mayusculas, setMayusculas] = useState(true)
  const [ancho, setAncho] = useState("75")
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
        <span className="text-[12px] text-[#8A97AB]">Cada nombre sale en su propia esfera, todas en el mismo archivo.</span>
        {sobran && <span className="text-[12px] text-[#F6B8AE]">Sólo se usan los primeros {MAX_NOMBRES} nombres.</span>}
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
        {error && <span className="text-[12px] text-[#F6B8AE]">No se pudo cargar la letra. Revisa tu conexión o elige otra.</span>}
      </Seccion>
      <Seccion titulo="Tamaño">
        <CampoNum etiqueta="Ancho de la esfera" valor={ancho} cambiar={setAncho} sufijo="mm" />
        <span className="text-[12px] text-[#8A97AB]">
          {Math.round(D)} × {Math.round(marco.medidas.alto)} mm con la argolla. De 40 a 300 mm.
        </span>
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
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
      vacio={!fuente && !error ? <span className="text-[13px] text-[#8A97AB]">Cargando la letra…</span> : undefined}
    />
  )
}
