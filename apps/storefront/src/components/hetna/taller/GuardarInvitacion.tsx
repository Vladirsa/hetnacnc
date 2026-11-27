"use client"

// En /talleres/unete?ref=<handle> (liga "Invita a otro taller" del panel del
// taller): guarda quién invitó en una cookie de 30 días. El panel del taller
// (/seller, mismo dominio) la lee al entrar a Mi tablero y la manda a
// POST /vendor/hetna-referidos (packages/api/src/lib/referidos.ts).
import { T } from "@/components/hetna/i18n/Idioma"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export function GuardarInvitacion() {
  const ref = (useSearchParams().get("ref") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 80)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    if (!ref) return
    document.cookie = `hetna_ref=${ref}; path=/; max-age=${30 * 86400}; SameSite=Lax; Secure`
    setListo(true)
  }, [ref])

  if (!listo) return null
  return (
    <div className="border-b-2 border-[#1a3a5c] bg-[#EEF2FB]">
      <div className="mx-auto max-w-[1200px] px-4 py-3 text-[#142033] lg:px-8">
        <p className="font-extrabold"><T>🤝 Te invitó un taller de la red HETNA</T></p>
        <p className="mt-1 text-sm text-[#40403A]"><T>Registra tu taller abajo: es gratis y sólo se paga comisión cuando vendes.</T></p>
      </div>
    </div>
  )
}
