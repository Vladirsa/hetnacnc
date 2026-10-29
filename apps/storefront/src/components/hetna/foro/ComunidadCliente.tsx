"use client"

// Botones de la comunidad: seguir un tema, pedir respuesta, asistir a un
// evento, mensajes directos, bloquear, preferencias de correo y la campana.
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import {
  asistir,
  bloquear,
  enviarMensaje,
  guardarPreferencias,
  marcarAvisosLeidos,
  pedirRespuesta,
  seguirTema,
} from "@/lib/foro/acciones-comunidad"
import type { Candidato } from "@/lib/foro/comunidad"
import { CORREO_AVISOS, type CorreoAvisos, MENSAJES } from "@/lib/foro/tipos"

import { PideCuenta } from "./Interaccion"
import { Avatar } from "./Piezas"

const BTN = "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition disabled:opacity-60"
const mensaje = (e: string) => MENSAJES[e] || e

// ---------------------------------------------------------------------
// Seguir un tema
// ---------------------------------------------------------------------

export function BotonSeguirTema({ temaId, siguiendo }: { temaId: number; siguiendo: boolean }) {
  const [si, setSi] = useState(siguiendo)
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()
  const clic = () => {
    setError("")
    const quiere = !si
    setSi(quiere)
    iniciar(async () => {
      const r = await seguirTema(temaId, quiere)
      if (!r.ok) {
        setSi(!quiere)
        setError(r.error)
      }
    })
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={clic}
        disabled={pendiente}
        aria-pressed={si}
        title="Te avisamos cuando alguien responda"
        className={`${BTN} border px-3 py-1.5 text-[13.5px] ${
          si ? "border-[#142033] bg-[#142033] text-white" : "border-[#E0DCD2] bg-white text-[#44433D] hover:border-[#C2560A]"
        }`}
      >
        {si ? "✓ Siguiendo el tema" : "🔔 Seguir el tema"}
      </button>
      {error && <PideCuenta error={error} onCerrar={() => setError("")} />}
    </div>
  )
}

// ---------------------------------------------------------------------
// Pedir respuesta (como en Quora)
// ---------------------------------------------------------------------

export function PedirRespuesta({ temaId, candidatos }: { temaId: number; candidatos: Candidato[] }) {
  const [pedidos, setPedidos] = useState(() => new Set(candidatos.filter((c) => c.pedido).map((c) => c.id)))
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()
  if (!candidatos.length) return null
  const pedir = (id: string) => {
    setError("")
    iniciar(async () => {
      const r = await pedirRespuesta(temaId, id)
      if (r.ok || r.error === "ya_pedido") setPedidos((s) => new Set([...s, id]))
      else setError(r.error)
    })
  }
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[#E7E4DC] bg-white p-4">
      <div>
        <strong className="block text-[14.5px] text-[#1B1B18]">Pide una respuesta</strong>
        <span className="text-[13px] text-[#6B6A63]">Invita a quien sabe de esto. Le llega un aviso.</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {candidatos.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5">
            <Avatar a={c} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-[#1B1B18]">{c.nombre}</span>
              <span className="block truncate text-[12px] text-[#6B6A63]">
                {c.titular || (c.respuestas ? `${c.respuestas} respuestas en esta sección` : `${c.reputacion} pts`)}
              </span>
            </span>
            <button
              type="button"
              disabled={pendiente || pedidos.has(c.id)}
              onClick={() => pedir(c.id)}
              className={`${BTN} px-3 py-1 text-[12.5px] ${
                pedidos.has(c.id) ? "bg-[#EAF6EF] text-[#14683F]" : "border border-[#C2560A] text-[#B34D07] hover:bg-[#FDEEE1]"
              }`}
            >
              {pedidos.has(c.id) ? "✓ Pedido" : "Pedir"}
            </button>
          </li>
        ))}
      </ul>
      {error && <PideCuenta error={error} onCerrar={() => setError("")} />}
    </div>
  )
}

// ---------------------------------------------------------------------
// Eventos: "Asistiré"
// ---------------------------------------------------------------------

export function BotonAsistir({ temaId, n, yo, pasado }: { temaId: number; n: number; yo: boolean; pasado: boolean }) {
  const [estado, setEstado] = useState({ n, yo })
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()
  const clic = () => {
    setError("")
    const antes = estado
    const quiere = !antes.yo
    setEstado({ yo: quiere, n: Math.max(0, antes.n + (quiere ? 1 : -1)) })
    iniciar(async () => {
      const r = await asistir(temaId, quiere)
      if (r.ok) setEstado({ n: r.n, yo: r.yo })
      else {
        setEstado(antes)
        setError(r.error)
      }
    })
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {!pasado && (
          <button
            type="button"
            onClick={clic}
            disabled={pendiente}
            aria-pressed={estado.yo}
            className={`${BTN} px-5 py-2.5 text-[14.5px] ${
              estado.yo ? "border border-[#16794F] bg-[#EAF6EF] text-[#14683F]" : "bg-[#16794F] text-white hover:brightness-110"
            }`}
          >
            {estado.yo ? "✓ Asistiré" : "Asistiré"}
          </button>
        )}
        <span className="text-[14px] text-[#44433D]">
          {estado.n === 0 ? (pasado ? "" : "Sé el primero en confirmar") : estado.n === 1 ? "1 persona va" : `${estado.n} personas van`}
        </span>
      </div>
      {!pasado && estado.yo && <span className="text-[12.5px] text-[#6B6A63]">Te recordamos un día antes.</span>}
      {error && <PideCuenta error={error} onCerrar={() => setError("")} />}
    </div>
  )
}

