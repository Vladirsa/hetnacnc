"use client"

// Biblioteca de herrajes: escoger el herraje de la unión, ajustar sus medidas
// (barrenos, borde, separación, sistema 32, capas, precio) o crear uno nuevo.
// Los del cliente se guardan en su navegador.
import { T } from "@/components/hetna/i18n/Idioma"
import { useEffect, useState } from "react"

import { type Agujero, type DefHerraje, HERRAJES_BASE } from "@/lib/generador/herrajes"

const CLAVE = "hetna-herrajes"

export function useHerrajes() {
  const [mios, setMios] = useState<DefHerraje[]>([])
  useEffect(() => {
    try {
      const x = JSON.parse(localStorage.getItem(CLAVE) || "[]")
      if (Array.isArray(x)) setMios(x.filter((h) => h && typeof h.id === "string" && typeof h.nombre === "string"))
    } catch {
      // sin biblioteca guardada
    }
  }, [])
  const guardar = (lista: DefHerraje[]) => {
    setMios(lista)
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, 60)))
    } catch {
      // navegador sin espacio: queda sólo en esta visita
    }
  }
  const todos = [...mios, ...HERRAJES_BASE.filter((b) => !mios.some((m) => m.id === b.id))]
  return {
    todos,
    esMio: (id: string) => mios.some((m) => m.id === id),
    poner: (h: DefHerraje) => guardar([h, ...mios.filter((m) => m.id !== h.id)]),
    quitar: (id: string) => guardar(mios.filter((m) => m.id !== id)),
  }
}

const num = (s: string) => Number(String(s).replace(",", "."))
const inp = "w-full rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-[12px] text-white"

function Campo({ e, v, c, ancho = "w-16" }: { e: string; v: number | string | undefined; c: (x: string) => void; ancho?: string }) {
  return (
    <label className={`flex ${ancho} flex-col gap-0.5 text-[11px] text-[#8A97AB]`}>
      {e}
      <input value={v ?? ""} onChange={(x) => c(x.target.value)} inputMode="decimal" className={inp} />
    </label>
  )
}

