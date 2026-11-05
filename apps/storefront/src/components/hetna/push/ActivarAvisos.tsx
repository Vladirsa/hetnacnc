"use client"

// Botón "Activar avisos en mi celular" para clientes con sesión. Pide permiso,
// suscribe este navegador (service worker /sw.js) y lo liga a la cuenta.
// Avisos: pedido recibido, en camino, cancelado; propuestas y preguntas de
// talleres en sus solicitudes de fabricación; ofertas.
import { useEffect, useState } from "react"

import { activarPushCliente, desactivarPushCliente, llavePush } from "@/lib/data/push"

type Estado = "cargando" | "no-soportado" | "ios-instalar" | "bloqueado" | "inactivo" | "activo" | "activando"

const aBytes = (b64: string) => {
  const relleno = "=".repeat((4 - (b64.length % 4)) % 4)
  const crudo = atob((b64 + relleno).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0))
}

const nombreDispositivo = () => {
  const ua = navigator.userAgent
  if (/iphone|ipad/i.test(ua)) return "iPhone/iPad"
  if (/android/i.test(ua)) return "Android"
  if (/windows/i.test(ua)) return "Windows"
  if (/mac/i.test(ua)) return "Mac"
  return "Navegador"
}

async function registro() {
  return (await navigator.serviceWorker.getRegistration("/")) || (await navigator.serviceWorker.register("/sw.js"))
}

export function ActivarAvisos({ compacto = false }: { compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>("cargando")
  const [error, setError] = useState("")

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone
      if (!soporta) return vivo && setEstado(ios && !instalada ? "ios-instalar" : "no-soportado")
      if (Notification.permission === "denied") return vivo && setEstado("bloqueado")
      try {
        const reg = await registro()
        const sub = await reg.pushManager.getSubscription()
        if (sub && Notification.permission === "granted") {
          // Vuelve a ligarla a la cuenta (por si inició sesión con otra)
          await activarPushCliente(sub.toJSON() as never, nombreDispositivo())
          return vivo && setEstado("activo")
        }
      } catch {
        /* sigue como inactivo */
      }
      if (vivo) setEstado("inactivo")
    })()
    return () => {
      vivo = false
    }
  }, [])

  const activar = async () => {
    setError("")
    setEstado("activando")
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== "granted") return setEstado(permiso === "denied" ? "bloqueado" : "inactivo")
      const llave = await llavePush()
      if (!llave) {
        setError("Los avisos todavía no están disponibles. Intenta más tarde.")
        return setEstado("inactivo")
      }
      const reg = await registro()
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(llave) }))
      const r = await activarPushCliente(sub.toJSON() as never, nombreDispositivo())
      if (!r.ok) {
        setError(r.mensaje || "No se pudieron activar.")
        return setEstado("inactivo")
      }
      setEstado("activo")
    } catch {
      setError("No se pudieron activar los avisos en este navegador.")
      setEstado("inactivo")
    }
  }

  const desactivar = async () => {
    try {
      const reg = await registro()
      const sub = await reg.pushManager.getSubscription()
      if (sub) await desactivarPushCliente(sub.endpoint)
    } catch {
      /* nada */
    }
    setEstado("inactivo")
  }

  if (estado === "cargando" || estado === "no-soportado") return null

  const texto =
    estado === "activo"
      ? "Te avisaremos en este dispositivo cuando tu pedido vaya en camino o un taller te mande una propuesta."
      : estado === "ios-instalar"
        ? "En iPhone, primero agrega HETNA a tu pantalla de inicio: toca Compartir y luego \"Agregar a inicio\". Ábrela desde ahí y activa los avisos."
        : estado === "bloqueado"
          ? "Bloqueaste los avisos de HETNA en este navegador. Actívalos en los ajustes del sitio (el candado junto a la dirección)."
          : "Entérate al momento cuando tu pedido vaya en camino, cuando un taller te mande una propuesta y de las ofertas."

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-[14px] border p-4 ${
        estado === "activo" ? "border-[#BFE3CF] bg-[#EEF8F2]" : "border-[#F2C98F] bg-[#FFF8EE]"
      } ${compacto ? "" : "sm:p-5"}`}
    >
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[15px] font-bold text-[#1B1B18]">
          {estado === "activo" ? "🔔 Avisos activados en este dispositivo" : "🔔 Recibe avisos en tu celular"}
        </p>
        <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-[#44433D]">{texto}</p>
        {error && <p className="m-0 mt-1 text-[13px] text-[#8A1C1C]">{error}</p>}
      </div>
      {(estado === "inactivo" || estado === "activando") && (
        <button
          type="button"
          onClick={() => void activar()}
          disabled={estado === "activando"}
          className="shrink-0 rounded-[10px] bg-[#C2560A] px-4 py-2.5 text-[14px] font-bold text-white hover:bg-[#A84A08] disabled:opacity-60"
        >
          {estado === "activando" ? "Activando..." : "Activar avisos"}
        </button>
      )}
      {estado === "activo" && (
        <button type="button" onClick={() => void desactivar()} className="shrink-0 text-[13px] font-semibold text-[#6B6A63] underline">
          Desactivar
        </button>
      )}
    </div>
  )
}
