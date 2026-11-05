"use client"

// Celosías y paneles decorativos (2D Studio): panel con marco y patrón calado
// para divisores, puertas de closet, plafones y fachadas.
import { useMemo, useState } from "react"

import { CampoNum, Interruptor, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { PATRONES, type Patron, hacerCelosia } from "@/lib/generador/celosias"

const MEDIDAS = [
  { id: "divisor", nombre: "Divisor 60×180", ancho: 600, alto: 1800 },
  { id: "puerta", nombre: "Puerta 45×90", ancho: 450, alto: 900 },
  { id: "plafon", nombre: "Plafón 60×60", ancho: 600, alto: 600 },
  { id: "cuadro", nombre: "Cuadro 30×30", ancho: 300, alto: 300 },
]

export function GeneradorCelosias() {
  const [patron, setPatron] = useState<Patron>("rombos")
  const [ancho, setAncho] = useState("600")
  const [alto, setAlto] = useState("900")
  const [marco, setMarco] = useState("40")
  const [celda, setCelda] = useState("50")
  const [puente, setPuente] = useState("6")
  const [radio, setRadio] = useState("0")
  const [barrenos, setBarrenos] = useState(true)
  const [diam, setDiam] = useState("6")

  const r = useMemo(
    () =>
      hacerCelosia({
        patron,
        ancho: numero(ancho) || 600,
        alto: numero(alto) || 900,
        marco: numero(marco) || 0,
        celda: numero(celda) || 50,
        puente: numero(puente) || 6,
        radio: numero(radio) || 0,
        barrenos,
        diametroBarreno: numero(diam) || 6,
      }),
    [patron, ancho, alto, marco, celda, puente, radio, barrenos, diam],
  )

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Patrón">
        <div className="grid grid-cols-2 gap-1.5">
          {PATRONES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPatron(p.id)}
              aria-pressed={patron === p.id}
              className={`rounded-[8px] px-2.5 py-2 text-left text-[13px] font-semibold ${patron === p.id ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#232D3D]"}`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      </Seccion>
      <Seccion titulo="Medidas comunes">
        <div className="flex flex-wrap gap-1.5">
          {MEDIDAS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
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
      <Seccion titulo="Panel">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Ancho" valor={ancho} cambiar={setAncho} />
          <CampoNum etiqueta="Alto" valor={alto} cambiar={setAlto} />
          <CampoNum etiqueta="Marco" valor={marco} cambiar={setMarco} />
          <CampoNum etiqueta="Esquinas" valor={radio} cambiar={setRadio} />
        </div>
      </Seccion>
      <Seccion titulo="Patrón" nota="El puente es el material que queda entre dos huecos. En MDF de 9 mm o más, deja al menos 5 mm.">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Celda" valor={celda} cambiar={setCelda} />
          <CampoNum etiqueta="Puente" valor={puente} cambiar={setPuente} />
        </div>
      </Seccion>
      <Seccion titulo="Fijación">
        <Interruptor etiqueta="Barrenos en las esquinas" activo={barrenos} cambiar={setBarrenos} />
        {barrenos && <CampoNum etiqueta="Diámetro" valor={diam} cambiar={setDiam} />}
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Celosías"
      acento="2D"
      subtitulo="Paneles calados para router, láser o plasma"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M8 6l2 3-2 3-2-3zM16 6l2 3-2 3-2-3zM12 12l2 3-2 3-2-3z" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo={`celosia-${patron}-${Math.round(numero(ancho) || 0)}x${Math.round(numero(alto) || 0)}`}
      pieza={`Celosía ${PATRONES.find((p) => p.id === patron)?.nombre} ${ancho}×${alto} mm`}
      datos={[["Huecos", String(r.huecos)]]}
    />
  )
}
