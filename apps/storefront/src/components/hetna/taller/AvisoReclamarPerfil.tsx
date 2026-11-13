"use client"

// En /talleres/unete?perfil=<slug> (enlace de los correos «un cliente te busca» y
// del botón «Reclamar mi perfil» del directorio): confirma qué perfil se está
// reclamando y qué pasa al registrarse. Se lee en el navegador para que la página
// siga siendo estática y rápida.
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { perfilPorReclamar } from "@/lib/hetna/directorio-acciones"

export function AvisoReclamarPerfil() {
  const slug = useSearchParams().get("perfil") || ""
  const [perfil, setPerfil] = useState<{ empresa: string; lugar: string } | null>(null)

  useEffect(() => {
    if (!/^[a-z0-9-]{3,120}$/.test(slug)) return
    perfilPorReclamar(slug).then(setPerfil).catch(() => {})
  }, [slug])

  if (!perfil) return null
  return (
    <div className="border-b-2 border-[#C2560A] bg-[#FDEEE1]">
      <div className="mx-auto max-w-[1200px] px-4 py-4 text-[#142033] lg:px-8">
        <p className="font-extrabold">
          Estás reclamando el perfil de {perfil.empresa}
          {perfil.lugar ? ` (${perfil.lugar})` : ""}
        </p>
        <p className="mt-1 text-sm text-[#40403A]">
          Registra tu taller abajo, de preferencia con el correo de tu empresa. Al terminar, tu perfil de HETNA (con tus
          fotos, máquinas y servicios) sustituye al perfil no reclamado y podrás cotizar las solicitudes de clientes de tu
          zona.{" "}
          <a href="#registro" className="font-semibold text-[#C2560A] underline">
            Ir al registro
          </a>
        </p>
      </div>
    </div>
  )
}
