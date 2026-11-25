"use client"

// Dónde está el cliente, para ordenar talleres por cercanía. Todo pasa en el
// navegador (las fichas se guardan en caché y no pueden llevar datos de quien
// las ve):
//   1. Lo que ya dijo antes: su código postal (localStorage "hetna_ubicacion",
//      vence a los 90 días).
//   2. Si no, el estado aproximado por su IP (/api/ubicacion), una vez por visita.
//   3. Cuando escribe su código postal aquí o en /cotizar (FormSolicitudTaller)
//      se avisa con EVENTO, se guarda y manda sobre lo de la IP.
// Todas las listas de la página reciben lo mismo (EVENTO y EVENTO_IP).
// Si el navegador bloquea el almacenamiento, simplemente no hay ubicación.
import { useCallback, useEffect, useState } from "react"

import { buscarCP } from "@/lib/envios/cotizar"
import { normalizarEstado, type UbicacionCliente } from "@/lib/ubicacion/cercania"

export type Ubicacion = UbicacionCliente & { fuente: "cp" | "ip" }

/** El código postal del cliente: { cp, municipio, estado } */
export const EVENTO = "hetna:ubicacion"
const EVENTO_IP = "hetna:ubicacion-ip"
const CLAVE = "hetna_ubicacion"
const CLAVE_IP = "hetna_ubicacion_ip"
const VIGENCIA_MS = 90 * 24 * 3600 * 1000

// localStorage puede lanzar con sólo nombrarlo (cookies bloqueadas, modo privado)
const almacen = (tipo: "local" | "session"): Storage | null => {
  try {
    return tipo === "local" ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}
const leer = (tipo: "local" | "session", k: string): (Ubicacion & { hasta?: number }) | null => {
  try {
    const v = JSON.parse(almacen(tipo)?.getItem(k) || "null")
    if (!v || typeof v !== "object" || typeof v.estado !== "string") return null
    return v.hasta && v.hasta < Date.now() ? null : v
  } catch {
    return null
  }
}
const guardar = (tipo: "local" | "session", k: string, v: unknown) => {
  try {
    almacen(tipo)?.setItem(k, JSON.stringify(v))
  } catch {
    // sin espacio o bloqueado: vale sólo para esta página
  }
}

/** Busca el código postal y avisa a todas las listas (y al formulario) de la página. */
export async function avisarUbicacion(cp: string): Promise<{ ok: true; municipio: string; estado: string } | { ok: false; mensaje: string }> {
  const r = await buscarCP(cp)
  if (!r.ok) return r
  const municipio = r.info.municipio || r.info.ciudad
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { cp, municipio, estado: r.info.estado } }))
  return { ok: true, municipio, estado: r.info.estado }
}

export function useUbicacion() {
  const [u, setU] = useState<Ubicacion | null>(null)
  const [aviso, setAviso] = useState("")

  useEffect(() => {
    const guardada = leer("local", CLAVE) || leer("session", CLAVE_IP)
    if (guardada) setU(guardada)
    else if (almacen("session") && almacen("session")?.getItem(CLAVE_IP) === null) {
      guardar("session", CLAVE_IP, null) // una sola consulta por visita
      fetch("/api/ubicacion", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : {}))
        .then((d: { estado?: string; ciudad?: string }) => {
          if (!d?.estado) return
          const v: Ubicacion = { estado: d.estado, municipio: d.ciudad || "", fuente: "ip" }
          guardar("session", CLAVE_IP, v)
          window.dispatchEvent(new CustomEvent(EVENTO_IP, { detail: v }))
        })
        .catch(() => {})
    }
    const deCp = (e: Event) => {
      const d = (e as CustomEvent<UbicacionCliente>).detail
      if (!d?.estado) return
      const v: Ubicacion = { cp: d.cp, municipio: d.municipio, estado: normalizarEstado(d.estado) || d.estado, fuente: "cp" }
      guardar("local", CLAVE, { ...v, hasta: Date.now() + VIGENCIA_MS })
      setU(v)
    }
    // la IP nunca pisa un código postal que ya dio
    const deIp = (e: Event) => setU((actual) => (actual?.fuente === "cp" ? actual : (e as CustomEvent<Ubicacion>).detail))
    window.addEventListener(EVENTO, deCp)
    window.addEventListener(EVENTO_IP, deIp)
    return () => {
      window.removeEventListener(EVENTO, deCp)
      window.removeEventListener(EVENTO_IP, deIp)
    }
  }, [])

  const ponerCp = useCallback(async (cp: string) => {
    setAviso("")
    const r = await avisarUbicacion(cp)
    if (!r.ok) setAviso(r.mensaje)
    return r.ok
  }, [])

  return { ubicacion: u, ponerCp, aviso }
}
