"use client"

// Elegir una herramienta de corte de la base del cliente (la misma del CAM 2D,
// del Laboratorio 3-5 ejes y del torno). Si no tiene, se usan las de inicio.
// Se puede agregar una fresa nueva ahí mismo; se guarda en su cuenta (o en el
// navegador sin sesión) y aparece en todas las herramientas.
import { T } from "@/components/hetna/i18n/Idioma"
import { useEffect, useState } from "react"

import type { FresaCam } from "@/lib/data/cam-maquinas"
import { FRESAS_BASE, guardarBase, leerBase } from "@/lib/hetna/base-herramientas"

// fresas en pulgadas, las más comunes en México para cortar tablero
export const PULGADAS_BASE: FresaCam[] = [
  { id: "base-r635", nombre: "Recta 1/4″", tipo: "recta", diametro: 6.35, angulo: 90, zanco: 6.35, filos: 2, materialFresa: "carburo" },
  { id: "base-r3175", nombre: "Recta 1/8″", tipo: "recta", diametro: 3.175, angulo: 90, zanco: 3.175, filos: 2, materialFresa: "carburo" },
  { id: "base-c635", nombre: "Compresión 1/4″", tipo: "compresion", diametro: 6.35, angulo: 90, zanco: 6.35, filos: 2, materialFresa: "carburo" },
  { id: "base-b3175", nombre: "Bola 1/8″", tipo: "bola", diametro: 3.175, angulo: 90, zanco: 3.175, filos: 2, materialFresa: "carburo" },
]
export const BROCAS_BASE: FresaCam[] = [
  { id: "base-br5", nombre: "Broca Ø5", tipo: "broca", diametro: 5, angulo: 118 },
  { id: "base-br7", nombre: "Broca Ø7 (confirmat)", tipo: "broca", diametro: 7, angulo: 118 },
  { id: "base-br8", nombre: "Broca Ø8", tipo: "broca", diametro: 8, angulo: 118 },
  { id: "base-br15", nombre: "Forstner Ø15 (minifix)", tipo: "broca", diametro: 15, angulo: 180 },
  { id: "base-br35", nombre: "Forstner Ø35 (bisagra)", tipo: "broca", diametro: 35, angulo: 180 },
]

const NOMBRE_TIPO: Record<FresaCam["tipo"], string> = {
  recta: "Recta",
  upcut: "Espiral ascendente",
  downcut: "Espiral descendente",
  compresion: "Compresión",
  un_filo: "Un filo",
  bola: "Bola",
  v: "En V",
  planeadora: "Planeadora",
  desbaste: "Desbaste",
  toroidal: "Toroidal",
  conica_bola: "Cónica de bola",
  broca: "Broca",
}

// base del cliente + las de inicio (sin repetir), sólo de los tipos pedidos
export function useFresas() {
  const [mias, setMias] = useState<FresaCam[]>([])
  const [sesion, setSesion] = useState(false)
  useEffect(() => {
    let vivo = true
    leerBase().then((r) => {
      if (!vivo) return
      setMias(r.datos.fresas || [])
      setSesion(r.sesion)
    })
    return () => {
      vivo = false
    }
  }, [])
  const todas = [...mias, ...[...PULGADAS_BASE, ...FRESAS_BASE, ...BROCAS_BASE].filter((b) => !mias.some((m) => m.id === b.id))]
  const agregar = async (f: FresaCam) => {
    const r = await leerBase()
    const fresas = [...(r.datos.fresas || []), f].slice(0, 80)
    const aviso = await guardarBase({ ...r.datos, fresas }, r.sesion)
    setMias(fresas)
    return aviso
  }
  return { todas, sesion, agregar }
}

