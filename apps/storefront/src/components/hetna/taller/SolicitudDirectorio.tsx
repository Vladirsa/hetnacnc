"use client"

// Formulario de cotización en el perfil de una empresa NO RECLAMADA del
// directorio. La solicitud se manda ABIERTA a la red (sin taller elegido), así el
// cliente recibe propuestas de talleres de HETNA aunque la empresa no responda; al
// quedar registrada se invita a la empresa a reclamar su perfil para cotizarla.
import { useState } from "react"

import FormSolicitudTaller from "@/components/hetna/taller/FormSolicitudTaller"
import { avisarInteresDirectorio, pedirRetiroDirectorio } from "@/lib/hetna/directorio-acciones"

export function SolicitudDirectorio({ slug }: { slug: string }) {
  return (
    <FormSolicitudTaller
      alEnviar={(d) => {
        // Se manda aparte y sin esperar: si falla, la solicitud del cliente ya está a salvo.
        avisarInteresDirectorio({ slug, ...d }).catch(() => {})
      }}
    />
  )
}

export function QuitarPerfil({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<"listo" | "enviando" | "ok" | "error">("listo")
  if (estado === "ok")
    return (
      <p className="text-sm text-[#1E7B3A]">
        Listo. Mandamos un correo a la dirección de contacto de la empresa para que confirme el retiro.
      </p>
    )
  return (
    <button
      type="button"
      disabled={estado === "enviando"}
      onClick={async () => {
        setEstado("enviando")
        setEstado((await pedirRetiroDirectorio(slug)) ? "ok" : "error")
      }}
      className="text-sm font-semibold text-[#6B675C] underline underline-offset-2 hover:text-[#142033] disabled:opacity-50"
    >
      {estado === "error" ? "No se pudo enviar. Escríbenos a contacto@hetnacnc.com" : "¿Es tu empresa y no quieres aparecer? Quitar este perfil"}
    </button>
  )
}
