"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

import type { RedPorEstado } from "@/lib/foro/red"
import type { PorUnirse } from "@/lib/hetna/directorio"
import type { Taller } from "@/lib/hetna/talleres"

// Mapa de la red CNC por estado, con un ícono por tipo (talleres verificados,
// fundadores y de la comunidad, proveedores, profesionales y empresas del
// directorio que aún no se unen: perfiles no reclamados). El mapa SOLO
// muestra cuántos hay por estado y municipio: nunca la ubicación exacta.
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

// ---------------------------------------------------------------------
// Tipos del mapa: color e ícono (trazos de 24×24, en blanco sobre el color)
// ---------------------------------------------------------------------

type Tipo = "verificado" | "fundador" | "comunidad" | "proveedor" | "profesional" | "por_unirse"

const TIPOS: { id: Tipo; nombre: string; uno: string; varios: string; color: string; icono: string }[] = [
  {
    id: "verificado",
    nombre: "Talleres verificados",
    uno: "taller verificado",
    varios: "talleres verificados",
    color: "#1E7B3A",
    icono: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  },
  {
    id: "fundador",
    nombre: "Talleres fundadores",
    uno: "taller fundador",
    varios: "talleres fundadores",
    color: "#E0A400",
    icono: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  },
  {
    id: "comunidad",
    nombre: "Talleres de la comunidad",
    uno: "taller",
    varios: "talleres de la comunidad",
    color: "#1C6FD1",
    icono: '<path d="M4 10l1.5-5h13L20 10"/><path d="M4 10a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12.5V20h13v-7.5"/><path d="M10 20v-4.5h4V20"/>',
  },
  {
    id: "proveedor",
    nombre: "Proveedores y marcas",
    uno: "proveedor o marca",
    varios: "proveedores y marcas",
    color: "#0F5A44",
    icono: '<path d="M3 20V10l5 3V10l5 3V5h4l1 15z"/><path d="M3 20h18"/><path d="M7 16.5h1.5M11 16.5h1.5"/>',
  },
  {
    id: "profesional",
    nombre: "Profesionales CNC",
    uno: "profesional CNC",
    varios: "profesionales CNC",
    color: "#6C3FC4",
    icono: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4c1.5 1.5 3.5 2.3 5.5 2.3s4-.8 5.5-2.3v-4"/><path d="M21.5 9.5v5"/>',
  },
  {
    // Directorio: empresas CNC con datos públicos que todavía no tienen cuenta
    id: "por_unirse",
    nombre: "Empresas por unirse",
    uno: "empresa por unirse",
    varios: "empresas por unirse",
    color: "#7A7F87",
    icono: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 2.5"/><path d="M12 8v8M8 12h8"/>',
  },
]

const svgIcono = (t: (typeof TIPOS)[number], tam: number) =>
  `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t.icono}</svg>`

type Grupo = { estado: string; total: number; municipios: [string, number][] }

const agrupar = (talleres: Taller[]): Map<string, Grupo> => {
  const m = new Map<string, Map<string, number>>()
  for (const t of talleres) {
    const e = estadoValido(t.perfil.estado)
    if (!e) continue
    const mun = t.perfil.ciudad?.trim() || "Otros municipios"
    const porMun = m.get(e) ?? new Map<string, number>()
    porMun.set(mun, (porMun.get(mun) ?? 0) + 1)
    m.set(e, porMun)
  }
  return new Map(
    [...m.entries()].map(([estado, porMun]) => [
      estado,
      {
        estado,
        municipios: [...porMun.entries()].sort((a, b) => b[1] - a[1]),
        total: [...porMun.values()].reduce((a, b) => a + b, 0),
      },
    ])
  )
}

// Un taller verificado cuenta como verificado aunque también sea fundador.
const tipoDeTaller = (t: Taller): Tipo => (t.verificado ? "verificado" : t.fundador ? "fundador" : "comunidad")

export const agruparPorEstado = (talleres: Taller[]): Grupo[] => [...agrupar(talleres).values()].sort((a, b) => b.total - a.total)

