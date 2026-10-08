"use client"

import { useEffect, useMemo, useRef } from "react"
import "leaflet/dist/leaflet.css"

import type { Taller } from "@/lib/hetna/talleres"

// Centro aproximado de cada estado. El mapa SOLO muestra cuántos talleres hay
// por estado y municipio: nunca la ubicación exacta de un taller.
const CENTROS: Record<string, [number, number]> = {
  "Aguascalientes": [21.88, -102.29], "Baja California": [30.84, -115.28], "Baja California Sur": [26.04, -111.67],
  "Campeche": [19.0, -90.5], "Chiapas": [16.75, -92.64], "Chihuahua": [28.63, -106.07],
  "Ciudad de México": [19.43, -99.13], "Coahuila": [27.06, -101.71], "Colima": [19.12, -103.89],
  "Durango": [24.56, -104.66], "Estado de México": [19.35, -99.63], "Guanajuato": [21.02, -101.26],
  "Guerrero": [17.44, -99.55], "Hidalgo": [20.48, -98.86], "Jalisco": [20.66, -103.35],
  "Michoacán": [19.57, -101.71], "Morelos": [18.68, -99.1], "Nayarit": [21.75, -104.85],
  "Nuevo León": [25.59, -99.99], "Oaxaca": [17.07, -96.72], "Puebla": [19.04, -98.2],
  "Querétaro": [20.59, -100.39], "Quintana Roo": [19.18, -88.48], "San Luis Potosí": [22.16, -100.99],
  "Sinaloa": [25.17, -107.48], "Sonora": [29.3, -110.33], "Tabasco": [17.84, -92.62],
  "Tamaulipas": [24.27, -98.84], "Tlaxcala": [19.32, -98.24], "Veracruz": [19.17, -96.13],
  "Yucatán": [20.71, -89.09], "Zacatecas": [22.77, -102.58],
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
const CLAVES = Object.keys(CENTROS)
const estadoValido = (e?: string) => (e ? CLAVES.find((k) => sinAcentos(k) === sinAcentos(e)) : undefined)

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  )

type Grupo = { estado: string; total: number; municipios: [string, number][] }

export const agruparPorEstado = (talleres: Taller[]): Grupo[] => {
  const m = new Map<string, Map<string, number>>()
  for (const t of talleres) {
    const e = estadoValido(t.perfil.estado)
    if (!e) continue
    const mun = t.perfil.ciudad?.trim() || "Otros municipios"
    const porMun = m.get(e) ?? new Map<string, number>()
    porMun.set(mun, (porMun.get(mun) ?? 0) + 1)
    m.set(e, porMun)
  }
  return [...m.entries()]
    .map(([estado, porMun]) => ({
      estado,
      municipios: [...porMun.entries()].sort((a, b) => b[1] - a[1]),
      total: [...porMun.values()].reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
}

export default function MapaTalleres({
  talleres,
  altura = 520,
}: {
  talleres: Taller[]
  locale?: string
  altura?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const grupos = useMemo(() => agruparPorEstado(talleres), [talleres])

  useEffect(() => {
    let mapa: import("leaflet").Map | undefined
    let activo = true

    ;(async () => {
      const L = (await import("leaflet")).default
      if (!activo || !ref.current) return

      mapa = L.map(ref.current, { scrollWheelZoom: false, maxZoom: 7, minZoom: 4 }).setView([23.6, -102.5], 5)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 7,
        attribution: "&copy; OpenStreetMap",
      }).addTo(mapa)

      for (const g of grupos) {
        const tam = Math.min(64, 30 + g.total * 6)
        const icono = L.divIcon({
          className: "",
          html: `<div style="width:${tam}px;height:${tam}px;border-radius:50%;background:rgba(194,86,10,.9);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:${tam > 40 ? 18 : 15}px">${g.total}</div>`,
          iconSize: [tam, tam],
          iconAnchor: [tam / 2, tam / 2],
          popupAnchor: [0, -tam / 2],
        })
        const lista = g.municipios
          .map(([mun, n]) => `<li>${esc(mun)}: <strong>${n}</strong></li>`)
          .join("")
        L.marker(CENTROS[g.estado], { icon: icono })
          .addTo(mapa)
          .bindPopup(
            `<strong style="color:#142033">${esc(g.estado)}</strong><br/>` +
              `${g.total} ${g.total === 1 ? "taller" : "talleres"}` +
              `<ul style="margin:6px 0 0;padding-left:16px">${lista}</ul>`
          )
      }
    })()

    return () => {
      activo = false
      mapa?.remove()
    }
  }, [grupos])

  return (
    <div>
      <div
        ref={ref}
        style={{ height: altura }}
        className="w-full overflow-hidden rounded-2xl border border-[#E7E4DC] bg-[#F3F1EA]"
        role="region"
        aria-label="Mapa de talleres por estado"
      />
      {grupos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {grupos.map((g) => (
            <li key={g.estado} className="rounded-full bg-[#F3F1EA] px-3 py-1 text-[#40403A]">
              {g.estado}: <strong>{g.total}</strong>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-[#6B675C]">
        El mapa muestra cuántos talleres hay por estado y municipio. La cotización y el contacto se hacen dentro de HETNA.
      </p>
    </div>
  )
}
