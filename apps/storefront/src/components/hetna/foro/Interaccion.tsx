"use client"

// Botones del foro: votar, encuesta, mejor respuesta, compartir, reportar y ocultar
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { cambiarEstado, marcarMejor, reportar, votar, votarEncuesta } from "@/lib/foro/acciones"
import { MENSAJES } from "@/lib/foro/tipos"

const mensaje = (e: string) => MENSAJES[e] || e

// Aviso corto cuando hace falta sesión o perfil
export function PideCuenta({ error, onCerrar }: { error: string; onCerrar?: () => void }) {
  const liga = error === "sin_sesion" ? "/login" : error === "sin_perfil" ? "/foro-cnc/mi-perfil" : null
  return (
    <div role="alert" className="text-[13px] bg-[#FFF6E8] border border-[#F2C98F] text-[#5A3A12] rounded-[10px] px-3 py-2 flex items-center gap-2 flex-wrap">
      <span>{mensaje(error)}</span>
      {liga && (
        <LocalizedClientLink href={liga} className="font-semibold text-[#B34D07] underline">
          {error === "sin_sesion" ? "Entrar" : "Crear perfil"}
        </LocalizedClientLink>
      )}
      {onCerrar && (
        <button type="button" onClick={onCerrar} className="ml-auto text-[#9A978C] hover:text-[#1B1B18]" aria-label="Cerrar">
          ×
        </button>
      )}
    </div>
  )
}

export function BotonVoto({ temaId, respuestaId, votos, votado, propio }: { temaId?: number; respuestaId?: number; votos: number; votado: boolean; propio?: boolean }) {
  const [estado, setEstado] = useState({ votos, votado })
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()
  const clic = () => {
    setError("")
    const antes = estado
    setEstado({ votado: !antes.votado, votos: antes.votos + (antes.votado ? -1 : 1) })
    iniciar(async () => {
      const r = await votar({ temaId, respuestaId })
      if (r.ok) setEstado({ votado: r.votado, votos: r.votos })
      else {
        setEstado(antes)
        setError(r.error)
      }
    })
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={clic}
        disabled={pendiente || propio}
        aria-pressed={estado.votado}
        title={propio ? "No puedes votar lo tuyo" : "Me sirvió"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13.5px] font-semibold transition ${
          estado.votado ? "bg-[#C2560A] border-[#C2560A] text-white" : "bg-white border-[#E0DCD2] text-[#44433D] hover:border-[#C2560A]"
        } disabled:opacity-60`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        Útil · {estado.votos}
      </button>
      {error && <PideCuenta error={error} onCerrar={() => setError("")} />}
    </div>
  )
}

export function EncuestaVotar({ temaId, pregunta, opciones, resultados, elegida, sesion }: { temaId: number; pregunta: string; opciones: string[]; resultados: number[]; elegida: number | null; sesion: boolean }) {
  const [res, setRes] = useState(resultados)
  const [mia, setMia] = useState(elegida)
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()
  const total = res.reduce((a, b) => a + b, 0)
  const verResultados = mia !== null || !sesion
  const elegir = (i: number) => {
    setError("")
    iniciar(async () => {
      const r = await votarEncuesta(temaId, i)
      if (r.ok) {
        setRes(r.resultados)
        setMia(i)
      } else setError(r.error)
    })
  }
  return (
    <div className="border border-[#E7E4DC] rounded-[12px] p-4 flex flex-col gap-3 bg-[#FCFBF8]">
      <p className="m-0 font-bold text-[15px] text-[#1B1B18]">{pregunta}</p>
      <div className="flex flex-col gap-2">
        {opciones.map((o, i) => {
          const pct = total ? Math.round((res[i] / total) * 100) : 0
          return verResultados ? (
            <button
              type="button"
              key={i}
              onClick={() => sesion && elegir(i)}
              disabled={pendiente || !sesion}
              className="relative text-left rounded-[8px] border border-[#E7E4DC] bg-white overflow-hidden px-3 py-2 text-[14px] disabled:cursor-default"
            >
              <span className="absolute inset-y-0 left-0 bg-[#FDEEE1]" style={{ width: `${pct}%` }} />
              <span className="relative flex justify-between gap-3">
                <span className={mia === i ? "font-bold text-[#B34D07]" : ""}>
                  {o}
                  {mia === i ? " ✓" : ""}
                </span>
                <span className="text-[#6B6A63] font-semibold">{pct}%</span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              key={i}
              onClick={() => elegir(i)}
              disabled={pendiente}
              className="text-left rounded-[8px] border border-[#E0DCD2] bg-white px-3 py-2 text-[14px] hover:border-[#C2560A] disabled:opacity-60"
            >
              {o}
            </button>
          )
        })}
      </div>
      <span className="text-[12.5px] text-[#6B6A63]">
        {total} {total === 1 ? "voto" : "votos"}
        {!sesion && " · Entra para votar"}
        {mia !== null && " · Puedes cambiar tu voto"}
      </span>
      {error && <PideCuenta error={error} onCerrar={() => setError("")} />}
    </div>
  )
}

export function BotonMejor({ temaId, respuestaId, esMejor }: { temaId: number; respuestaId: number; esMejor: boolean }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState("")
  return (
    <>
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await marcarMejor(temaId, esMejor ? null : respuestaId)
            if (r.ok) router.refresh()
            else setError(r.error)
          })
        }
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-semibold ${
          esMejor ? "bg-[#16794F] border-[#16794F] text-white" : "bg-white border-[#CFE3D7] text-[#16794F] hover:border-[#16794F]"
        } disabled:opacity-60`}
      >
        ✓ {esMejor ? "Mejor respuesta" : "Marcar como la mejor"}
      </button>
      {error && <PideCuenta error={error} onCerrar={() => setError("")} />}
    </>
  )
}

