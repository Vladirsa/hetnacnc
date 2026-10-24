"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { addCamJobToCart } from "@/lib/data/cam"

type TrabajoCreado = {
  type: "hetna-cam:job-created"
  job_id: string
  access_token: string
  review: boolean
}

// El laboratorio es una página estática (public/cam-lab/index.html) dentro de
// un iframe del mismo dominio. Cuando el cliente pide el servicio, el
// laboratorio sube la pieza al backend y avisa aquí con postMessage; este marco
// mete el trabajo al carrito con la sesión del cliente y lo lleva a pagar.
//
// El backend es el mismo dominio (hetnacnc.com/store/... va a Medusa), así que
// no hace falta CORS ni exponer la dirección interna del servidor.
export function MarcoLaboratorio({
  locale,
  publishableKey,
}: {
  locale: string
  publishableKey: string
}) {
  const marco = useRef<HTMLIFrameElement>(null)
  const router = useRouter()
  const [src, setSrc] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tono: "info" | "error"; texto: string } | null>(null)

  useEffect(() => {
    const backend = window.location.origin
    setSrc(
      `/cam-lab/index.html?backend=${encodeURIComponent(backend)}&key=${encodeURIComponent(publishableKey)}`
    )
  }, [publishableKey])

  useEffect(() => {
    const alRecibir = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== marco.current?.contentWindow) {
        return
      }
      const datos = event.data as TrabajoCreado
      if (datos?.type !== "hetna-cam:job-created" || !datos.job_id || !datos.access_token) {
        return
      }
      setAviso({ tono: "info", texto: "Agregando el servicio a tu carrito…" })
      const r = await addCamJobToCart({
        jobId: datos.job_id,
        token: datos.access_token,
        review: Boolean(datos.review),
        countryCode: locale,
      })
      marco.current?.contentWindow?.postMessage(
        { type: "hetna-cam:cart-result", ok: r.ok, error: r.error ?? null },
        window.location.origin
      )
      if (r.ok) {
        router.push(`/${locale}/cart`)
        router.refresh()
      } else {
        setAviso({ tono: "error", texto: r.error ?? "No se pudo agregar al carrito" })
      }
    }
    window.addEventListener("message", alRecibir)
    return () => window.removeEventListener("message", alRecibir)
  }, [locale, router])

  return (
    <div className="relative w-full">
      {aviso && (
        <div
          role="status"
          className={`absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-[10px] px-4 py-2 text-[14px] shadow ${
            aviso.tono === "error" ? "bg-[#FDECEC] text-[#9B1C1C]" : "bg-white text-[#1B1B18]"
          }`}
        >
          {aviso.texto}
        </div>
      )}
      {src ? (
        <iframe
          ref={marco}
          src={src}
          title="Laboratorio CAM 3, 4 y 5 ejes"
          className="block h-[calc(100vh-64px)] min-h-[720px] w-full border-0 bg-[#0F1115]"
          allow="fullscreen; clipboard-write"
        />
      ) : (
        <div className="flex h-[720px] w-full items-center justify-center bg-[#0F1115] text-[14px] text-[#A5A29A]">
          Cargando el laboratorio…
        </div>
      )}
    </div>
  )
}
