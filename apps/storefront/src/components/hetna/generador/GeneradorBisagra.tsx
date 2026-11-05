"use client"

// Bisagra viva (2D Studio): cortes que dejan doblar MDF o triplay delgado
// para cajas redondeadas, lámparas y portadas de libretas.
import { useMemo, useState } from "react"

import { CampoNum, Opciones, Seccion, numero, r1 } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { PATRONES_BISAGRA, type PatronBisagra, hacerBisagra, largoDoblez } from "@/lib/generador/bisagra"

const USOS = [
  { id: "libreta", nombre: "Portada de libreta (180°)", ancho: 320, alto: 210, radio: 6, angulo: 180 },
  { id: "esquina", nombre: "Esquina de caja (90°)", ancho: 200, alto: 100, radio: 20, angulo: 90 },
  { id: "lampara", nombre: "Lámpara cilíndrica (360°)", ancho: 520, alto: 250, radio: 75, angulo: 360 },
]

export function GeneradorBisagra() {
  const [patron, setPatron] = useState<PatronBisagra>("recto")
  const [ancho, setAncho] = useState("200")
  const [alto, setAlto] = useState("100")
  const [espesor, setEspesor] = useState("3")
  const [radio, setRadio] = useState("20")
  const [angulo, setAngulo] = useState("90")
  const [paso, setPaso] = useState("1.6")
  const [ranura, setRanura] = useState("30")
  const [puente, setPuente] = useState("3")
  const [esquinas, setEsquinas] = useState("0")

  const o = {
    patron,
    ancho: numero(ancho) || 200,
    alto: numero(alto) || 100,
    espesor: numero(espesor) || 3,
    radio: numero(radio) || 0,
    angulo: numero(angulo) || 90,
    paso: numero(paso) || 1.6,
    ranura: numero(ranura) || 30,
    puente: numero(puente) || 3,
    esquinas: numero(esquinas) || 0,
  }
  const r = useMemo(() => hacerBisagra(o), [JSON.stringify(o)]) // eslint-disable-line react-hooks/exhaustive-deps

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Para qué es">
        <div className="flex flex-col gap-1.5">
          {USOS.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                setAncho(String(u.ancho))
                setAlto(String(u.alto))
                setRadio(String(u.radio))
                setAngulo(String(u.angulo))
              }}
              className="rounded-[8px] bg-[#1C2431] px-2.5 py-2 text-left text-[13px] text-[#C9D2E0] hover:bg-[#232D3D]"
            >
              {u.nombre}
            </button>
          ))}
        </div>
      </Seccion>
      <Seccion titulo="Patrón">
        <Opciones opciones={PATRONES_BISAGRA.map((p) => ({ id: p.id, nombre: p.nombre }))} valor={patron} cambiar={setPatron} />
      </Seccion>
      <Seccion titulo="Pieza">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Largo" valor={ancho} cambiar={setAncho} />
          <CampoNum etiqueta="Ancho" valor={alto} cambiar={setAlto} />
          <CampoNum etiqueta="Espesor" valor={espesor} cambiar={setEspesor} />
          <CampoNum etiqueta="Esquinas" valor={esquinas} cambiar={setEsquinas} />
        </div>
      </Seccion>
      <Seccion titulo="Doblez" nota={`Zona flexible: ${r1(largoDoblez(o))} mm (ángulo × (radio + espesor ÷ 2)).`}>
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Radio interior" valor={radio} cambiar={setRadio} />
          <CampoNum etiqueta="Ángulo" valor={angulo} cambiar={setAngulo} sufijo="°" />
        </div>
      </Seccion>
      <Seccion titulo="Cortes" nota="Para MDF de 3 mm: paso 1.2 a 2 mm, ranuras de 20 a 40 mm y puentes de 2 a 4 mm.">
        <div className="grid grid-cols-3 gap-2">
          <CampoNum etiqueta="Paso" valor={paso} cambiar={setPaso} />
          <CampoNum etiqueta="Ranura" valor={ranura} cambiar={setRanura} />
          <CampoNum etiqueta="Puente" valor={puente} cambiar={setPuente} />
        </div>
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Bisagra viva"
      acento="2D"
      subtitulo="Madera que dobla, para corte láser"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18v12H3zM9 6v5M11 9v6M13 6v5M15 9v6" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo={`bisagra-viva-${patron}-${Math.round(o.ancho)}x${Math.round(o.alto)}`}
      pieza={`Bisagra viva ${Math.round(o.ancho)}×${Math.round(o.alto)} mm, ${o.angulo}°`}
      material={`MDF o triplay de ${o.espesor} mm`}
      datos={[
        ["Zona flexible", `${r1(r.largo)} mm`],
        ["Líneas", String(r.lineas)],
      ]}
    />
  )
}