export function Compartir({ url, titulo }: { url: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    const liga = new URL(url, window.location.origin).toString()
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, url: liga })
        return
      }
    } catch {
      return
    }
    await navigator.clipboard.writeText(liga).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }
  return (
    <button type="button" onClick={copiar} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E0DCD2] bg-white text-[13.5px] font-semibold text-[#44433D] hover:border-[#C2560A]">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
      </svg>
      {copiado ? "Liga copiada" : "Compartir"}
    </button>
  )
}

const MOTIVOS = ["Spam o publicidad engañosa", "Posible fraude", "Pide tratar o pagar por fuera", "Ofensivo o agresivo", "Otro"]

export function MenuMas({ tipo, id, puedeOcultar, esModerador, estado }: { tipo: "tema" | "respuesta"; id: number; puedeOcultar: boolean; esModerador: boolean; estado: string }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [modo, setModo] = useState<"menu" | "reporte" | "listo">("menu")
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [detalle, setDetalle] = useState("")
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  const enviar = () =>
    iniciar(async () => {
      const r = await reportar(tipo, id, `${motivo}${detalle ? `: ${detalle}` : ""}`)
      if (r.ok) setModo("listo")
      else setError(r.error)
    })
  const estadoNuevo = (e: "publicado" | "oculto" | "revision") =>
    iniciar(async () => {
      const r = await cambiarEstado(tipo, id, e)
      if (r.ok) {
        setAbierto(false)
        router.refresh()
      } else setError(r.error)
    })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setAbierto(!abierto)
          setModo("menu")
          setError("")
        }}
        className="w-8 h-8 rounded-full text-[#6B6A63] hover:bg-[#F1EFEA] flex items-center justify-center"
        aria-label="Más opciones"
        aria-expanded={abierto}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {abierto && (
        <div className="absolute right-0 top-9 z-20 w-[270px] bg-white border border-[#E7E4DC] rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.12)] p-2 flex flex-col text-[14px]">
          {modo === "menu" && (
            <>
              <button type="button" onClick={() => setModo("reporte")} className="text-left px-3 py-2 rounded-[8px] hover:bg-[#F6F4EF]">
                Reportar
              </button>
              {puedeOcultar && estado !== "oculto" && (
                <button type="button" disabled={pendiente} onClick={() => estadoNuevo("oculto")} className="text-left px-3 py-2 rounded-[8px] hover:bg-[#F6F4EF]">
                  {esModerador ? "Ocultar (moderación)" : "Borrar mi publicación"}
                </button>
              )}
              {esModerador && estado !== "publicado" && (
                <button type="button" disabled={pendiente} onClick={() => estadoNuevo("publicado")} className="text-left px-3 py-2 rounded-[8px] hover:bg-[#F6F4EF]">
                  Publicar (moderación)
                </button>
              )}
            </>
          )}
          {modo === "reporte" && (
            <div className="flex flex-col gap-2 p-1">
              <span className="font-semibold text-[13.5px]">¿Qué pasa?</span>
              {MOTIVOS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-[13.5px] cursor-pointer">
                  <input type="radio" name={`motivo-${tipo}-${id}`} checked={motivo === m} onChange={() => setMotivo(m)} />
                  {m}
                </label>
              ))}
              <textarea
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                maxLength={400}
                rows={2}
                placeholder="Detalles (opcional)"
                className="border border-[#E0DCD2] rounded-[8px] px-2 py-1.5 text-[13.5px] resize-none"
              />
              <button type="button" disabled={pendiente} onClick={enviar} className="bg-[#142033] text-white rounded-[8px] py-2 font-semibold text-[13.5px] disabled:opacity-60">
                Enviar reporte
              </button>
            </div>
          )}
          {modo === "listo" && <p className="m-0 px-3 py-2 text-[13.5px] text-[#16794F]">Gracias. Lo revisamos pronto.</p>}
          {error && <PideCuenta error={error} />}
        </div>
      )}
    </div>
  )
}
