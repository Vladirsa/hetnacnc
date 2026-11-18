"use client"

// Patrones radiales (mandalas, arte de pared) dentro del 2D Studio: capas de
// una figura escaladas y rotadas con una fórmula. Ahora usa la misma pantalla
// que celosías y bisagra viva (Estudio2D), así gana zoom, descargas,
// Fabrícamelo y "Acomodar en hojas".
import { useMemo, useState } from "react"

import { CampoNum, CampoTexto, Opciones, Seccion } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { cajaPatron, generarPatron, type FormaPatron } from "@/lib/generador/patronRadial"
import type { Dibujo } from "@/lib/generador/vectores"

const r1 = (x: number) => Math.round(x * 10) / 10

const EJEMPLOS: { nombre: string; escala: string; rotacion: string }[] = [
  { nombre: "Espiral clásica", escala: "i+i*7", rotacion: "10*sin(i/2)" },
  { nombre: "Anillos concéntricos", escala: "i*5", rotacion: "0" },
  { nombre: "Remolino", escala: "i*4", rotacion: "i*6" },
  { nombre: "Ondulado", escala: "i*4.5", rotacion: "15*sin(i/3)" },
]

export function GeneradorPatron({ cabecera }: { cabecera?: React.ReactNode }) {
  const [forma, setForma] = useState<FormaPatron>("poligono")
  const [lados, setLados] = useState("5")
  const [capas, setCapas] = useState("25")
  const [radioMin, setRadioMin] = useState("20")
  const [radioMax, setRadioMax] = useState("50")
  const [anguloMin, setAnguloMin] = useState("0")
  const [anguloMax, setAnguloMax] = useState("360")
  const [formulaEscala, setFormulaEscala] = useState("i+i*7")
  const [formulaRotacion, setFormulaRotacion] = useState("10*sin(i/2)")
  const [redondeo, setRedondeo] = useState(0)
  const [semilla, setSemilla] = useState("10")

  const n = (s: string) => parseFloat(s.replace(",", ".")) || 0

  const r = useMemo(
    () =>
      generarPatron({
        forma,
        lados: n(lados),
        capas: n(capas),
        radioMin: n(radioMin),
        radioMax: n(radioMax),
        anguloMin: n(anguloMin),
        anguloMax: n(anguloMax),
        formulaEscala,
        formulaRotacion,
        redondeo,
        semilla: n(semilla),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forma, lados, capas, radioMin, radioMax, anguloMin, anguloMax, formulaEscala, formulaRotacion, redondeo, semilla]
  )
  const listo = r.capas.length > 0
  const caja = listo ? cajaPatron(r.capas) : null
  // cada capa es un contorno cerrado de corte (el SVG/DXF de siempre)
  const dibujo = useMemo<Dibujo | null>(
    () => (listo ? { unidades: "mm", avisos: [], trazos: r.capas.map((pts) => ({ pts: pts.map(([x, y]) => [x, y] as [number, number]), cerrado: true, capa: "corte" })) } : null),
    [r, listo]
  )

  const panel = (
    <div className="flex flex-col gap-4">
      {cabecera}
      <Seccion titulo="Figura base">
        <Opciones
          opciones={[
            { id: "poligono", nombre: "Polígono" },
            { id: "organico", nombre: "Orgánica" },
          ]}
          valor={forma}
          cambiar={(v) => setForma(v as FormaPatron)}
        />
      </Seccion>
      <div className="grid grid-cols-2 gap-2">
        <CampoNum etiqueta="Lados" valor={lados} cambiar={setLados} sufijo="" />
        <CampoNum etiqueta="Capas" valor={capas} cambiar={setCapas} sufijo="" />
        <CampoNum etiqueta="Radio inicial" valor={radioMin} cambiar={setRadioMin} />
        <CampoNum etiqueta="Radio de referencia" valor={radioMax} cambiar={setRadioMax} />
        <CampoNum etiqueta="Ángulo inicial" valor={anguloMin} cambiar={setAnguloMin} sufijo="°" />
        <CampoNum etiqueta="Ángulo final" valor={anguloMax} cambiar={setAnguloMax} sufijo="°" />
      </div>
      <Seccion titulo="Redondeo de esquinas">
        <input type="range" min={0} max={1} step={0.05} value={redondeo} onChange={(e) => setRedondeo(parseFloat(e.target.value))} aria-label="Redondeo de esquinas" style={{ accentColor: "#F28A3C" }} />
      </Seccion>
      {forma === "organico" && <CampoNum etiqueta="Semilla (para repetir el mismo patrón)" valor={semilla} cambiar={setSemilla} sufijo="" />}
      <Seccion titulo="Fórmula de escala (i = número de capa)">
        <CampoTexto valor={formulaEscala} cambiar={setFormulaEscala} max={80} />
      </Seccion>
      <Seccion titulo="Fórmula de rotación (grados)">
        <CampoTexto valor={formulaRotacion} cambiar={setFormulaRotacion} max={80} />
      </Seccion>
      <Seccion titulo="Ejemplos">
        <div className="flex flex-wrap gap-1.5">
          {EJEMPLOS.map((e) => (
            <button
              key={e.nombre}
              type="button"
              onClick={() => {
                setFormulaEscala(e.escala)
                setFormulaRotacion(e.rotacion)
              }}
              className="rounded-full bg-[#1C2431] px-2.5 py-1 text-[11.5px] font-semibold text-[#C9D2E0] hover:bg-[#243045] hover:text-white"
            >
              {e.nombre}
            </button>
          ))}
        </div>
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Patrones radiales"
      acento="2D"
      subtitulo="Mandalas y arte de pared por capas"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l7 5-3 9H8L5 8z" />
          <path d="M12 7l3.5 2.5-1.5 4.5h-4L8.5 9.5z" />
        </svg>
      }
      panel={panel}
      dibujo={dibujo}
      avisos={r.errores}
      archivo={`patron-hetna-${forma}-${capas}capas`}
      pieza={`Patrón radial de ${capas} capas (figura de ${lados} lados${forma === "organico" ? ", orgánica" : ""})`}
      datos={caja ? [["Capas", String(r.capas.length)], ["Tamaño", `${r1(caja.ancho)} × ${r1(caja.alto)} mm`]] : []}
      vacio="Revisa las fórmulas y las medidas del panel."
    />
  )
}
