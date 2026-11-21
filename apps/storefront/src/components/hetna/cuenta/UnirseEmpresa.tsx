"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { accionEquipo } from "@/lib/cotizar/solicitud-taller"

// Acepta la invitación a una empresa (liga del correo) y lleva a Mi empresa.
export function UnirseEmpresa({ token }: { token: string }) {
  const router = useRouter()
  const [msg, setMsg] = useState("Uniéndote a la empresa…")
  useEffect(() => {
    accionEquipo({ accion: "unirse", token }).then((r) => {
      if (r.ok) router.replace("/mx/user/empresa")
      else setMsg(r.mensaje || "No se pudo aceptar la invitación.")
    })
  }, [token, router])
  return <p className="text-[15px] text-[#4A4943]">{msg}</p>
}
