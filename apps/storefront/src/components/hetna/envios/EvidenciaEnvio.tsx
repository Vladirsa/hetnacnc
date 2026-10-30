"use client"

// Evidencia de un envío: las 4 fotos que pide la paquetería para pelear un
// sobrepeso (alto, largo y ancho con cinta métrica y el paquete en la
// báscula, siempre con la guía visible), más la del contenido y extras. Se
// suben al bucket privado y quedan guardadas por si pasa algún incidente.
import { useState } from "react"

import { type EvidenciaResumen, type TipoEvidencia, guardarEvidencia, verEvidencia } from "@/lib/envios/cotizar"
import { subirArchivo } from "@/lib/subir-archivo"

const ESPACIOS: [TipoEvidencia, string, string][] = [
  ["alto", "Alto", "Cinta métrica de la base a la parte más alta, con la guía visible"],
  ["largo", "Largo", "Cinta métrica de extremo a extremo del lado más largo, con la guía visible"],
  ["ancho", "Ancho", "Cinta métrica de extremo a extremo del lado corto, con la guía visible"],
  ["bascula", "Báscula", "El paquete sobre la báscula, que se lean el peso y la guía"],
  ["contenido", "Contenido (opcional)", "Lo que va dentro antes de cerrar la caja: ayuda en reclamos por daño"],
]

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })

export function EvidenciaEnvio({ folio, inicial }: { folio: string; inicial: EvidenciaResumen[] }) {
  const [ev, setEv] = useState(inicial)
  const [subiendo, setSubiendo] = useState<{ tipo: TipoEvidencia; pct: number } | null>(null)
  const [error, setError] = useState("")
  const [ligas, setLigas] = useState<Record<string, string | null> | null>(null)

  const subir = async (tipo: TipoEvidencia, archivo: File | undefined) => {
    if (!archivo) return
    setError("")
    if (!/^image\//.test(archivo.type) && !/\.(heic|jpe?g|png|webp)$/i.test(archivo.name)) return setError("Sube una foto (JPG, PNG, WEBP o HEIC).")
    setSubiendo({ tipo, pct: 0 })
    try {
      const g = await subirArchivo(archivo, (pct) => setSubiendo({ tipo, pct }), "envio")
      const r = await guardarEvidencia(folio, { tipo, ...g })
      if (r.ok) {
        setEv(r.evidencia)
        setLigas(null)
      } else setError(r.mensaje)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubiendo(null)
    }
  }

  const ver = async () => {
    const fotos = await verEvidencia(folio)
    setLigas(Object.fromEntries(fotos.map((f) => [`${f.tipo}-${f.subido}`, f.url])))
  }

  const obligatorias = ESPACIOS.slice(0, 4).filter(([t]) => ev.some((e) => e.tipo === t)).length
  const extras = ev.filter((e) => e.tipo === "extra")

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm font-bold text-[#142033]">
          Evidencia del paquete{" "}
          <span className={obligatorias === 4 ? "text-[#1E7B3A]" : "text-[#B3261E]"}>({obligatorias} de 4 obligatorias)</span>
        </p>
        {ev.length > 0 && (
          <button type="button" onClick={ver} className="text-sm font-semibold text-[#C2560A] hover:underline">
            Ver mis fotos
          </button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {ESPACIOS.map(([tipo, titulo, ayuda]) => {
          const hecho = ev.find((e) => e.tipo === tipo)
          const liga = hecho && ligas ? ligas[`${tipo}-${hecho.subido}`] : null
          return (
            <label
              key={tipo}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-xs ${
                hecho ? "border-[#1E7B3A] bg-[#F3FAF5]" : "border-dashed border-[#C9C5BA] bg-white hover:border-[#C2560A]"
              }`}
            >
              <span className="text-sm font-bold text-[#142033]">
                {hecho ? "✓ " : ""}
                {titulo}
              </span>
              <span className="text-[#6B675C]">{ayuda}</span>
              {subiendo?.tipo === tipo ? (
                <span className="font-semibold text-[#C2560A]">Subiendo… {subiendo.pct}%</span>
              ) : hecho ? (
                <span className="text-[#1E7B3A]">
                  {fecha(hecho.subido)} · cambiar
                  {liga && (
                    <a href={liga} target="_blank" rel="noopener noreferrer" className="ml-1 underline" onClick={(e) => e.stopPropagation()}>
                      abrir
                    </a>
                  )}
                </span>
              ) : (
                <span className="font-semibold text-[#C2560A]">+ Subir foto</span>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={Boolean(subiendo)}
                onChange={(e) => subir(tipo, e.target.files?.[0])}
              />
            </label>
          )
        })}
      </div>
      <label className="self-start cursor-pointer text-sm font-semibold text-[#C2560A] hover:underline">
        + Agregar otra foto {extras.length > 0 ? `(${extras.length})` : ""}
        <input type="file" accept="image/*" className="sr-only" disabled={Boolean(subiendo)} onChange={(e) => subir("extra", e.target.files?.[0])} />
      </label>
      {error && <p className="m-0 rounded-xl bg-[#FDECEA] p-3 text-sm text-[#B3261E]">{error}</p>}
    </div>
  )
}
