"use client"

// Patrón Voronoi (2D Studio › Patrones de corte): celdas irregulares para
// celosías, lámparas, separadores, mesas y mosaicos. El motor está en
// lib/generador/voronoi.ts; aquí sólo van los controles.
import { T } from "@/components/hetna/i18n/Idioma"
import { useDeferredValue, useMemo, useState } from "react"

import { CampoNum, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { type DensidadVoronoi, type FormaVoronoi, type ResultadoVoronoi, MAX_CELDAS, hacerVoronoi } from "@/lib/generador/voronoi"

const MEDIDAS = [
  { id: "plafon", nombre: "Plafón 60×60", forma: "rectangulo" as const, ancho: 600, alto: 600 },
  { id: "divisor", nombre: "Divisor 60×180", forma: "rectangulo" as const, ancho: 600, alto: 1800 },
  { id: "cuadro", nombre: "Cuadro 30×30", forma: "rectangulo" as const, ancho: 300, alto: 300 },
  { id: "lampara", nombre: "Lámpara Ø30", forma: "circulo" as const, ancho: 300, alto: 300 },
  { id: "posavasos", nombre: "Posavasos Ø10", forma: "circulo" as const, ancho: 100, alto: 100 },
]

export function GeneradorVoronoi({ cabecera }: { cabecera?: React.ReactNode }) {
  const [forma, setForma] = useState<FormaVoronoi>("rectangulo")
  const [resultado, setResultado] = useState<ResultadoVoronoi>("calado")
  const [densidad, setDensidad] = useState<DensidadVoronoi>("pareja")
  const [ancho, setAncho] = useState("600")
  const [alto, setAlto] = useState("600")
  const [marco, setMarco] = useState("30")
  const [radio, setRadio] = useState("0")
  const [celdas, setCeldas] = useState("120")
  const [puente, setPuente] = useState("6")
  const [redondeo, setRedondeo] = useState("4")
  const [orden, setOrden] = useState(60)
  const [semilla, setSemilla] = useState(7)
  // El deslizador se mueve al instante; el diseño se recalcula sin trabar la página
  const ordenDiferido = useDeferredValue(orden)

  const r = useMemo(
    () =>
      hacerVoronoi({
        forma,
        resultado,
        densidad,
        ancho: numero(ancho) || 600,
        alto: numero(alto) || 600,
        marco: numero(marco) || 0,
        radio: numero(radio) || 0,
        celdas: Math.min(MAX_CELDAS, Number.isFinite(numero(celdas)) ? numero(celdas) : 120),
        puente: numero(puente) || 0.2,
        redondeo: numero(redondeo) || 0,
        orden: ordenDiferido / 100,
        semilla,
      }),
    [forma, resultado, densidad, ancho, alto, marco, radio, celdas, puente, redondeo, ordenDiferido, semilla],
  )

  const circ = forma === "circulo"
  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Qué vas a cortar">
        <Opciones<ResultadoVoronoi>
          valor={resultado}
          cambiar={setResultado}
          opciones={[
            { id: "calado", nombre: "Panel calado" },
            { id: "mosaico", nombre: "Piezas sueltas (mosaico)" },
          ]}
        />
      </Seccion>
      <Seccion titulo="Medidas comunes">
        <div className="flex flex-wrap gap-1.5">
          {MEDIDAS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setForma(m.forma)
                setAncho(String(m.ancho))
                setAlto(String(m.alto))
              }}
              className="rounded-full bg-[#1C2431] px-2.5 py-1 text-[12px] text-[#C9D2E0] hover:bg-[#232D3D]"
            >
              {m.nombre}
            </button>
          ))}
        </div>
      </Seccion>
      <Seccion titulo="Forma">
        <Opciones<FormaVoronoi>
          valor={forma}
          cambiar={setForma}
          opciones={[
            { id: "rectangulo", nombre: "Rectángulo" },
            { id: "circulo", nombre: "Círculo" },
          ]}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <CampoNum etiqueta={circ ? "Diámetro" : "Ancho"} valor={ancho} cambiar={setAncho} />
          {!circ && <CampoNum etiqueta="Alto" valor={alto} cambiar={setAlto} />}
          {resultado === "calado" && <CampoNum etiqueta="Marco" valor={marco} cambiar={setMarco} />}
          {resultado === "calado" && !circ && <CampoNum etiqueta="Esquinas" valor={radio} cambiar={setRadio} />}
        </div>
      </Seccion>
      <Seccion
        titulo="Celdas"
        nota={
          resultado === "calado"
            ? "El puente es el material que queda entre dos huecos. En MDF de 9 mm o más, deja al menos 5 mm."
            : "La separación es el espacio entre piezas: con el ancho de corte del láser (0.2 mm) las piezas salen juntas, listas para pintar y armar."
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Cuántas" valor={celdas} cambiar={setCeldas} sufijo="" />
          <CampoNum etiqueta={resultado === "calado" ? "Puente" : "Separación"} valor={puente} cambiar={setPuente} />
          <CampoNum etiqueta="Redondeo" valor={redondeo} cambiar={setRedondeo} />
        </div>
        <label className="mt-2 flex flex-col gap-1 text-[12.5px] text-[#C9D2E0]">
          <span>
            <T>Orden:</T> {orden < 25 ? "al azar" : orden < 70 ? "natural" : "muy parejas"}
          </span>
          <input type="range" min={0} max={100} value={orden} onChange={(e) => setOrden(Number(e.target.value))} className="accent-[#C2560A]" />
        </label>
      </Seccion>
      <Seccion titulo="Dónde van más celdas">
        <Opciones<DensidadVoronoi>
          valor={densidad}
          cambiar={setDensidad}
          columnas={2}
          opciones={[
            { id: "pareja", nombre: "Parejas" },
            { id: "centro", nombre: "Más al centro" },
            { id: "orilla", nombre: "Más en la orilla" },
            { id: "abajo", nombre: "Más abajo" },
          ]}
        />
      </Seccion>
      <button
        type="button"
        onClick={() => setSemilla((s) => (s * 48271 + 11) % 2147483647)}
        className="rounded-[10px] bg-[#C2560A] px-3 py-2.5 text-[14px] font-bold text-white hover:bg-[#A9480A]"
      >
        <T>Otro diseño</T>
      </button>
    </div>
  )

  const medida = circ ? `Ø${Math.round(numero(ancho) || 0)}` : `${Math.round(numero(ancho) || 0)}x${Math.round(numero(alto) || 0)}`
  return (
    <Estudio2D
      titulo="Patrón Voronoi"
      acento="2D"
      subtitulo="Celdas irregulares para láser, router o plasma"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9l5-2 4 3-1 5-5 2zM12 10l6-3 3 4-3 5-7-1zM11 15l7 1-1 5H9zM6 17l5-2-2 6H4z" />
        </svg>
      }
      panel={
        <>
          {cabecera}
          {panel}
        </>
      }
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo={`voronoi-${resultado}-${medida}-${semilla}`}
      pieza={`${resultado === "calado" ? "Panel Voronoi" : "Mosaico Voronoi"} ${medida} mm`}
      datos={[[resultado === "calado" ? "Huecos" : "Piezas", String(r.piezas)]]}
    />
  )
}