export default function MapaTalleres({
  talleres,
  red = {},
  porUnirse = {},
  locale = "mx",
  altura = 520,
  onEstado,
}: {
  talleres: Taller[]
  red?: RedPorEstado
  /** Empresas del directorio (perfiles no reclamados) por estado */
  porUnirse?: PorUnirse
  locale?: string
  altura?: number
  /** Al elegir "Ver talleres" en un globo, filtra la lista por ese estado. */
  onEstado?: (estado: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [ocultos, setOcultos] = useState<Set<Tipo>>(new Set())

  // Por estado: cuántos hay de cada tipo (y en qué municipios, para los talleres)
  const datos = useMemo(() => {
    const porTipo: Record<Tipo, Map<string, Grupo>> = {
      verificado: agrupar(talleres.filter((t) => tipoDeTaller(t) === "verificado")),
      fundador: agrupar(talleres.filter((t) => tipoDeTaller(t) === "fundador")),
      comunidad: agrupar(talleres.filter((t) => tipoDeTaller(t) === "comunidad")),
      proveedor: new Map(),
      profesional: new Map(),
      por_unirse: new Map(),
    }
    for (const [e, g] of Object.entries(porUnirse)) {
      const estado = estadoValido(e)
      if (estado && g.total) porTipo.por_unirse.set(estado, { estado, total: g.total, municipios: g.municipios })
    }
    for (const [e, n] of Object.entries(red)) {
      const estado = estadoValido(e)
      if (!estado) continue
      for (const [tipo, total] of [["proveedor", n.proveedores], ["profesional", n.profesionales]] as const) {
        if (!total) continue
        const previo = porTipo[tipo].get(estado)
        porTipo[tipo].set(estado, { estado, total: (previo?.total || 0) + total, municipios: [] })
      }
    }
    return porTipo
  }, [talleres, red, porUnirse])

  const totales = useMemo(
    () => Object.fromEntries(TIPOS.map((t) => [t.id, [...datos[t.id].values()].reduce((a, g) => a + g.total, 0)])) as Record<Tipo, number>,
    [datos]
  )
  const conTalleres = useMemo(() => agruparPorEstado(talleres), [talleres])

  // Se guarda la función en una ref para no rehacer el mapa cuando cambia
  const alElegir = useRef(onEstado)
  alElegir.current = onEstado

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

      // Un grupo por estado: sus íconos (uno por tipo) en fila. Los estados del
      // centro quedan muy juntos, así que los grupos se separan solos para no
      // encimarse y una línea fina los une con su estado.
      const TAM = 34
      const PASO = TAM + 4
      type Marca = { estado: string; ancho: number; marker: import("leaflet").Marker; linea: import("leaflet").Polyline; punto: import("leaflet").CircleMarker }
      const marcas: Marca[] = []

      for (const estado of CLAVES) {
        const visibles = TIPOS.filter((t) => !ocultos.has(t.id) && datos[t.id].get(estado))
        if (!visibles.length) continue
        const ancho = visibles.length * PASO - 4
        const iconos = visibles
          .map((t) => {
            const g = datos[t.id].get(estado)!
            const insignia =
              g.total > 1
                ? `<span style="position:absolute;top:-7px;right:-8px;min-width:19px;height:19px;padding:0 4px;border-radius:10px;background:#142033;color:#fff;font:700 11px/19px system-ui,sans-serif;text-align:center;border:2px solid #fff;box-sizing:border-box">${g.total}</span>`
                : ""
            return (
              `<div style="position:relative;flex:none;width:${TAM}px;height:${TAM}px;border-radius:50%;background:${t.color};border:2.5px solid #fff;box-sizing:border-box;` +
              `box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center" title="${esc(t.nombre)}: ${g.total}">` +
              `${svgIcono(t, 17)}${insignia}</div>`
            )
          })
          .join("")
        const icono = L.divIcon({
          className: "",
          html: `<div style="display:flex;gap:4px;width:${ancho}px">${iconos}</div>`,
          iconSize: [ancho, TAM],
          iconAnchor: [ancho / 2, TAM / 2],
          popupAnchor: [0, -TAM / 2],
        })

        // Globo: cada tipo con su número, municipios y a dónde ir
        const caja = document.createElement("div")
        caja.style.minWidth = "200px"
        caja.innerHTML = `<strong style="color:#142033;font-size:15px">${esc(estado)}</strong>`
        for (const t of visibles) {
          const g = datos[t.id].get(estado)!
          const fila = document.createElement("div")
          fila.style.marginTop = "8px"
          fila.innerHTML =
            `<span style="display:inline-flex;align-items:center;gap:6px;font-weight:700;color:${t.color}">` +
            `<span style="display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:${t.color}">${svgIcono(t, 12)}</span>` +
            `${g.total} ${g.total === 1 ? esc(t.uno) : esc(t.varios)}</span>` +
            (g.municipios.length
              ? `<div style="color:#40403A;font-size:12.5px;margin:2px 0 0 26px">${g.municipios
                  .map(([mun, n]) => `${esc(mun)} (${n})`)
                  .join(" · ")}</div>`
              : "")
          if (t.id === "por_unirse") {
            const liga = document.createElement("a")
            liga.href = `/${locale}/talleres/directorio?estado=${encodeURIComponent(estado)}`
            liga.textContent = "Ver directorio (perfiles no reclamados) →"
            liga.setAttribute("style", "display:block;margin:2px 0 0 26px;font-size:12.5px;font-weight:600;color:#C2560A")
            fila.appendChild(liga)
          }
          if (t.id === "proveedor" || t.id === "profesional") {
            const liga = document.createElement("a")
            liga.href = `/${locale}/foro-cnc/profesionales?estado=${encodeURIComponent(estado)}${t.id === "proveedor" ? "&tipo=proveedor" : ""}`
            liga.textContent = t.id === "proveedor" ? "Ver proveedores →" : "Ver profesionales →"
            liga.setAttribute("style", "display:block;margin:2px 0 0 26px;font-size:12.5px;font-weight:600;color:#C2560A")
            fila.appendChild(liga)
          }
          caja.appendChild(fila)
        }
        if (alElegir.current && visibles.some((t) => t.id === "verificado" || t.id === "fundador" || t.id === "comunidad")) {
          const boton = document.createElement("button")
          boton.type = "button"
          boton.textContent = "Ver los talleres de este estado"
          boton.setAttribute(
            "style",
            "display:block;margin-top:10px;padding:6px 10px;border-radius:8px;border:0;background:#C2560A;color:#fff;font-weight:600;font-size:13px;cursor:pointer"
          )
          boton.addEventListener("click", () => {
            alElegir.current?.(estado)
            mapa?.closePopup()
          })
          caja.appendChild(boton)
        }

        const centro = CENTROS[estado]
        const linea = L.polyline([centro, centro], { color: "#142033", weight: 1, opacity: 0.55, interactive: false }).addTo(mapa)
        const punto = L.circleMarker(centro, { radius: 3, color: "#142033", weight: 1, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(mapa)
        const marker = L.marker(centro, { icon: icono, title: estado, alt: `Red CNC en ${estado}`, riseOnHover: true })
          .addTo(mapa)
          .bindPopup(caja)
        marcas.push({ estado, ancho, marker, linea, punto })
      }

      // Separa los grupos que se enciman (en píxeles del zoom actual)
      const acomodar = () => {
        if (!mapa) return
        const base = marcas.map((m) => mapa!.latLngToLayerPoint(CENTROS[m.estado]))
        const pos = base.map((p) => ({ x: p.x, y: p.y }))
        const alto = TAM + 6
        for (let vuelta = 0; vuelta < 80; vuelta++) {
          let movio = false
          for (let i = 0; i < marcas.length; i++) {
            for (let j = i + 1; j < marcas.length; j++) {
              const dx = pos[j].x - pos[i].x
              const dy = pos[j].y - pos[i].y
              const sx = (marcas[i].ancho + marcas[j].ancho) / 2 + 6 - Math.abs(dx)
              const sy = alto - Math.abs(dy)
              if (sx <= 0 || sy <= 0) continue
              movio = true
              // Se separan hacia arriba/abajo (lo más corto para filas anchas)
              const empuje = (sy / 2 + 0.5) * (dy >= 0 ? 1 : -1) || sy / 2 + 0.5
              pos[i].y -= empuje
              pos[j].y += empuje
            }
          }
          if (!movio) break
        }
        marcas.forEach((m, i) => {
          const ll = mapa!.layerPointToLatLng(L.point(pos[i].x, pos[i].y))
          m.marker.setLatLng(ll)
          const lejos = Math.hypot(pos[i].x - base[i].x, pos[i].y - base[i].y) > 8
          m.linea.setLatLngs(lejos ? [CENTROS[m.estado], ll] : [CENTROS[m.estado], CENTROS[m.estado]])
          m.punto.setStyle({ opacity: lejos ? 1 : 0, fillOpacity: lejos ? 1 : 0 })
        })
      }
      acomodar()
      mapa.on("zoomend", acomodar)
    })()

    return () => {
      activo = false
      mapa?.remove()
    }
  }, [datos, ocultos, locale])

  const alternar = (id: Tipo) =>
    setOcultos((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div>
      <div
        ref={ref}
        style={{ height: altura }}
        className="w-full overflow-hidden rounded-2xl border border-[#E7E4DC] bg-[#F3F1EA]"
        role="region"
        aria-label="Mapa de la red CNC por estado"
      />

      {/* Simbología: cada tipo se puede ocultar o mostrar */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 rounded-xl border border-[#E7E4DC] bg-[#FAF8F3] px-4 py-3">
        {TIPOS.filter((t) => totales[t.id] > 0).map((t) => {
          const apagado = ocultos.has(t.id)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => alternar(t.id)}
              aria-pressed={!apagado}
              title={apagado ? "Mostrar en el mapa" : "Ocultar del mapa"}
              className={`flex items-center gap-2 text-[14px] text-[#142033] transition ${apagado ? "opacity-40" : ""}`}
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-white shadow"
                style={{ background: t.color }}
                dangerouslySetInnerHTML={{ __html: svgIcono(t, 15) }}
              />
              {t.nombre} <span className="text-[#6B675C]">({totales[t.id]})</span>
            </button>
          )
        })}
      </div>

      {conTalleres.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {conTalleres.map((g) => (
            <li key={g.estado}>
              <button
                type="button"
                onClick={() => onEstado?.(g.estado)}
                className="rounded-full bg-[#F3F1EA] px-3 py-1 text-[#40403A] hover:bg-[#E7E4DC]"
              >
                {g.estado}: <strong>{g.total}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-[#6B675C]">
        El mapa muestra cuántos hay por estado y municipio, nunca la dirección. La cotización y el contacto se hacen dentro de HETNA.
        {totales.por_unirse > 0 && (
          <> «Empresas por unirse» son negocios CNC con datos públicos que todavía no tienen cuenta en HETNA.</>
        )}
      </p>
    </div>
  )
}
