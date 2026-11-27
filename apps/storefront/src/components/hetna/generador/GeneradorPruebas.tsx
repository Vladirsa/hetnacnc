"use client"

// Pruebas de máquina (2D Studio · Archivos): kerf, ajuste y matriz de material.
// Motor: lib/generador/pruebas.ts.
import { useMemo, useState } from "react"

import { Boton, CampoNum, Seccion, descargar, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { leerSerie, matrizMaterial, pruebaAjuste, pruebaKerf } from "@/lib/generador/pruebas"

import { useFuente } from "./useFuente"

type Tipo = "kerf" | "ajuste" | "matriz"
const TIPOS: { id: Tipo; nombre: string; nota: string }[] = [
  { id: "kerf", nombre: "Kerf", nota: "Cuánto material se come el corte" },
  { id: "ajuste", nombre: "Ajuste", nota: "Qué ranura entra justa" },
  { id: "matriz", nombre: "Material", nota: "Potencia × velocidad" },
]
const campo = "w-full rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[14px] text-white outline-none focus:ring-1 focus:ring-[#C2560A]"

export function GeneradorPruebas({ cabecera }: { cabecera?: React.ReactNode }) {
  const [tipo, setTipo] = useState<Tipo>("kerf")
  const [espesor, setEspesor] = useState("3")
  const [paso, setPaso] = useState("0.05")
  const [potencias, setPotencias] = useState("20-100/20")
  const [velocidades, setVelocidades] = useState("100, 200, 300, 400, 500")
  const [unidad, setUnidad] = useState("mm/s")
  const [lado, setLado] = useState("10")
  const { texto } = useFuente("montserrat")
  const rotular = texto ? (t: string, alto: number, capa: string) => texto(t, alto, capa) : null

  const r = useMemo(() => {
    if (tipo === "kerf") return pruebaKerf(rotular)
    if (tipo === "ajuste") return pruebaAjuste(numero(espesor), numero(paso), rotular)
    return matrizMaterial({ potencias: leerSerie(potencias), velocidades: leerSerie(velocidades), lado: numero(lado), unidad }, rotular)
  }, [tipo, espesor, paso, potencias, velocidades, unidad, lado, texto]) // eslint-disable-line react-hooks/exhaustive-deps

  const nota =
    tipo === "kerf"
      ? "Córtala en tu material. Junta las 10 tiras contra un lado del marco y mide con vernier el hueco que queda: kerf = hueco ÷ 11. Pon ese número en tu programa (compensación o desfase = kerf ÷ 2)."
      : tipo === "ajuste"
        ? "Corta el peine y la lengüeta en el mismo material. La ranura donde la lengüeta entra justa (ni floja ni forzada) te dice cuánto sumarle o restarle al espesor en tus cajas y ensambles."
        : "Abre el SVG en LightBurn: cada cuadro cae en su capa de color. Ponle a cada capa la potencia y velocidad de la tabla (bájala abajo) y graba. El cuadro que se vea mejor es tu ajuste."

  const panel = (
    <div className="flex flex-col gap-4">
      {cabecera}
      <Seccion titulo="Prueba">
        <div className="grid grid-cols-3 gap-1.5">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tipo === t.id}
              title={t.nota}
              onClick={() => setTipo(t.id)}
              className={`rounded-[8px] px-2 py-2 text-[12.5px] font-semibold ${tipo === t.id ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#232D3D]"}`}
            >
              {t.nombre}
            </button>
          ))}
        </div>
      </Seccion>
      {tipo === "ajuste" && (
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Espesor del material" valor={espesor} cambiar={setEspesor} />
          <CampoNum etiqueta="Paso entre ranuras" valor={paso} cambiar={setPaso} />
        </div>
      )}
      {tipo === "matriz" && (
        <>
          <Seccion titulo="Potencias (%)" nota='Separadas por coma, o "inicio-fin/paso" (20-100/20).'>
            <input value={potencias} onChange={(e) => setPotencias(e.target.value)} className={campo} />
          </Seccion>
          <Seccion titulo="Velocidades">
            <input value={velocidades} onChange={(e) => setVelocidades(e.target.value)} className={campo} />
            <select value={unidad} onChange={(e) => setUnidad(e.target.value)} className="mt-1 rounded-[8px] bg-[#1C2431] px-2 py-1.5 text-[13px] text-white">
              <option>mm/s</option>
              <option>mm/min</option>
            </select>
          </Seccion>
          <CampoNum etiqueta="Lado del cuadro" valor={lado} cambiar={setLado} />
          {r.leyenda && (
            <Boton onClick={() => descargar("matriz-material-hetna.csv", "﻿" + r.leyenda!.join("\r\n"), "text/csv")}>Bajar la tabla de capas (CSV)</Boton>
          )}
        </>
      )}
      <span className="text-[12px] leading-snug text-[#8A97AB]">{nota}</span>
    </div>
  )

  return (
    <Estudio2D
      titulo="Pruebas de máquina"
      acento="2D"
      subtitulo="Kerf, ajuste y potencia × velocidad"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo={`prueba-${tipo}-hetna`}
      pieza={tipo === "kerf" ? "Prueba de kerf" : tipo === "ajuste" ? `Prueba de ajuste para ${espesor} mm` : "Matriz de prueba de material"}
      material="El material que vas a cortar o grabar"
      vacio="Configura la prueba."
    />
  )
}
