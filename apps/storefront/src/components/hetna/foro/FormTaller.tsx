"use client"

// Perfil de taller (tipo LinkedIn) en "Editar perfil": máquinas, materiales con
// espesores y portafolio de trabajos. Pensado primero para celular Android:
// botones grandes, una sección a la vez y un "Guardar" en cada una.
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { guardarTaller } from "@/lib/foro/acciones-taller"
import {
  type Equipo,
  MATERIALES_TALLER,
  MAX_EQUIPOS,
  MAX_FOTOS_TRABAJO,
  MAX_TRABAJOS,
  MENSAJES,
  type MaterialEspesor,
  type MaterialTaller,
  TIPOS_MAQUINA,
  type TipoMaquina,
  type Trabajo,
  areaTrabajo,
  urlFoto,
} from "@/lib/foro/tipos"

import { SubirFotos } from "./SubirFotos"

const campo = "w-full min-h-[46px] border border-[#E0DCD2] rounded-[10px] px-3.5 py-2.5 text-[15px] bg-white focus:outline-none focus:border-[#C2560A]"
const etiqueta = "text-[13.5px] font-bold text-[#1B1B18]"
const botonGrande = "min-h-[48px] w-full sm:w-auto rounded-[10px] px-5 text-[15px] font-semibold disabled:opacity-50"
const caja = "bg-white border border-[#E7E4DC] rounded-[16px] p-5 sm:p-7 flex flex-col gap-4"

// Número escrito por la persona -> número o null (vacío = sin dato)
const num = (v: string): number | null => {
  const n = Number(v.replace(/,/g, "").trim())
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null
}
const txt = (n: number | null) => (n == null ? "" : String(n))

/** Botón Guardar con su aviso de error o "Guardado". */
function Guardar({ onGuardar, pendiente, error, guardado }: { onGuardar: () => void; pendiente: boolean; error: string; guardado: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
      <button type="button" onClick={onGuardar} disabled={pendiente} className={`${botonGrande} bg-[#C2560A] hover:bg-[#A84A08] text-white`}>
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
      {guardado && !error && <span className="text-[14px] text-[#16794F]">Guardado ✓</span>}
      {error && (
        <span role="alert" className="text-[14px] text-[#A42A2A]">
          {MENSAJES[error] || error}
        </span>
      )}
    </div>
  )
}

/** Estado de guardado de cada sección. */
function useGuardar() {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState("")
  const [guardado, setGuardado] = useState(false)
  const guardar = (datos: Parameters<typeof guardarTaller>[0]) => {
    setError("")
    iniciar(async () => {
      const r = await guardarTaller(datos)
      if (!r.ok) return setError(r.error)
      setGuardado(true)
      router.refresh()
    })
  }
  return { pendiente, error, guardado, guardar, cambio: () => setGuardado(false) }
}

// ---------------------------------------------------------------------
// Máquinas
// ---------------------------------------------------------------------

const EQUIPO_NUEVO: Equipo = { tipo: "router", modelo: "", largo: null, ancho: null, alto: null, potencia: null, unidad: "W", foto: null }