export function SelectorFresa({
  etiqueta,
  tipos,
  valor,
  cambiar,
  todas,
  agregar,
  nota,
}: {
  etiqueta: string
  tipos: FresaCam["tipo"][]
  valor: string | null
  cambiar: (f: FresaCam) => void
  todas: FresaCam[]
  agregar: (f: FresaCam) => Promise<string>
  nota?: string
}) {
  const [nueva, setNueva] = useState<{ abierta: boolean; tipo: FresaCam["tipo"]; d: string; ang: string; nombre: string; aviso: string }>({ abierta: false, tipo: tipos[0], d: "6", ang: "60", nombre: "", aviso: "" })
  const lista = todas.filter((f) => tipos.includes(f.tipo))
  const actual = lista.find((f) => f.id === valor) || null
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center justify-between gap-2 text-[12.5px] text-[#C9D2E0]">
        <span className="shrink-0"><T>{etiqueta}</T></span>
        <select
          value={actual?.id || ""}
          onChange={(e) => {
            const f = lista.find((x) => x.id === e.target.value)
            if (f) cambiar(f)
          }}
          className="min-w-0 flex-1 rounded-[7px] border border-[#2A3546] bg-[#0B0F15] px-2 py-1 text-[12.5px] text-white"
          aria-label={etiqueta}
        >
          {!actual && <option value="">Elige…</option>}
          {lista.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre} · {NOMBRE_TIPO[f.tipo]} Ø{f.diametro}
              {f.tipo === "v" ? ` ${f.angulo}°` : ""}
              {f.numero ? ` · T${f.numero}` : ""}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setNueva((n) => ({ ...n, abierta: !n.abierta, aviso: "" }))} className="shrink-0 rounded-[6px] bg-[#1C2431] px-2 py-1 text-[12px] font-semibold hover:bg-[#243045]" aria-label={`Agregar herramienta para ${etiqueta}`}>
          +
        </button>
      </label>
      {nota && <span className="text-[11.5px] text-[#8A97AB]"><T>{nota}</T></span>}
      {nueva.abierta && (
        <div className="flex flex-wrap items-end gap-1.5 rounded-[8px] border border-[#2A3546] bg-[#111821] p-2 text-[12px] text-[#C9D2E0]">
          <label className="flex flex-col gap-0.5">
            <T>Tipo</T>
            <select value={nueva.tipo} onChange={(e) => setNueva((n) => ({ ...n, tipo: e.target.value as FresaCam["tipo"] }))} className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-white">
              {tipos.map((t) => (
                <option key={t} value={t}>{NOMBRE_TIPO[t]}</option>
              ))}
            </select>
          </label>
          <label className="flex w-16 flex-col gap-0.5">
            <T>Ø mm</T>
            <input value={nueva.d} onChange={(e) => setNueva((n) => ({ ...n, d: e.target.value }))} inputMode="decimal" className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-white" />
          </label>
          {nueva.tipo === "v" && (
            <label className="flex w-14 flex-col gap-0.5">
              <T>Ángulo</T>
              <input value={nueva.ang} onChange={(e) => setNueva((n) => ({ ...n, ang: e.target.value }))} inputMode="decimal" className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-white" />
            </label>
          )}
          <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5">
            <T>Nombre</T>
            <input value={nueva.nombre} onChange={(e) => setNueva((n) => ({ ...n, nombre: e.target.value }))} placeholder="Mi fresa" className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-white" />
          </label>
          <button
            type="button"
            onClick={async () => {
              const d = Number(nueva.d.replace(",", "."))
              if (!(d > 0 && d < 100)) return setNueva((n) => ({ ...n, aviso: "Escribe el diámetro." }))
              const f: FresaCam = { id: `mia-${Date.now().toString(36)}`, nombre: nueva.nombre.trim() || `${NOMBRE_TIPO[nueva.tipo]} Ø${d}`, tipo: nueva.tipo, diametro: d, angulo: nueva.tipo === "v" ? Number(nueva.ang) || 60 : 90 }
              const aviso = await agregar(f)
              cambiar(f)
              setNueva((n) => ({ ...n, abierta: false, aviso }))
            }}
            className="rounded-[6px] bg-[#C2560A] px-2.5 py-1 font-semibold text-white hover:bg-[#A84A08]"
          >
            <T>Guardar</T>
          </button>
          {nueva.aviso && <span className="w-full text-[#F6D58E]"><T>{nueva.aviso}</T></span>}
        </div>
      )}
      {!nueva.abierta && nueva.aviso && <span className="text-[11.5px] text-[#9FE0B5]"><T>{nueva.aviso}</T></span>}
    </div>
  )
}
