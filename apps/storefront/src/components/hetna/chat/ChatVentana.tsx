"use client"

// Ventana de conversación. La usan el cliente (con su sesión) y el taller (con su enlace privado).
// Se actualiza sola cada 5 segundos mientras la pestaña está abierta.

import { useCallback, useEffect, useRef, useState } from "react"

import { enviarMensaje, leerMensajes } from "@/lib/chat/acciones"
import { ERRORES, EXPLICACION_BLOQUEO, type Autor, type Mensaje } from "@/lib/chat/tipos"

type Props = {
  yo: Autor // "cliente" o "taller": de qué lado está quien mira la pantalla
  conversacionId?: string // cliente
  token?: string // taller
  inicial: Mensaje[]
  cerrada?: boolean
}

const hora = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

export default function ChatVentana({ yo, conversacionId, token, inicial, cerrada }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(inicial)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const fin = useRef<HTMLDivElement>(null)
  const ultimo = useRef(inicial.length ? inicial[inicial.length - 1].id : 0)

  const agregar = useCallback((nuevos: Mensaje[]) => {
    if (!nuevos.length) return
    setMensajes((actuales) => {
      const ids = new Set(actuales.map((m) => m.id))
      const sumar = nuevos.filter((m) => !ids.has(m.id))
      if (!sumar.length) return actuales
      ultimo.current = Math.max(ultimo.current, ...sumar.map((m) => m.id))
      return [...actuales, ...sumar]
    })
  }, [])

  // Pregunta por mensajes nuevos cada 5 segundos (solo si la pestaña se está viendo)
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return
      const r = await leerMensajes({ conversacionId, token, despuesDe: ultimo.current }).catch(() => null)
      if (r && r.ok) agregar(r.mensajes)
    }, 5000)
    return () => clearInterval(t)
  }, [conversacionId, token, agregar])

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [mensajes.length])

  async function enviar() {
    const cuerpo = texto.trim()
    if (!cuerpo || enviando) return
    setEnviando(true)
    setAviso(null)
    const r = await enviarMensaje({ conversacionId, token, cuerpo }).catch(() => null)
    setEnviando(false)
    if (!r) return setAviso(ERRORES.error)
    if (r.ok) {
      agregar([r.mensaje])
      setTexto("")
      return
    }
    if (r.error === "bloqueado") {
      const que = (r.motivos || []).map((m) => EXPLICACION_BLOQUEO[m]).filter(Boolean).join(", ")
      setAviso(
        `Tu mensaje no se envió porque contiene ${que || "datos de contacto"}. ` +
          `Por tu seguridad, los tratos se hacen dentro de HETNA, donde estás protegido. ` +
          `Quita ese dato y vuelve a enviarlo.`
      )
      return
    }
    setAviso(ERRORES[r.error] || ERRORES.error)
  }

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#142033]">
      <div className="flex max-h-[60vh] min-h-[280px] flex-col gap-2 overflow-y-auto p-3 md:p-4">
        {mensajes.length === 0 && <p className="m-auto text-sm text-gray-500">Aún no hay mensajes.</p>}
        {mensajes.map((m) => {
          const mio = m.de === yo
          return (
            <div key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                  mio ? "bg-[#C2560A] text-white" : "bg-gray-100 text-gray-900 dark:bg-[#1E3250] dark:text-gray-100"
                }`}
              >
                {m.cuerpo}
                <div className={`mt-1 text-[10px] ${mio ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`}>{hora(m.creado)}</div>
              </div>
            </div>
          )
        })}
        <div ref={fin} />
      </div>

      {cerrada ? (
        <p className="border-t border-gray-200 p-3 text-center text-sm text-gray-500 dark:border-gray-700">Esta conversación está cerrada.</p>
      ) : (
        <div className="border-t border-gray-200 p-3 dark:border-gray-700">
          {aviso && (
            <p role="alert" className="mb-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              {aviso}
            </p>
          )}
          <div className="flex gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Escribe tu mensaje…"
              className="min-h-[48px] flex-1 resize-none rounded-lg border border-gray-300 bg-white p-2 text-base text-gray-900 dark:border-gray-600 dark:bg-[#0F1826] dark:text-gray-100"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void enviar()
                }
              }}
            />
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || !texto.trim()}
              className="h-12 shrink-0 rounded-lg bg-[#C2560A] px-5 text-base font-semibold text-white disabled:opacity-50"
            >
              {enviando ? "…" : "Enviar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            No se permiten teléfonos, correos ni redes sociales. Los datos de contacto se comparten solo al concretar la compra en HETNA.
          </p>
        </div>
      )}
    </div>
  )
}