// un barreno: activo o no, diámetro, profundidad (0 = pasado) y capa
function FilaAgujero({ titulo, a, cambiar, extra }: { titulo: string; a?: Agujero; cambiar: (a?: Agujero) => void; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-1.5 rounded-[7px] bg-[#0F151E] p-1.5">
      <label className="flex w-full items-center gap-1.5 text-[12px] font-semibold text-white">
        <input type="checkbox" checked={!!a} onChange={(x) => cambiar(x.target.checked ? { d: 8, prof: 12 } : undefined)} className="h-3.5 w-3.5 accent-[#C2560A]" />
        <T>{titulo}</T>
      </label>
      {a && (
        <>
          <Campo e="Ø mm" v={a.d} c={(x) => cambiar({ ...a, d: num(x) || 0 })} />
          <Campo e="Prof. (0 = pasado)" v={a.prof} c={(x) => cambiar({ ...a, prof: num(x) || 0 })} ancho="w-24" />
          {extra}
          <label className="flex min-w-[6rem] flex-1 flex-col gap-0.5 text-[11px] text-[#8A97AB]">
            <T>Capa (vacío = automática)</T>
            <input value={a.capa || ""} onChange={(x) => cambiar({ ...a, capa: x.target.value.replace(/[^\w\- ]/g, "").slice(0, 30) || undefined })} className={inp} placeholder="BARRENO_8" />
          </label>
        </>
      )}
    </div>
  )
}

export function BibliotecaHerrajes({ valor, cambiar, lista }: { valor: DefHerraje; cambiar: (h: DefHerraje) => void; lista: ReturnType<typeof useHerrajes> }) {
  const { todos, esMio, poner, quitar } = lista
  const [ed, setEd] = useState<DefHerraje | null>(null)
  const [aviso, setAviso] = useState("")
  const actual = todos.find((h) => h.id === valor.id) || valor
  const set = <K extends keyof DefHerraje>(k: K, x: DefHerraje[K]) => setEd((e) => (e ? { ...e, [k]: x } : e))

  return (
    <div className="flex flex-col gap-1.5 rounded-[9px] border border-[#2A3546] bg-[#111821] p-2.5">
      <label className="flex items-center gap-2 text-[12.5px] text-[#C9D2E0]">
        <T>Herraje</T>
        <select
          value={actual.id}
          onChange={(e) => {
            const h = todos.find((x) => x.id === e.target.value)
            if (h) {
              cambiar(h)
              setEd(null)
            }
          }}
          className="min-w-0 flex-1 rounded-[7px] border border-[#2A3546] bg-[#0B0F15] px-2 py-1 text-[12.5px] text-white"
          aria-label="Herraje de la unión"
        >
          {todos.map((h) => (
            <option key={h.id} value={h.id}>
              {h.nombre}
              {esMio(h.id) ? " (mío)" : ""}
              {h.precio ? ` · $${h.precio}` : ""}
            </option>
          ))}
        </select>
      </label>
      {actual.nota && !ed && <span className="text-[11.5px] text-[#8A97AB]"><T>{actual.nota}</T></span>}
      {!ed && (
        <div className="flex gap-1.5">
          <button type="button" onClick={() => {
              setEd(structuredClone(actual))
              setAviso("")
            }} className="rounded-[6px] bg-[#1C2431] px-2 py-1 text-[12px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
            <T>Ajustar medidas</T>
          </button>
          <button
            type="button"
            onClick={() => setEd({ id: `mio-${Date.now().toString(36)}`, nombre: "Mi herraje", compra: "Mi herraje", precio: 0, borde: 50, separacion: 320, sistema32: true, minimo: 1, caraP: { d: 8, prof: 12 }, cantoQ: { d: 8, prof: 25 } })}
            className="rounded-[6px] bg-[#1C2431] px-2 py-1 text-[12px] font-semibold text-[#C9D2E0] hover:bg-[#243045]"
          >
            <T>+ Nuevo</T>
          </button>
          {esMio(actual.id) && (
            <button
              type="button"
              onClick={() => {
                quitar(actual.id)
                cambiar(HERRAJES_BASE.find((b) => b.id === actual.id) || HERRAJES_BASE[0])
              }}
              className="ml-auto rounded-[6px] px-2 py-1 text-[12px] text-[#FF9A9A] hover:bg-[#2A1515]"
            >
              {HERRAJES_BASE.some((b) => b.id === actual.id) ? "Volver a las de fábrica" : "Borrar"}
            </button>
          )}
        </div>
      )}
      {aviso && !ed && <span className="text-[11.5px] text-[#9FE0B5]">{aviso}</span>}

      {ed && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5 text-[11px] text-[#8A97AB]">
              <T>Nombre</T>
              <input value={ed.nombre} onChange={(x) => set("nombre", x.target.value.slice(0, 60))} className={inp} />
            </label>
            <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5 text-[11px] text-[#8A97AB]">
              <T>En la lista de compra</T>
              <input value={ed.compra} onChange={(x) => set("compra", x.target.value.slice(0, 80))} className={inp} />
            </label>
            <Campo e="Precio $" v={ed.precio} c={(x) => set("precio", Math.max(0, num(x) || 0))} />
          </div>
          <div className="flex flex-wrap items-end gap-1.5">
            <Campo e="Del borde" v={ed.borde} c={(x) => set("borde", num(x) || 0)} />
            <Campo e="Separación máx." v={ed.separacion} c={(x) => set("separacion", num(x) || 0)} ancho="w-24" />
            <Campo e="Mínimo por unión" v={ed.minimo} c={(x) => set("minimo", Math.max(1, Math.round(num(x) || 1)))} ancho="w-24" />
            <label className="flex items-center gap-1.5 pb-1 text-[12px] text-[#C9D2E0]">
              <input type="checkbox" checked={ed.sistema32} onChange={(x) => set("sistema32", x.target.checked)} className="h-3.5 w-3.5 accent-[#C2560A]" />
              <T>Sistema 32</T>
            </label>
          </div>
          <span className="text-[11px] text-[#8A97AB]"><T>P es el tablero que recibe; Q el que llega con su canto a la cara de P.</T></span>
          <FilaAgujero titulo="Barreno en la cara de P (D)" a={ed.caraP} cambiar={(a) => set("caraP", a)} />
          <FilaAgujero titulo="Barreno en el canto de Q (d)" a={ed.cantoQ} cambiar={(a) => set("cantoQ", a)} />
          <FilaAgujero
            titulo="Caja en la cara de Q (minifix, Rafix)"
            a={ed.caraQ}
            cambiar={(a) => set("caraQ", a ? { L: ed.caraQ?.L ?? 34, ...a } : undefined)}
            extra={ed.caraQ && <Campo e="A L mm de la orilla" v={ed.caraQ.L} c={(x) => set("caraQ", { ...ed.caraQ!, L: num(x) || 0 })} ancho="w-24" />}
          />
          <div className="flex flex-col gap-1.5 rounded-[7px] bg-[#0F151E] p-1.5">
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
              <input
                type="checkbox"
                checked={!!ed.acompanante}
                onChange={(x) => set("acompanante", x.target.checked ? { C: 32, compra: "Taquete de madera 8 × 30", precio: 0.5, caraP: { d: 8, prof: 12 }, cantoQ: { d: 8, prof: 25 } } : undefined)}
                className="h-3.5 w-3.5 accent-[#C2560A]"
              />
              <T>Acompañante (taquete a un lado)</T>
            </label>
            {ed.acompanante && (
              <>
                <div className="flex flex-wrap items-end gap-1.5">
                  <Campo e="A C mm" v={ed.acompanante.C} c={(x) => set("acompanante", { ...ed.acompanante!, C: num(x) || 0 })} />
                  <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5 text-[11px] text-[#8A97AB]">
                    <T>En la lista de compra</T>
                    <input value={ed.acompanante.compra} onChange={(x) => set("acompanante", { ...ed.acompanante!, compra: x.target.value.slice(0, 80) })} className={inp} />
                  </label>
                  <Campo e="Precio $" v={ed.acompanante.precio} c={(x) => set("acompanante", { ...ed.acompanante!, precio: Math.max(0, num(x) || 0) })} />
                </div>
                <FilaAgujero titulo="Su barreno en la cara de P" a={ed.acompanante.caraP} cambiar={(a) => set("acompanante", { ...ed.acompanante!, caraP: a })} />
                <FilaAgujero titulo="Su barreno en el canto de Q" a={ed.acompanante.cantoQ} cambiar={(a) => set("acompanante", { ...ed.acompanante!, cantoQ: a })} />
              </>
            )}
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!ed.caraP && !ed.cantoQ && !ed.caraQ) return setAviso("Ponle al menos un barreno.")
                const h = { ...ed, nombre: ed.nombre.trim() || "Mi herraje", compra: ed.compra.trim() || ed.nombre.trim() || "Mi herraje" }
                poner(h)
                cambiar(h)
                setEd(null)
                setAviso("Guardado en tu biblioteca (en este navegador).")
              }}
              className="rounded-[6px] bg-[#C2560A] px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-[#A84A08]"
            >
              <T>Guardar y usar</T>
            </button>
            <button type="button" onClick={() => setEd(null)} className="rounded-[6px] bg-[#1C2431] px-2.5 py-1 text-[12px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
              <T>Cancelar</T>
            </button>
          </div>
          {aviso && <span className="text-[11.5px] text-[#F6D58E]">{aviso}</span>}
        </div>
      )}
    </div>
  )
}
