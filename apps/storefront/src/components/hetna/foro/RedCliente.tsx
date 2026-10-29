"use client"

// Botones y formularios de la red: seguir, avalar, recomendar, postularse y
// editar el currículum. Todo pasa por acciones-red (el servidor decide).
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { avalar, decidirRecomendacion, guardarRed, postularme, recomendar, seguir } from "@/lib/foro/acciones-red"
import {
  type Aval,
  MAX_APTITUDES,
  MAX_PASOS,
  MENSAJES,
  type Paso,
  RELACIONES,
  type Relacion,
  TIPOS_TRAYECTORIA,
  type TipoTrayectoria,
} from "@/lib/foro/tipos"

import { PideCuenta } from "./Interaccion"

const mensaje = (e: string) => MENSAJES[e] || e
const BTN = "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition disabled:opacity-60"
const CAMPO = "w-full rounded-[10px] border border-[#E0DCD2] bg-white px-3 py-2.5 text-[14.5px] text-[#1B1B18] focus:border-[#C2560A] focus:outline-none"

// ---------------------------------------------------------------------
// Seguir
// ---------------------------------------------------------------------

export function BotonSeguir({
  objetivo,
  siguiendo,
  seguidores,
  etiqueta = "Seguir",
  conCuenta = true,
  chico = false,
  oscuro = false,
}: {
  objetivo: string
  siguiendo: boolean
  seguidores: number
  etiqueta?: string
  conCuenta?: boolean
  chico?: boolean
  oscuro?: boolean
}) {
  const [estado, setEstado] = useState({ siguiendo, seguidores })
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()
  const clic = () => {
    setError("")
    const antes = estado
    const quiere = !antes.siguiendo
    setEstado({ siguiendo: quiere, seguidores: Math.max(0, antes.seguidores + (quiere ? 1 : -1)) })
    iniciar(async () => {
      const r = await seguir(objetivo, quiere)
      if (r.ok) setEstado({ siguiendo: r.siguiendo, seguidores: r.seguidores })
      else {
        setEstado(antes)
        setError(r.error)
      }
    })
  }
  const tam = chico ? "px-3 py-1 text-[13px]" : "px-4 py-2 text-[14px]"
  const color = estado.siguiendo
    ? oscuro
      ? "border border-white/40 bg-white/10 text-white hover:bg-white/20"
      : "border border-[#C9C4B8] bg-white text-[#44433D] hover:border-[#A42A2A] hover:text-[#A42A2A]"
    : "border border-[#C2560A] bg-[#C2560A] text-white hover:bg-[#A84A08]"
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={clic} disabled={pendiente} aria-pressed={estado.siguiendo} className={`${BTN} ${tam} ${color}`}>
          {estado.siguiendo ? "✓ Siguiendo" : `+ ${etiqueta}`}
        </button>
        {conCuenta && (
          <span className={`text-[13px] ${oscuro ? "text-white/80" : "text-[#6B6A63]"}`}>
            {estado.seguidores === 1 ? "1 seguidor" : `${estado.seguidores} seguidores`}
          </span>
        )}
      </div>
      {error && <PideCuenta error={error} onCerrar={() => setError("")} />}
    </div>
  )
}

// ---------------------------------------------------------------------
// Aptitudes con avales
// ---------------------------------------------------------------------

export function Aptitudes({ perfilId, avales, puedeAvalar }: { perfilId: string; avales: Aval[]; puedeAvalar: boolean }) {
  const [lista, setLista] = useState(avales)
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()
  const clic = (a: Aval) => {
    setError("")
    iniciar(async () => {
      const r = await avalar(perfilId, a.aptitud, !a.yo)
      if (r.ok) setLista((l) => l.map((x) => (x.aptitud === a.aptitud ? { ...x, n: r.n, yo: r.yo } : x)))
      else setError(r.error)
    })
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {lista.map((a) => (
          <li key={a.aptitud} className="flex items-center gap-1 rounded-full border border-[#E7E4DC] bg-[#FAF9F6] py-1 pl-3 pr-1 text-[13.5px]">
            <span className="font-semibold text-[#1B1B18]">{a.aptitud}</span>
            {a.n > 0 && <span className="text-[12.5px] text-[#6B6A63]" title="Personas que avalan esta aptitud">· {a.n}</span>}
            {puedeAvalar ? (
              <button
                type="button"
                onClick={() => clic(a)}
                disabled={pendiente}
                aria-pressed={a.yo}
                title={a.yo ? "Quitar mi aval" : "Avalar: sí sabe hacer esto"}
                className={`ml-1 rounded-full px-2 py-0.5 text-[12px] font-bold ${
                  a.yo ? "bg-[#16794F] text-white" : "bg-white text-[#16794F] ring-1 ring-[#BFE0CC] hover:bg-[#EAF6EF]"
                }`}
              >
                {a.yo ? "✓ Avalado" : "+ Avalar"}
              </button>
            ) : (
              <span className="w-1" />
            )}
          </li>
        ))}
      </ul>
      {error && <PideCuenta error={error} onCerrar={() => setError("")} />}
    </div>
  )
}

