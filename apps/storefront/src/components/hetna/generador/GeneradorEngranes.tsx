"use client"

// Engranes (2D Studio): engranes rectos de evolvente que sí engranan, solos o
// en par con la distancia entre centros ya calculada.
import { useMemo, useState } from "react"

import { CampoNum, Interruptor, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { hacerEngranes } from "@/lib/generador/engranes"

export function GeneradorEngranes() {
  const [dientes, setDientes] = useState("24")
  const [modulo, setModulo] = useState("3")
  const [presion, setPresion] = useState<"14.5" | "20" | "25">("20")
  const [juego, setJuego] = useState("0.1")
  const [barreno, setBarreno] = useState("8")
  const [cunero, setCunero] = useState(false)
  const [rayos, setRayos] = useState("5")
  const [par, setPar] = useState(true)
  const [dientesPar, setDientesPar] = useState("12")
  const [barrenoPar, setBarrenoPar] = useState("6")

  const r = useMemo(
    () =>
      hacerEngranes({
        dientes: numero(dientes) || 24,
        modulo: numero(modulo) || 3,
        presion: numero(presion),
        juego: Math.max(0, numero(juego) || 0),
        barreno: numero(barreno) || 0,
        cunero,
        rayos: Math.round(numero(rayos) || 0),
        par,
        dientesPar: numero(dientesPar) || 12,
        barrenoPar: numero(barrenoPar) || 0,
      }),
    [dientes, modulo, presion, juego, barreno, cunero, rayos, par, dientesPar, barrenoPar],
  )

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Engrane" nota="El módulo es el tamaño del diente: dos engranes sólo engranan si tienen el mismo módulo.">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Dientes" valor={dientes} cambiar={setDientes} sufijo="" />
          <CampoNum etiqueta="Módulo" valor={modulo} cambiar={setModulo} />
        </div>
      </Seccion>
      <Seccion titulo="Ángulo de presión" nota="20° es el estándar. 14.5° para engranes antiguos.">
        <Opciones opciones={[{ id: "14.5", nombre: "14.5°" }, { id: "20", nombre: "20°" }, { id: "25", nombre: "25°" }]} valor={presion} cambiar={setPresion} />
      </Seccion>
      <Seccion titulo="Centro">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Barreno" valor={barreno} cambiar={setBarreno} />
          <CampoNum etiqueta="Rayos" valor={rayos} cambiar={setRayos} sufijo="" />
        </div>
        <Interruptor etiqueta="Cuñero en el barreno" activo={cunero} cambiar={setCunero} />
      </Seccion>
      <Seccion titulo="Par">
        <Interruptor etiqueta="Agregar el engrane que engrana" activo={par} cambiar={setPar} />
        {par && (
          <div className="grid grid-cols-2 gap-2">
            <CampoNum etiqueta="Dientes del par" valor={dientesPar} cambiar={setDientesPar} sufijo="" />
            <CampoNum etiqueta="Barreno del par" valor={barrenoPar} cambiar={setBarrenoPar} />
          </div>
        )}
      </Seccion>
      <Seccion titulo="Ajuste" nota="Se quita al grueso del diente para que no se trabe. Con láser 0.1 mm; con router 0.2 mm.">
        <CampoNum etiqueta="Juego entre dientes" valor={juego} cambiar={setJuego} />
      </Seccion>
    </div>
  )

  const datos: [string, string][] = [
    ["Diámetro primitivo", `${r.primitivo.toFixed(1)} mm`],
    ["Diámetro exterior", `${r.exterior.toFixed(1)} mm`],
  ]
  if (par) datos.push(["Entre centros", `${r.distancia.toFixed(2)} mm`], ["Relación", `1 : ${r.relacion.toFixed(2)}`])

  return (
    <Estudio2D
      titulo="Engranes"
      acento="2D"
      subtitulo="Engranes rectos que sí engranan"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
          <circle cx="12" cy="12" r="7" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo={`engrane-${dientes}d-m${modulo}${par ? `-y-${dientesPar}d` : ""}`}
      pieza={`Engrane de ${dientes} dientes, módulo ${modulo}${par ? ` y su par de ${dientesPar}` : ""}`}
      datos={datos}
    />
  )
}
