"use client"

// "Avísame de productos nuevos" (28 nov 2026, Vlado): como los avisos de una
// tienda en línea, sin necesidad de cuenta. Suscribe este navegador al aviso
// diario de productos nuevos (packages/api/src/jobs/novedades-push.ts).
// En iPhone sólo funciona con HETNA agregado a la pantalla de inicio (regla de Apple).
import { T } from "@/components/hetna/i18n/Idioma"
import { useEffect, useState } from "react"

import { aBytes, nombreDispositivo, registro } from "@/components/hetna/push/ActivarAvisos"
import { activarPushNovedades, desactivarPushNovedades, llavePush } from "@/lib/data/push"

type Estado = "cargando" | "no-soportado" | "ios-instalar" | "bloqueado" | "inactivo" | "activo" | "activando"
const CLAVE = "hetna_avisos_novedades"

export function AvisosNovedades({ compacto = false }: { compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>("cargando")
  const [error, setError] = useState("")

  useEffect(() => {
    const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone
    if (!soporta) return setEstado(ios && !instalada ? "ios-instalar" : "no-soportado")
    if (Notification.permission === "denied") return setEstado("bloqueado")
    if (!(Notification.permission === "granted" && localStorage.getItem(CLAVE) === "1")) return setEstado("inactivo")
    // ya lo había activado: se vuelve a mandar la suscripción de este navegador (si el servidor la
    // borró o el navegador la cambió, así se recupera); si ya no hay, queda como inactivo
    let vivo = true
    ;(async () => {
      try {
        const sub = await (await registro()).pushManager.getSubscription()
        if (!sub) {
          localStorage.removeItem(CLAVE)
          return vivo && setEstado("inactivo")
        }
        const r = await activarPushNovedades(sub.toJSON() as never, nombreDispositivo())
        if (vivo) setEstado(r.ok ? "activo" : "inactivo")
      } catch {
        if (vivo) setEstado("inactivo")
      }
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
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(llave) }))
      const r = await activarPushNovedades(sub.toJSON() as never, nombreDispositivo())
      if (!r.ok) {
        setError(r.mensaje || "No se pudieron activar.")
        return setEstado("inactivo")
      }
      localStorage.setItem(CLAVE, "1")
      setEstado("activo")
    } catch {
      setError("No se pudieron activar los avisos en este navegador.")
      setEstado("inactivo")
    }
  }

  const desactivar = async () => {
    try {
      const sub = await (await registro()).pushManager.getSubscription()
      if (sub) await desactivarPushNovedades(sub.endpoint)
    } catch {
      /* nada */
    }
    localStorage.removeItem(CLAVE)
    setEstado("inactivo")
  }

  if (estado === "cargando" || estado === "no-soportado") return null

  const texto =
    estado === "activo"
      ? "Te avisaremos en este dispositivo cuando lleguen productos nuevos (máximo un aviso al día)."
      : estado === "ios-instalar"
        ? "En iPhone, primero agrega HETNA a tu pantalla de inicio: toca Compartir y luego \"Agregar a inicio\". Ábrela desde ahí y activa los avisos."
        : estado === "bloqueado"
          ? "Bloqueaste los avisos de HETNA en este navegador. Actívalos en los ajustes del sitio (el candado junto a la dirección)."
          : "Recibe en tu celular un aviso cuando lleguen productos nuevos a la tienda. Sin cuenta y sin spam: máximo uno al día."

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-[14px] border ${compacto ? "p-3" : "p-4"} ${estado === "activo" ? "border-[#BFE3CF] bg-[#EEF8F2]" : "border-[#F2C98F] bg-[#FFF8EE]"}`}>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[15px] font-bold text-[#1B1B18]">
          <T>{estado === "activo" ? "🔔 Avisos de productos nuevos activados" : "🔔 Avísame de productos nuevos"}</T>
        </p>
        <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-[#44433D]"><T>{texto}</T></p>
        {error && <p className="m-0 mt-1 text-[13px] text-[#8A1C1C]"><T>{error}</T></p>}
      </div>
      {(estado === "inactivo" || estado === "activando") && (
        <button type="button" onClick={() => void activar()} disabled={estado === "activando"} className="shrink-0 rounded-[10px] bg-[#C2560A] px-4 py-2.5 text-[14px] font-bold text-white hover:bg-[#A84A08] disabled:opacity-60">
          <T>{estado === "activando" ? "Activando..." : "Activar avisos"}</T>
        </button>
      )}
      {estado === "activo" && (
        <button type="button" onClick={() => void desactivar()} className="shrink-0 text-[13px] font-semibold text-[#6B6A63] underline">
          <T>Desactivar</T>
        </button>
      )}
    </div>
  )
}