// ---------------------------------------------------------------------
// Mensajes directos
// ---------------------------------------------------------------------

export function FormMensaje({ usuario, deshabilitado }: { usuario: string; deshabilitado?: string }) {
  const router = useRouter()
  const [texto, setTexto] = useState("")
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  // Revisa si llegaron mensajes nuevos cada 15 segundos mientras la pestaña está a la vista
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) router.refresh()
    }, 15000)
    return () => clearInterval(t)
  }, [router])

  if (deshabilitado) return <p className="m-0 rounded-[12px] bg-[#F4F1EA] px-4 py-3 text-[14px] text-[#6B6A63]">{deshabilitado}</p>

  const enviar = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!texto.trim()) return
    setError("")
    iniciar(async () => {
      const r = await enviarMensaje(usuario, texto)
      if (r.ok) {
        setTexto("")
        router.refresh()
      } else setError(r.error)
    })
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              enviar()
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder="Escribe tu mensaje…"
          aria-label="Mensaje"
          className="min-h-[48px] flex-1 resize-y rounded-[12px] border border-[#E0DCD2] bg-white px-3 py-2.5 text-[15px] focus:border-[#C2560A] focus:outline-none"
        />
        <button type="submit" disabled={pendiente || !texto.trim()} className={`${BTN} h-[48px] bg-[#C2560A] px-5 text-[14.5px] text-white hover:bg-[#A84A08]`}>
          {pendiente ? "…" : "Enviar"}
        </button>
      </div>
      <span className="text-[12px] text-[#9A978C]">Enter para enviar · Shift+Enter para otro renglón · Los teléfonos y correos se ocultan: cierra tus tratos dentro de HETNA.</span>
      {error && <PideCuenta error={error} onCerrar={() => setError("")} />}
    </form>
  )
}

export function BotonBloquear({ perfilId, bloqueado }: { perfilId: string; bloqueado: boolean }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const clic = () => {
    if (!bloqueado && !confirm("¿Bloquear? Ya no podrá mandarte mensajes.")) return
    iniciar(async () => {
      const r = await bloquear(perfilId, !bloqueado)
      if (r.ok) router.refresh()
    })
  }
  return (
    <button type="button" onClick={clic} disabled={pendiente} className="text-[13px] font-semibold text-[#A42A2A] hover:underline disabled:opacity-60">
      {bloqueado ? "Desbloquear" : "Bloquear"}
    </button>
  )
}

// ---------------------------------------------------------------------
// Campana: al abrir la página de avisos quedan como leídos
// ---------------------------------------------------------------------

export function MarcarLeidos({ hay }: { hay: boolean }) {
  const hecho = useRef(false)
  useEffect(() => {
    if (!hay || hecho.current) return
    hecho.current = true
    void marcarAvisosLeidos()
  }, [hay])
  return null
}

// ---------------------------------------------------------------------
// Preferencias de correo (en Editar perfil)
// ---------------------------------------------------------------------

export function FormPreferencias({ inicial }: { inicial: { correoAvisos: CorreoAvisos; resumenSemanal: boolean } }) {
  const [correo, setCorreo] = useState<CorreoAvisos>(inicial.correoAvisos)
  const [semanal, setSemanal] = useState(inicial.resumenSemanal)
  const [estado, setEstado] = useState("")
  const [pendiente, iniciar] = useTransition()
  const guardar = (c: CorreoAvisos, s: boolean) => {
    setEstado("")
    iniciar(async () => {
      const r = await guardarPreferencias({ correoAvisos: c, resumenSemanal: s })
      setEstado(r.ok ? "✓ Guardado" : mensaje(r.error))
    })
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 text-[19px] font-bold text-[#1B1B18]">Avisos por correo</h2>
        <p className="m-0 mt-1 text-[14px] text-[#6B6A63]">
          Respuestas a tus temas, nuevos seguidores, mensajes, avales, postulaciones y recordatorios de eventos. Todo sale también en la campana del foro.
        </p>
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        {(Object.keys(CORREO_AVISOS) as CorreoAvisos[]).map((c) => (
          <label key={c} className="flex cursor-pointer items-center gap-2.5 text-[14.5px] text-[#1B1B18]">
            <input
              type="radio"
              name="correo_avisos"
              checked={correo === c}
              onChange={() => {
                setCorreo(c)
                guardar(c, semanal)
              }}
              className="h-4 w-4 accent-[#C2560A]"
            />
            {CORREO_AVISOS[c]}
          </label>
        ))}
      </fieldset>
      <label className="flex cursor-pointer items-start gap-2.5 text-[14.5px] text-[#1B1B18]">
        <input
          type="checkbox"
          checked={semanal}
          onChange={(e) => {
            setSemanal(e.target.checked)
            guardar(correo, e.target.checked)
          }}
          className="mt-1 h-4 w-4 accent-[#C2560A]"
        />
        <span>
          Resumen semanal los lunes
          <span className="block text-[13px] text-[#6B6A63]">Lo mejor de lo que sigues, preguntas que puedes responder, vacantes y eventos.</span>
        </span>
      </label>
      {(pendiente || estado) && <span className="text-[13.5px] font-semibold text-[#16794F]">{pendiente ? "Guardando…" : estado}</span>}
    </div>
  )
}
