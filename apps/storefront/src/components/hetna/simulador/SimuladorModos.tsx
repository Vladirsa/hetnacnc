"use client"

// Elige la máquina del simulador: fresadora/router o torno CNC (?maquina=torno).
import { useEffect, useState } from "react"

import { SimuladorCnc } from "./SimuladorCnc"
import { SimuladorTorno } from "./SimuladorTorno"

type Maquina = "fresadora" | "torno"

export function SimuladorModos() {
  const [maquina, setMaquina] = useState<Maquina>("fresadora")
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("maquina") === "torno") setMaquina("torno")
  }, [])
  const elegir = (m: Maquina) => {
    setMaquina(m)
    const u = new URL(window.location.href)
    if (m === "torno") u.searchParams.set("maquina", "torno")
    else u.searchParams.delete("maquina")
    window.history.replaceState(null, "", u.toString())
  }
  return (
    <div>
      <div role="tablist" aria-label="Máquina" className="mb-3 inline-flex rounded-[10px] bg-white/[0.06] p-1">
        {([["fresadora", "Fresadora y router (3 ejes)"], ["torno", "Torno CNC (2 ejes)"]] as [Maquina, string][]).map(([m, t]) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={maquina === m}
            onClick={() => elegir(m)}
            className={`rounded-[8px] px-3 py-1.5 text-[13px] font-bold ${maquina === m ? "bg-[#F07A1A] text-white" : "text-white/70 hover:text-white"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {maquina === "torno" ? <SimuladorTorno /> : <SimuladorCnc />}
    </div>
  )
}