// ---------------------------------------------------------------------
// Recomendaciones
// ---------------------------------------------------------------------

export function FormRecomendar({
  perfilId,
  nombre,
  previa,
}: {
  perfilId: string
  nombre: string
  previa?: { relacion: string; texto: string; estado: string } | null
}) {
  const [abierto, setAbierto] = useState(false)
  const [relacion, setRelacion] = useState<Relacion>((previa?.relacion as Relacion) || "cliente")
  const [cuerpo, setCuerpo] = useState(previa?.texto || "")
  const [error, setError] = useState("")
  const [listo, setListo] = useState(false)
  const [pendiente, iniciar] = useTransition()

  if (listo)
    return (
      <p className="m-0 rounded-[12px] bg-[#EAF6EF] px-4 py-3 text-[14px] text-[#14683F]">
        Gracias. {nombre} verá tu recomendación y saldrá en su perfil cuando la acepte.
      </p>
    )
  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`${BTN} self-start border border-[#E0DCD2] bg-white px-4 py-2 text-[14px] text-[#44433D] hover:border-[#C2560A]`}
      >
        {previa ? "Editar mi recomendación" : `Recomendar a ${nombre}`}
      </button>
    )
  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    iniciar(async () => {
      const r = await recomendar(perfilId, relacion, cuerpo)
      if (r.ok) setListo(true)
      else setError(r.error)
    })
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 rounded-[14px] border border-[#E7E4DC] bg-[#FAF9F6] p-4">
      <label className="flex flex-col gap-1 text-[13.5px] font-semibold text-[#44433D]">
        ¿De dónde se conocen?
        <select value={relacion} onChange={(e) => setRelacion(e.target.value as Relacion)} className={CAMPO}>
          {(Object.keys(RELACIONES) as Relacion[]).map((r) => (
            <option key={r} value={r}>
              {RELACIONES[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13.5px] font-semibold text-[#44433D]">
        Tu recomendación
        <textarea
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          rows={4}
          maxLength={1500}
          placeholder="Qué trabajo hizo, cómo quedó, si cumplió en tiempo y por qué lo recomiendas."
          className={CAMPO}
        />
        <span className="font-normal text-[12.5px] text-[#9A978C]">{cuerpo.trim().length}/1500 · mínimo 30 letras</span>
      </label>
      {error && <PideCuenta error={error} />}
      <div className="flex gap-2">
        <button type="submit" disabled={pendiente} className={`${BTN} bg-[#C2560A] px-4 py-2 text-[14px] text-white hover:bg-[#A84A08]`}>
          {pendiente ? "Enviando…" : "Enviar recomendación"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="px-3 text-[14px] font-semibold text-[#6B6A63]">
          Cancelar
        </button>
      </div>
    </form>
  )
}

export function DecidirRecomendacion({ id }: { id: number }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()
  const decidir = (estado: "publicada" | "oculta") =>
    iniciar(async () => {
      const r = await decidirRecomendacion(id, estado)
      if (r.ok) router.refresh()
      else setError(r.error)
    })
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pendiente} onClick={() => decidir("publicada")} className={`${BTN} bg-[#16794F] px-3 py-1 text-[13px] text-white`}>
        Mostrar en mi perfil
      </button>
      <button type="button" disabled={pendiente} onClick={() => decidir("oculta")} className={`${BTN} border border-[#E0DCD2] bg-white px-3 py-1 text-[13px] text-[#44433D]`}>
        No mostrar
      </button>
      {error && <span className="text-[13px] text-[#A42A2A]">{mensaje(error)}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------
// Postularse a una vacante
// ---------------------------------------------------------------------

export function Postularme({ temaId, yaPostulado }: { temaId: number; yaPostulado: boolean }) {
  const [hecho, setHecho] = useState(yaPostulado)
  const [abierto, setAbierto] = useState(false)
  const [m, setM] = useState("")
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()
  if (hecho)
    return (
      <p className="m-0 rounded-[12px] bg-[#EAF6EF] px-4 py-3 text-[14px] font-semibold text-[#14683F]">
        ✓ Ya te postulaste. Quien publicó la vacante ve tu mensaje y tu perfil.
      </p>
    )
  if (!abierto)
    return (
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setAbierto(true)} className={`${BTN} self-start bg-[#3B46A6] px-5 py-2.5 text-[14.5px] text-white hover:brightness-110`}>
          Postularme a esta vacante
        </button>
        {error && <PideCuenta error={error} />}
      </div>
    )
  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    iniciar(async () => {
      const r = await postularme(temaId, m)
      if (r.ok || r.error === "ya_postulado") setHecho(true)
      else setError(r.error)
    })
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[13.5px] font-semibold text-[#44433D]">
        Tu mensaje (sólo lo ve quien publicó la vacante)
        <textarea
          value={m}
          onChange={(e) => setM(e.target.value)}
          rows={4}
          maxLength={1500}
          placeholder="Qué máquinas y programas manejas, años de experiencia, en qué ciudad estás y cómo contactarte."
          className={CAMPO}
        />
      </label>
      <p className="m-0 text-[12.5px] text-[#6B6A63]">Junto con tu mensaje se manda la liga a tu perfil: complétalo con tu trayectoria y aptitudes.</p>
      {error && <PideCuenta error={error} />}
      <div className="flex gap-2">
        <button type="submit" disabled={pendiente} className={`${BTN} bg-[#3B46A6] px-4 py-2 text-[14px] text-white`}>
          {pendiente ? "Enviando…" : "Enviar postulación"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="px-3 text-[14px] font-semibold text-[#6B6A63]">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Editor del currículum (en "Editar perfil")
// ---------------------------------------------------------------------

const SUGERIDAS = [
  "Programación CAM", "Vectric Aspire", "Fusion 360", "LightBurn", "Diseño 2D", "Modelado 3D", "Router CNC",
  "Corte láser", "Plasma CNC", "Torno CNC", "Fresadora CNC", "G-code", "Mantenimiento", "Electrónica CNC", "Cotización",
]

const pasoVacio = (tipo: TipoTrayectoria = "experiencia"): Paso => ({ tipo, titulo: "", lugar: "", desde: "", hasta: "", detalle: "" })

export function FormRed({ inicial }: { inicial: { aptitudes: string[]; trayectoria: Paso[]; abierto: boolean; titular: string } }) {
  const router = useRouter()
  const [titular, setTitular] = useState(inicial.titular)
  const [aptitudes, setAptitudes] = useState(inicial.aptitudes)
  const [nueva, setNueva] = useState("")
  const [pasos, setPasos] = useState<Paso[]>(inicial.trayectoria)
  const [abierto, setAbierto] = useState(inicial.abierto)
  const [error, setError] = useState("")
  const [guardado, setGuardado] = useState(false)
  const [pendiente, iniciar] = useTransition()

  const tocar = () => setGuardado(false)
  const agregarAptitud = (v: string) => {
    const a = v.trim().replace(/\s+/g, " ").slice(0, 40)
    if (a.length < 2 || aptitudes.length >= MAX_APTITUDES || aptitudes.some((x) => x.toLowerCase() === a.toLowerCase())) return
    setAptitudes([...aptitudes, a])
    setNueva("")
    tocar()
  }
  const cambiaPaso = (i: number, k: keyof Paso, v: string) => {
    setPasos((l) => l.map((p, j) => (j === i ? { ...p, [k]: v } : p)))
    tocar()
  }
  const guardar = () => {
    setError("")
    iniciar(async () => {
      const r = await guardarRed({ aptitudes, trayectoria: pasos.filter((p) => p.titulo.trim()), abierto, titular })
      if (r.ok) {
        setGuardado(true)
        router.refresh()
      } else setError(r.error)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="m-0 text-[19px] font-bold text-[#1B1B18]">Tu currículum en la red</h2>
        <p className="m-0 mt-1 text-[14px] text-[#6B6A63]">
          Lo que sabes hacer y lo que has hecho. Sale en tu perfil público; los demás pueden avalar tus aptitudes y escribirte recomendaciones.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[15.5px] font-bold text-[#1B1B18]">Tu titular</span>
        <input
          value={titular}
          onChange={(e) => {
            setTitular(e.target.value)
            tocar()
          }}
          maxLength={100}
          placeholder="Ej. Programador CAM · 8 años en router y láser"
          className={CAMPO}
        />
        <span className="text-[12.5px] text-[#6B6A63]">Sale junto a tu nombre en cada respuesta: así saben por qué sabes del tema.</span>
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-[#E7E4DC] bg-[#FAF9F6] p-4">
        <input
          type="checkbox"
          checked={abierto}
          onChange={(e) => {
            setAbierto(e.target.checked)
            tocar()
          }}
          className="mt-1 h-4 w-4 accent-[#16794F]"
        />
        <span>
          <strong className="block text-[14.5px] text-[#1B1B18]">Abierto a trabajo y proyectos</strong>
          <span className="text-[13.5px] text-[#6B6A63]">Sales en “Empleos y proyectos” para que los talleres te encuentren.</span>
        </span>
      </label>

      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-[15.5px] font-bold text-[#1B1B18]">
          Aptitudes <span className="font-normal text-[13px] text-[#9A978C]">({aptitudes.length}/{MAX_APTITUDES})</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {aptitudes.map((a) => (
            <span key={a} className="inline-flex items-center gap-1 rounded-full bg-[#F4F1EA] py-1 pl-3 pr-1.5 text-[13.5px]">
              {a}
              <button
                type="button"
                aria-label={`Quitar ${a}`}
                onClick={() => {
                  setAptitudes(aptitudes.filter((x) => x !== a))
                  tocar()
                }}
                className="px-1 text-[#9A978C] hover:text-[#A42A2A]"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                agregarAptitud(nueva)
              }
            }}
            maxLength={40}
            placeholder="Ej. Programación CAM, Corte láser, Soldadura"
            className={CAMPO}
          />
          <button type="button" onClick={() => agregarAptitud(nueva)} className={`${BTN} shrink-0 border border-[#E0DCD2] bg-white px-4 text-[14px] text-[#44433D]`}>
            Agregar
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGERIDAS.filter((s) => !aptitudes.includes(s))
            .slice(0, 10)
            .map((s) => (
              <button key={s} type="button" onClick={() => agregarAptitud(s)} className="rounded-full border border-dashed border-[#D9D4C8] px-2.5 py-1 text-[12.5px] text-[#6B6A63] hover:border-[#C2560A] hover:text-[#B34D07]">
                + {s}
              </button>
            ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="m-0 text-[15.5px] font-bold text-[#1B1B18]">
          Trayectoria <span className="font-normal text-[13px] text-[#9A978C]">experiencia, estudios, certificaciones y proyectos</span>
        </h3>
        {pasos.map((p, i) => (
          <div key={i} className="grid gap-2 rounded-[12px] border border-[#E7E4DC] p-3 sm:grid-cols-2">
            <select value={p.tipo} onChange={(e) => cambiaPaso(i, "tipo", e.target.value)} className={CAMPO} aria-label="Tipo">
              {(Object.keys(TIPOS_TRAYECTORIA) as TipoTrayectoria[]).map((t) => (
                <option key={t} value={t}>
                  {TIPOS_TRAYECTORIA[t]}
                </option>
              ))}
            </select>
            <input value={p.titulo} onChange={(e) => cambiaPaso(i, "titulo", e.target.value)} maxLength={100} placeholder="Puesto, carrera, curso o proyecto" className={CAMPO} />
            <input value={p.lugar} onChange={(e) => cambiaPaso(i, "lugar", e.target.value)} maxLength={100} placeholder="Taller, empresa, escuela o cliente" className={CAMPO} />
            <div className="flex gap-2">
              <input value={p.desde} onChange={(e) => cambiaPaso(i, "desde", e.target.value)} maxLength={20} placeholder="Desde (2019)" className={CAMPO} />
              <input value={p.hasta} onChange={(e) => cambiaPaso(i, "hasta", e.target.value)} maxLength={20} placeholder="Hasta (Actual)" className={CAMPO} />
            </div>
            <textarea
              value={p.detalle}
              onChange={(e) => cambiaPaso(i, "detalle", e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Qué hacías, con qué máquinas, logros"
              className={`${CAMPO} sm:col-span-2`}
            />
            <button
              type="button"
              onClick={() => {
                setPasos(pasos.filter((_, j) => j !== i))
                tocar()
              }}
              className="justify-self-start text-[13px] font-semibold text-[#A42A2A]"
            >
              Quitar
            </button>
          </div>
        ))}
        {pasos.length < MAX_PASOS && (
          <button
            type="button"
            onClick={() => {
              setPasos([...pasos, pasoVacio(pasos.length ? "experiencia" : "experiencia")])
              tocar()
            }}
            className={`${BTN} self-start border border-dashed border-[#C9C4B8] bg-white px-4 py-2 text-[14px] text-[#44433D] hover:border-[#C2560A]`}
          >
            + Agregar a mi trayectoria
          </button>
        )}
      </section>

      {error && <PideCuenta error={error} onCerrar={() => setError("")} />}
      <div className="flex items-center gap-3">
        <button type="button" onClick={guardar} disabled={pendiente} className={`${BTN} rounded-[10px] bg-[#C2560A] px-5 py-3 text-[14.5px] text-white hover:bg-[#A84A08]`}>
          {pendiente ? "Guardando…" : "Guardar currículum"}
        </button>
        {guardado && <span className="text-[14px] font-semibold text-[#16794F]">✓ Guardado</span>}
      </div>
    </div>
  )
}