function Maquinas({ inicial }: { inicial: Equipo[] }) {
  const [lista, setLista] = useState<Equipo[]>(inicial)
  const [editando, setEditando] = useState<number | null>(null)
  const g = useGuardar()
  const pon = (i: number, e: Partial<Equipo>) => {
    g.cambio()
    setLista((l) => l.map((x, j) => (j === i ? { ...x, ...e } : x)))
  }

  return (
    <section className={caja}>
      <div>
        <h2 className="m-0 text-[19px] font-bold text-[#1B1B18]">Máquinas</h2>
        <p className="m-0 mt-1 text-[13.5px] text-[#6B6A63]">Los clientes buscan por tipo de máquina y tamaño de mesa. Agrega cada una.</p>
      </div>

      {lista.map((e, i) =>
        editando === i ? (
          <div key={i} className="flex flex-col gap-3 rounded-[12px] border border-[#C2560A] bg-[#FFFBF7] p-4">
            <label className="flex flex-col gap-1.5">
              <span className={etiqueta}>Tipo de máquina</span>
              <select value={e.tipo} onChange={(ev) => pon(i, { tipo: ev.target.value as TipoMaquina })} className={campo}>
                {(Object.keys(TIPOS_MAQUINA) as TipoMaquina[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPOS_MAQUINA[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={etiqueta}>Marca y modelo (opcional)</span>
              <input value={e.modelo} onChange={(ev) => pon(i, { modelo: ev.target.value })} maxLength={80} placeholder="Ej: Router 1325 con spindle 3 kW" className={campo} />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className={etiqueta}>Área de trabajo en mm (opcional)</span>
              <div className="grid grid-cols-3 gap-2">
                {(["largo", "ancho", "alto"] as const).map((k) => (
                  <input
                    key={k}
                    inputMode="decimal"
                    value={txt(e[k])}
                    onChange={(ev) => pon(i, { [k]: num(ev.target.value) })}
                    placeholder={k === "largo" ? "Largo" : k === "ancho" ? "Ancho" : "Alto"}
                    aria-label={`${k} en mm`}
                    className={campo}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={etiqueta}>Potencia (opcional)</span>
              <div className="flex gap-2">
                <input inputMode="decimal" value={txt(e.potencia)} onChange={(ev) => pon(i, { potencia: num(ev.target.value) })} placeholder="Ej: 100" className={campo} />
                {(["W", "A"] as const).map((u) => (
                  <button
                    type="button"
                    key={u}
                    aria-pressed={e.unidad === u}
                    onClick={() => pon(i, { unidad: u })}
                    className={`min-h-[46px] min-w-[56px] rounded-[10px] border text-[15px] font-bold ${e.unidad === u ? "border-[#142033] bg-[#142033] text-white" : "border-[#E0DCD2] bg-white text-[#44433D]"}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <span className="text-[12px] text-[#6B6A63]">W para láser y spindle; A (amperes) para plasma.</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={etiqueta}>Foto de la máquina (opcional)</span>
              <SubirFotos
                fotos={e.foto ? [{ id: e.foto, url: urlFoto(e.foto) }] : []}
                onCambio={(f) => pon(i, { foto: f.slice(-1)[0]?.id ?? null })}
                max={1}
                etiqueta="Foto"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={() => setEditando(null)} className={`${botonGrande} border border-[#142033] text-[#142033] bg-white`}>
                Listo
              </button>
              <button
                type="button"
                onClick={() => { g.cambio(); setLista((l) => l.filter((_, j) => j !== i)); setEditando(null) }}
                className={`${botonGrande} text-[#A42A2A] bg-white border border-[#E0DCD2]`}
              >
                Quitar máquina
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            key={i}
            onClick={() => setEditando(i)}
            className="flex items-center gap-3 rounded-[12px] border border-[#E7E4DC] bg-white p-3 text-left hover:border-[#C2560A]"
          >
            {e.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlFoto(e.foto)} alt="" className="h-14 w-14 shrink-0 rounded-[10px] object-cover bg-[#F1EFEA]" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] bg-[#F1EFEA] text-[24px]">⚙️</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-[#1B1B18]">{TIPOS_MAQUINA[e.tipo]}</span>
              <span className="block text-[13px] text-[#6B6A63] truncate">
                {[e.modelo, areaTrabajo(e), e.potencia ? `${e.potencia} ${e.unidad}` : ""].filter(Boolean).join(" · ") || "Toca para agregar datos"}
              </span>
            </span>
            <span className="text-[13px] font-semibold text-[#B34D07]">Editar</span>
          </button>
        )
      )}

      {lista.length < MAX_EQUIPOS && (
        <button
          type="button"
          onClick={() => { g.cambio(); setLista((l) => [...l, { ...EQUIPO_NUEVO }]); setEditando(lista.length) }}
          className={`${botonGrande} border-2 border-dashed border-[#D9D4C8] text-[#44433D] bg-white hover:border-[#C2560A]`}
        >
          + Agregar máquina
        </button>
      )}
      <Guardar onGuardar={() => { setEditando(null); g.guardar({ equipos: lista }) }} pendiente={g.pendiente} error={g.error} guardado={g.guardado} />
    </section>
  )
}

// ---------------------------------------------------------------------
// Materiales y espesores
// ---------------------------------------------------------------------

function Materiales({ inicial }: { inicial: MaterialEspesor[] }) {
  const [lista, setLista] = useState<MaterialEspesor[]>(inicial)
  const g = useGuardar()
  const alternar = (m: MaterialTaller) => {
    g.cambio()
    setLista((l) => (l.some((x) => x.material === m) ? l.filter((x) => x.material !== m) : [...l, { material: m, min: null, max: null }]))
  }
  const pon = (m: MaterialTaller, e: Partial<MaterialEspesor>) => {
    g.cambio()
    setLista((l) => l.map((x) => (x.material === m ? { ...x, ...e } : x)))
  }

  return (
    <section className={caja}>
      <div>
        <h2 className="m-0 text-[19px] font-bold text-[#1B1B18]">Materiales y espesores</h2>
        <p className="m-0 mt-1 text-[13.5px] text-[#6B6A63]">Toca los materiales que trabajas y pon el espesor mínimo y máximo que cortas.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MATERIALES_TALLER) as MaterialTaller[]).map((m) => {
          const sel = lista.some((x) => x.material === m)
          return (
            <button
              type="button"
              key={m}
              aria-pressed={sel}
              onClick={() => alternar(m)}
              className={`min-h-[44px] rounded-full border px-4 text-[14.5px] font-semibold ${sel ? "border-[#C2560A] bg-[#FDEEE1] text-[#B34D07]" : "border-[#E0DCD2] bg-white text-[#44433D]"}`}
            >
              {sel ? "✓ " : ""}
              {MATERIALES_TALLER[m]}
            </button>
          )
        })}
      </div>
      {lista.length > 0 && (
        <div className="flex flex-col gap-2">
          {lista.map((x) => (
            <div key={x.material} className="grid grid-cols-[1fr_88px_88px] items-center gap-2">
              <span className="text-[14.5px] font-semibold text-[#1B1B18]">{MATERIALES_TALLER[x.material]}</span>
              <input inputMode="decimal" value={txt(x.min)} onChange={(e) => pon(x.material, { min: num(e.target.value) })} placeholder="Mín mm" aria-label={`Espesor mínimo de ${MATERIALES_TALLER[x.material]} en mm`} className={campo} />
              <input inputMode="decimal" value={txt(x.max)} onChange={(e) => pon(x.material, { max: num(e.target.value) })} placeholder="Máx mm" aria-label={`Espesor máximo de ${MATERIALES_TALLER[x.material]} en mm`} className={campo} />
            </div>
          ))}
        </div>
      )}
      <Guardar onGuardar={() => g.guardar({ materiales: lista })} pendiente={g.pendiente} error={g.error} guardado={g.guardado} />
    </section>
  )
}

// ---------------------------------------------------------------------
// Portafolio
// ---------------------------------------------------------------------

const nuevoId = () => Math.random().toString(36).slice(2, 12)

function Portafolio({ inicial }: { inicial: Trabajo[] }) {
  const [lista, setLista] = useState<Trabajo[]>(inicial)
  const [editando, setEditando] = useState<string | null>(null)
  const g = useGuardar()
  const pon = (id: string, e: Partial<Trabajo>) => {
    g.cambio()
    setLista((l) => l.map((x) => (x.id === id ? { ...x, ...e } : x)))
  }

  return (
    <section className={caja}>
      <div>
        <h2 className="m-0 text-[19px] font-bold text-[#1B1B18]">Portafolio de trabajos</h2>
        <p className="m-0 mt-1 text-[13.5px] text-[#6B6A63]">
          Tus mejores piezas, de 1 a {MAX_FOTOS_TRABAJO} fotos cada una (hasta {MAX_TRABAJOS} trabajos). Es lo primero que ve un cliente.
        </p>
      </div>

      {lista.map((t) =>
        editando === t.id ? (
          <div key={t.id} className="flex flex-col gap-3 rounded-[12px] border border-[#C2560A] bg-[#FFFBF7] p-4">
            <div className="flex flex-col gap-1.5">
              <span className={etiqueta}>Fotos (1 a {MAX_FOTOS_TRABAJO})</span>
              <SubirFotos
                fotos={t.fotos.map((id) => ({ id, url: urlFoto(id) }))}
                onCambio={(f) => pon(t.id, { fotos: f.map((x) => x.id).slice(0, MAX_FOTOS_TRABAJO) })}
                max={MAX_FOTOS_TRABAJO}
                etiqueta="Agregar"
              />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={etiqueta}>Título</span>
              <input value={t.titulo} onChange={(e) => pon(t.id, { titulo: e.target.value })} maxLength={100} placeholder="Ej: Letrero de acrílico con luz LED" className={campo} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5">
                <span className={etiqueta}>Material</span>
                <select value={t.material} onChange={(e) => pon(t.id, { material: e.target.value as MaterialTaller | "" })} className={campo}>
                  <option value="">Elige…</option>
                  {(Object.keys(MATERIALES_TALLER) as MaterialTaller[]).map((m) => (
                    <option key={m} value={m}>
                      {MATERIALES_TALLER[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={etiqueta}>Espesor (mm)</span>
                <input inputMode="decimal" value={txt(t.espesor)} onChange={(e) => pon(t.id, { espesor: num(e.target.value) })} placeholder="Ej: 6" className={campo} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={etiqueta}>Máquina</span>
              <select value={t.maquina} onChange={(e) => pon(t.id, { maquina: e.target.value as TipoMaquina | "" })} className={campo}>
                <option value="">Elige…</option>
                {(Object.keys(TIPOS_MAQUINA) as TipoMaquina[]).map((m) => (
                  <option key={m} value={m}>
                    {TIPOS_MAQUINA[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={etiqueta}>Cuéntalo en pocas palabras (opcional)</span>
              <textarea
                value={t.detalle}
                onChange={(e) => pon(t.id, { detalle: e.target.value })}
                maxLength={500}
                rows={3}
                placeholder="Qué pidió el cliente, cuántas piezas, qué acabado llevó…"
                className={`${campo} resize-y`}
              />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={() => setEditando(null)} className={`${botonGrande} border border-[#142033] text-[#142033] bg-white`}>
                Listo
              </button>
              <button
                type="button"
                onClick={() => { g.cambio(); setLista((l) => l.filter((x) => x.id !== t.id)); setEditando(null) }}
                className={`${botonGrande} text-[#A42A2A] bg-white border border-[#E0DCD2]`}
              >
                Quitar trabajo
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            key={t.id}
            onClick={() => setEditando(t.id)}
            className="flex items-center gap-3 rounded-[12px] border border-[#E7E4DC] bg-white p-3 text-left hover:border-[#C2560A]"
          >
            {t.fotos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlFoto(t.fotos[0])} alt="" className="h-14 w-14 shrink-0 rounded-[10px] object-cover bg-[#F1EFEA]" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] bg-[#F1EFEA] text-[20px]">📷</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-[#1B1B18] truncate">{t.titulo || "Trabajo sin título"}</span>
              <span className="block text-[13px] text-[#6B6A63] truncate">
                {[t.material ? MATERIALES_TALLER[t.material] : "", t.espesor ? `${t.espesor} mm` : "", `${t.fotos.length} foto${t.fotos.length === 1 ? "" : "s"}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="text-[13px] font-semibold text-[#B34D07]">Editar</span>
          </button>
        )
      )}

      {lista.length < MAX_TRABAJOS && (
        <button
          type="button"
          onClick={() => {
            g.cambio()
            const id = nuevoId()
            setLista((l) => [...l, { id, titulo: "", material: "", espesor: null, maquina: "", detalle: "", fotos: [] }])
            setEditando(id)
          }}
          className={`${botonGrande} border-2 border-dashed border-[#D9D4C8] text-[#44433D] bg-white hover:border-[#C2560A]`}
        >
          + Agregar trabajo
        </button>
      )}
      <Guardar onGuardar={() => { setEditando(null); g.guardar({ portafolio: lista }) }} pendiente={g.pendiente} error={g.error} guardado={g.guardado} />
    </section>
  )
}

export function FormTaller({ equipos, materiales, portafolio }: { equipos: Equipo[]; materiales: MaterialEspesor[]; portafolio: Trabajo[] }) {
  return (
    <div className="flex flex-col gap-5">
      <Maquinas inicial={equipos} />
      <Materiales inicial={materiales} />
      <Portafolio inicial={portafolio} />
    </div>
  )
}
