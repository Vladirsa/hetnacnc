"use client"

// Organizadores de cajón (2D Studio): separadores a la medida del cajón que
// se encastran a media madera, con muescas para meter los dedos.
import { useMemo, useState } from "react"

import { CampoNum, CampoTexto, Interruptor, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { hacerOrganizador } from "@/lib/generador/organizador"

// "1, 1, 2" → [1, 1, 2]; un número solo ("3") son 3 partes iguales
function proporciones(s: string): number[] {
  const partes = s.split(/[,;\s]+/).map(numero).filter((x) => x > 0)
  if (partes.length === 1 && Number.isInteger(partes[0]) && !s.includes(",")) return Array(Math.min(20, partes[0])).fill(1)
  return partes
}

const USOS = [
  { nombre: "Cubiertos", columnas: "1, 1, 1, 2", filas: "1" },
  { nombre: "Herramienta", columnas: "2, 1", filas: "1, 1" },
  { nombre: "Fresas CNC", columnas: "6", filas: "4" },
  { nombre: "Maquillaje", columnas: "1, 2", filas: "1, 1, 1" },
]

export function GeneradorOrganizador() {
  const [ancho, setAncho] = useState("400")
  const [fondo, setFondo] = useState("450")
  const [alto, setAlto] = useState("60")
  const [espesor, setEspesor] = useState("6")
  const [holgura, setHolgura] = useState("0.2")
  const [columnas, setColumnas] = useState("1, 1, 1, 2")
  const [filas, setFilas] = useState("1")
  const [paredes, setParedes] = useState(true)
  const [dedos, setDedos] = useState(true)
  const [hojaAncho, setHojaAncho] = useState("1220")
  const [hojaAlto, setHojaAlto] = useState("610")

  const r = useMemo(
    () =>
      hacerOrganizador({
        ancho: numero(ancho) || 400,
        fondo: numero(fondo) || 450,
        alto: numero(alto) || 60,
        espesor: numero(espesor) || 6,
        holgura: Math.max(0, numero(holgura) || 0),
        columnas: proporciones(columnas),
        filas: proporciones(filas),
        paredes,
        dedos,
        hoja: { ancho: numero(hojaAncho) || 1220, alto: numero(hojaAlto) || 610 },
      }),
    [ancho, fondo, alto, espesor, holgura, columnas, filas, paredes, dedos, hojaAncho, hojaAlto],
  )

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Medidas de adentro del cajón">
        <div className="grid grid-cols-3 gap-2">
          <CampoNum etiqueta="Ancho" valor={ancho} cambiar={setAncho} />
          <CampoNum etiqueta="Fondo" valor={fondo} cambiar={setFondo} />
          <CampoNum etiqueta="Alto" valor={alto} cambiar={setAlto} />
        </div>
      </Seccion>
      <Seccion titulo="Compartimentos" nota='Escribe cuántos ("4") o sus tamaños en proporción ("1, 1, 2": el último es del doble).'>
        <div className="flex flex-wrap gap-1.5">
          {USOS.map((u) => (
            <button
              key={u.nombre}
              type="button"
              onClick={() => {
                setColumnas(u.columnas)
                setFilas(u.filas)
              }}
              className="rounded-full bg-[#1C2431] px-2.5 py-1 text-[12px] text-[#C9D2E0] hover:bg-[#232D3D]"
            >
              {u.nombre}
            </button>
          ))}
        </div>
        <span className="text-[12.5px] text-[#C9D2E0]">A lo ancho</span>
        <CampoTexto valor={columnas} cambiar={setColumnas} max={60} placeholder="1, 1, 2" />
        <span className="text-[12.5px] text-[#C9D2E0]">A lo fondo</span>
        <CampoTexto valor={filas} cambiar={setFilas} max={60} placeholder="1, 1" />
      </Seccion>
      <Seccion titulo="Armado">
        <Interruptor etiqueta="Paredes de orilla" activo={paredes} cambiar={setParedes} />
        <Interruptor etiqueta="Muescas para los dedos" activo={dedos} cambiar={setDedos} />
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Espesor" valor={espesor} cambiar={setEspesor} />
          <CampoNum etiqueta="Holgura" valor={holgura} cambiar={setHolgura} />
        </div>
      </Seccion>
      <Seccion titulo="Hoja de material">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Ancho" valor={hojaAncho} cambiar={setHojaAncho} />
          <CampoNum etiqueta="Alto" valor={hojaAlto} cambiar={setHojaAlto} />
        </div>
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Organizador de cajón"
      acento="2D"
      subtitulo="Separadores a la medida que se encastran"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="1" />
          <path d="M9 5v14M15 5v14M3 12h6" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo={`organizador-${ancho}x${fondo}`}
      pieza={`Organizador de cajón ${ancho} × ${fondo} mm, ${r.piezas} tiras`}
      material={`Hoja de ${espesor} mm`}
      datos={r.piezas ? [["Tiras", String(r.piezas)], ["Hojas", String(r.hojas)], ...r.celdas.map((c, i) => [i ? "Fondo" : "Ancho", c] as [string, string])] : []}
    />
  )
}
