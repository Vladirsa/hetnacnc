"use client"

// Renglón "📍 Cerca de Puebla, Puebla · Cambiar" con el campo para el código
// postal (listas de talleres de la ficha: TalleresCerca, TalleresImpresion y
// TalleresPlano). CreditoIp: el crédito que pide la licencia de DB-IP (CC BY
// 4.0) donde se use la ubicación aproximada por IP.
import { useState } from "react"

import { textoUbicacion } from "@/lib/ubicacion/cercania"
import type { Ubicacion } from "@/lib/ubicacion/useUbicacion"

export const CreditoIp = () => (
  <span className="text-[#6B6A63]">
    {" "}(aproximado,{" "}
    <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer" className="underline">
      IP Geolocation by DB-IP
    </a>
    )
  </span>
)

export function TuUbicacion({ ubicacion, ponerCp, aviso }: { ubicacion: Ubicacion | null; ponerCp: (cp: string) => Promise<boolean>; aviso: string }) {
  const [editar, setEditar] = useState(false)
  const [cp, setCp] = useState("")
  const [buscando, setBuscando] = useState(false)

  const lugar = textoUbicacion(ubicacion)
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{5}$/.test(cp)) return
    setBuscando(true)
    const ok = await ponerCp(cp)
    setBuscando(false)
    if (ok) setEditar(false)
  }

  if (ubicacion && !editar)
    return (
      <p className="m-0 text-[12.5px] text-[#40403A]" data-testid="tu-ubicacion">
        📍 Cerca de <b>{lugar}</b>
        {ubicacion.fuente === "ip" && <CreditoIp />}
        {" · "}
        <button type="button" onClick={() => setEditar(true)} className="font-semibold text-[#B34D07] underline">
          {ubicacion.fuente === "ip" ? "Pon tu código postal" : "Cambiar"}
        </button>
      </p>
    )

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-center gap-2" data-testid="tu-ubicacion-cp">
      <label htmlFor="cp-cercania" className="text-[12.5px] text-[#40403A]">
        📍 Tu código postal para ver los más cercanos:
      </label>
      <input
        id="cp-cercania"
        value={cp}
        onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 5))}
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="72000"
        className="w-[88px] rounded-[8px] border border-[#D9D5C9] bg-white px-2 py-1 text-[13px]"
      />
      <button type="submit" disabled={cp.length !== 5 || buscando} className="rounded-[8px] bg-[#142033] px-3 py-1 text-[12.5px] font-bold text-white disabled:opacity-50">
        {buscando ? "Buscando…" : "Ver"}
      </button>
      {aviso && <span className="w-full text-[12px] text-[#9B3225]">{aviso}</span>}
    </form>
  )
}
