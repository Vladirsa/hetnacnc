"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"

import type { Taller } from "@/lib/hetna/talleres"
import { ubicacion } from "@/lib/hetna/talleres"

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  )

export default function MapaTalleres({
  talleres,
  locale,
  altura = 520,
  zoomUnico = 12,
}: {
  talleres: Taller[]
  locale: string
  altura?: number
  zoomUnico?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mapa: import("leaflet").Map | undefined
    let activo = true

    ;(async () => {
      const L = (await import("leaflet")).default
      if (!activo || !ref.current) return

      mapa = L.map(ref.current, { scrollWheelZoom: false }).setView([23.6, -102.5], 5)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap",
      }).addTo(mapa)

      const icono = L.divIcon({
        className: "",
        html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#E8590C;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
        popupAnchor: [0, -24],
      })

      const puntos: [number, number][] = []
      for (const t of talleres) {
        const { lat, lng } = t.perfil
        if (lat === undefined || lng === undefined) continue
        puntos.push([lat, lng])
        L.marker([lat, lng], { icon: icono })
          .addTo(mapa)
          .bindPopup(
            `<strong>${esc(t.nombre)}</strong><br/>${esc(ubicacion(t.perfil))}<br/>` +
              `<a href="/${esc(locale)}/talleres/${esc(t.handle)}" style="color:#E8590C;font-weight:600">Ver taller →</a>`
          )
      }

      if (puntos.length === 1) mapa.setView(puntos[0], zoomUnico)
      else if (puntos.length > 1) mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 9 })
    })()

    return () => {
      activo = false
      mapa?.remove()
    }
  }, [talleres, locale, zoomUnico])

  return (
    <div
      ref={ref}
      style={{ height: altura }}
      className="w-full overflow-hidden rounded-2xl border border-[#E7E4DC] bg-[#F3F1EA]"
      role="region"
      aria-label="Mapa de talleres"
    />
  )
}
