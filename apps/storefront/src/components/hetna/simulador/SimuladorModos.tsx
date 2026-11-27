"use client"

// Elige qué ver en el simulador: fresadora/router, torno CNC o los ejercicios
// calificados (?maquina=torno / ?maquina=ejercicios). Desde un ejercicio,
// "Probar en el simulador" abre su programa en la máquina que corresponde.
import { T } from "@/components/hetna/i18n/Idioma"
import { useEffect, useState } from "react"

import { EjerciciosSimulador, type Probar } from "./EjerciciosSimulador"
import { SimuladorCnc, type InicialFresa } from "./SimuladorCnc"
import { SimuladorTorno, type InicialTorno } from "./SimuladorTorno"

type Modo = "fresadora" | "torno" | "ejercicios"
const MODOS: [Modo, string][] = [
  ["fresadora", "Fresadora y router (3 ejes)"],
  ["torno", "Torno CNC (2 ejes)"],
  ["ejercicios", "🎓 Ejercicios calificados"],
]

export function SimuladorModos() {
  const [modo, setModo] = useState<Modo>("fresadora")
  const [probando, setProbando] = useState<(Probar & { clave: number }) | null>(null)
  const [codigoProbado, setCodigoProbado] = useState<{ id: string; codigo: string } | null>(null)

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("maquina")
    if (m === "torno" || m === "ejercicios") setModo(m)
  }, [])

  const elegir = (m: Modo, mantenerPrueba = false) => {
    setModo(m)
    if (!mantenerPrueba) setProbando(null)
    const u = new URL(window.location.href)
    if (m === "fresadora") u.searchParams.delete("maquina")
    else u.searchParams.set("maquina", m)
    window.history.replaceState(null, "", u.toString())
  }

  const alProbar = (p: Probar) => {
    setProbando({ ...p, clave: Date.now() })
    setCodigoProbado({ id: p.ejercicio.id, codigo: p.codigo })
    elegir(p.ejercicio.maquina, true)
  }

  const avisoPrueba = probando && (
    <div className="rounded-[12px] border border-[#F07A1A] bg-[#F07A1A]/10 p-3 text-[13px] text-white">
      <T>Probando el ejercicio</T> <b>«<T>{probando.ejercicio.titulo}</T>»</b> <T>con su material y herramienta. Los cambios que hagas aquí se guardan en tu programa.</T>
      <button type="button" onClick={() => elegir("ejercicios")} className="mt-2 block font-semibold text-[#F28A3C] hover:underline">
        <T>← Volver al ejercicio para calificarlo</T>
      </button>
    </div>
  )

  const guardar = (codigo: string) => {
    if (!probando) return
    setCodigoProbado({ id: probando.ejercicio.id, codigo })
    localStorage.setItem(`hetna-sim-ej-${probando.ejercicio.id}`, codigo)
  }

  const inicialFresa: InicialFresa | undefined =
    probando && probando.ejercicio.maquina === "fresadora" && probando.ejercicio.material && probando.ejercicio.fresa
      ? { clave: probando.clave, codigo: probando.codigo, material: probando.ejercicio.material, fresa: probando.ejercicio.fresa }
      : undefined
  const inicialTorno: InicialTorno | undefined =
    probando && probando.ejercicio.maquina === "torno" && probando.ejercicio.barra && probando.ejercicio.inserto
      ? { clave: probando.clave, codigo: probando.codigo, barra: probando.ejercicio.barra, inserto: probando.ejercicio.inserto }
      : undefined

  return (
    <div>
      <div role="tablist" aria-label="Máquina" className="mb-3 inline-flex flex-wrap rounded-[10px] bg-white/[0.06] p-1">
        {MODOS.map(([m, t]) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={modo === m}
            onClick={() => elegir(m)}
            className={`rounded-[8px] px-3 py-1.5 text-[13px] font-bold ${modo === m ? "bg-[#F07A1A] text-white" : "text-white/70 hover:text-white"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {modo === "ejercicios" ? (
        <EjerciciosSimulador alProbar={alProbar} codigoProbado={codigoProbado} />
      ) : modo === "torno" ? (
        <SimuladorTorno inicial={inicialTorno} alCambiarCodigo={inicialTorno ? guardar : undefined} aviso={inicialTorno ? avisoPrueba : undefined} />
      ) : (
        <SimuladorCnc inicial={inicialFresa} alCambiarCodigo={inicialFresa ? guardar : undefined} aviso={inicialFresa ? avisoPrueba : undefined} />
      )}
    </div>
  )
}
