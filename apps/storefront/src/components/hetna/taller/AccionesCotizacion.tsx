"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { enviarCotizacion } from "@/lib/cotizador/acciones"

type Envio = {
  url_publica: string | null
  whatsapp_url: string
}

// El envío no manda el mensaje: marca la cotización como enviada y devuelve el
// link público y el texto de WhatsApp listo. Quien aprieta "enviar" en
// WhatsApp es el taller, desde su propio número -- es su cliente, no el
// nuestro.
export const AccionesCotizacion = ({
  cotizacionId,
  yaEnviada,
}: {
  cotizacionId: string
  yaEnviada: boolean
}) => {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [envio, setEnvio] = useState<Envio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const preparar = async () => {
    setCargando(true)
    setError(null)
    const res = await enviarCotizacion(cotizacionId)
    setCargando(false)

    if (!res.ok) {
      setError(res.mensaje)
      return
    }
    setEnvio({ url_publica: res.datos.url_publica, whatsapp_url: res.datos.whatsapp_url })
    // El estatus pasó de borrador a enviada: el detalle lo muestra arriba.
    router.refresh()
  }

  const copiar = async () => {
    if (!envio?.url_publica) return
    try {
      await navigator.clipboard.writeText(envio.url_publica)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setError("Tu navegador no dejó copiar. Selecciona el link y cópialo a mano.")
    }
  }

  return (
    <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
      <h2 className="text-[16px] font-bold text-[#1B1B18]">Enviar al cliente</h2>
      <p className="mt-1.5 text-[13px] text-[#6B6A63] leading-relaxed">
        Se genera un link que abre la cotización en el navegador. Cuando el cliente lo
        abre, el estatus cambia a “vista”.
      </p>

      {!envio ? (
        <>
          <button
            type="button"
            onClick={preparar}
            disabled={cargando}
            className="mt-4 w-full bg-[#C2560A] hover:bg-[#A84A08] disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
          >
            {cargando ? "Preparando…" : yaEnviada ? "Volver a obtener el link" : "Preparar envío"}
          </button>
          {error && <p role="alert" className="mt-3 text-[13px] font-medium text-[#9B3225]">{error}</p>}
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <a
            href={envio.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center bg-[#1F8F4E] hover:bg-[#19763F] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
          >
            Abrir WhatsApp con el mensaje
          </a>

          {envio.url_publica && (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6A63]">
                Link de la cotización
              </p>
              <p className="break-all rounded-[10px] bg-[#F5F4F1] px-3 py-2.5 text-[13px] text-[#4A4943]">
                {envio.url_publica}
              </p>
              <button
                type="button"
                onClick={copiar}
                className="border border-[#E7E4DC] hover:border-[#C2560A] text-[#1B1B18] font-semibold px-4 py-2.5 rounded-[10px] text-[14px]"
              >
                {copiado ? "Copiado" : "Copiar link"}
              </button>
            </>
          )}
          {error && <p role="alert" className="text-[13px] font-medium text-[#9B3225]">{error}</p>}
        </div>
      )}
    </div>
  )
}
