"use client"

// Esténcil de letras (2D Studio): plantillas con puentes para pintar con
// aerosol cajas, bultos y señalética.
import { useMemo, useState } from "react"

import { CampoNum, Interruptor, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { hacerEstencil } from "@/lib/generador/estencil"
import { FUENTES } from "@/lib/generador/fuentes"

import { useFuente } from "./useFuente"

const LETRAS = FUENTES.filter((f) => f.grupo !== "Cursiva")
const EJEMPLOS = ["FRÁGIL", "ESTE LADO ARRIBA", "NO ESTIBAR", "SALIDA", "PROHIBIDO ESTACIONARSE"]

export function GeneradorEstencil() {
  const [texto, setTexto] = useState("FRÁGIL")
  const [letra, setLetra] = useState("stardos-stencil")
  const [alto, setAlto] = useState("60")
  const [espaciado, setEspaciado] = useState("3")
  const [puentes, setPuentes] = useState(true)
  const [anchoPuente, setAnchoPuente] = useState("4")
  const [margen, setMargen] = useState("20")
  const [radio, setRadio] = useState("5")
  const { fuente, error } = useFuente(letra)
  const esEstencil = FUENTES.find((f) => f.id === letra)?.grupo === "Esténcil"

  const r = useMemo(
    () =>
      hacerEstencil(fuente, {
        texto,
        alto: numero(alto) || 60,
        espaciado: numero(espaciado) || 0,
        puentes,
        anchoPuente: numero(anchoPuente) || 4,
        margen: numero(margen) || 20,
        radio: numero(radio) || 0,
      }),
    [fuente, texto, alto, espaciado, puentes, anchoPuente, margen, radio],
  )

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Texto" nota="Enter para otro renglón.">
        <textarea
          value={texto}
          maxLength={80}
          rows={2}
          onChange={(e) => setTexto(e.target.value)}
          className="w-full resize-none rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[15px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
        />
        <div className="flex flex-wrap gap-1.5">
          {EJEMPLOS.map((e) => (
            <button key={e} type="button" onClick={() => setTexto(e)} className="rounded-full bg-[#1C2431] px-2.5 py-1 text-[11.5px] text-[#C9D2E0] hover:bg-[#232D3D]">
              {e}
            </button>
          ))}
        </div>
      </Seccion>
      <Seccion titulo="Letra" nota="Las de tipo esténcil ya traen sus puentes; con las demás los ponemos nosotros.">
        <div className="grid grid-cols-2 gap-1.5">
          {LETRAS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setLetra(f.id)}
              aria-pressed={letra === f.id}
              className={`rounded-[8px] px-2 py-1.5 text-left text-[12.5px] font-semibold ${letra === f.id ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#232D3D]"}`}
            >
              {f.nombre}
              {f.grupo === "Esténcil" && <span className="ml-1 text-[10.5px] font-normal opacity-80">esténcil</span>}
            </button>
          ))}
        </div>
        {error && <span className="text-[12px] text-[#F6B8AE]">No se pudo cargar la letra. Revisa tu conexión.</span>}
      </Seccion>
      <Seccion titulo="Tamaño">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Alto de letra" valor={alto} cambiar={setAlto} />
          <CampoNum etiqueta="Espacio entre letras" valor={espaciado} cambiar={setEspaciado} />
        </div>
      </Seccion>
      <Seccion titulo="Puentes y hoja">
        <Interruptor etiqueta={esEstencil ? "Puentes extra (la letra ya trae)" : "Puentes en las islas"} activo={puentes} cambiar={setPuentes} />
        <div className="grid grid-cols-2 gap-2">
          {puentes && <CampoNum etiqueta="Ancho del puente" valor={anchoPuente} cambiar={setAnchoPuente} />}
          <CampoNum etiqueta="Margen de hoja" valor={margen} cambiar={setMargen} />
          <CampoNum etiqueta="Esquinas redondas" valor={radio} cambiar={setRadio} />
        </div>
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Esténcil de letras"
      acento="2D"
      subtitulo="Plantillas con puentes para pintar"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M7 15l2.5-6 2.5 6M8 13h3M15 9v6M15 9h2.5a1.5 1.5 0 010 3H15" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo={`estencil-${texto.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "texto"}`}
      pieza={`Esténcil "${texto.trim().slice(0, 40)}" de ${Math.round(r.ancho)} × ${Math.round(r.alto)} mm`}
      material="Acrílico o MDF de 3 mm"
      datos={r.puentes ? [["Puentes", String(r.puentes)]] : []}
      vacio={fuente ? "Escribe el texto." : "Cargando la letra…"}
    />
  )
}
