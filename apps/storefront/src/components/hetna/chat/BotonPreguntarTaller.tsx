"use client"

// Botón "Preguntar al taller": abre una cajita para escribir el primer mensaje.
// Si la persona no ha iniciado sesión, le pide entrar primero.

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

import { iniciarChat } from "@/lib/chat/acciones"
import { ERRORES, EXPLICACION_BLOQUEO } from "@/lib/chat/tipos"

type Props = {
  tallerHandle: string
  tallerNombre: string
  productoHandle?: string
  productoTitulo?: string
  etiqueta?: string
  className?: string
}

export default function BotonPreguntarTaller({
  tallerHandle,
  tallerNombre,
  productoHandle,
  productoTitulo,
  etiqueta = "Preguntar al taller",
  className,
}: Props) {
  const router = useRouter()
  const params = useParams<{ locale?: string }>()
  const locale = params?.locale || "mx"
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sinSesion, setSinSesion] = useState(false)

  async function enviar() {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    setError(null)
    const r = await iniciarChat({ tallerHandle, productoHandle, productoTitulo, mensaje: texto }).catch(() => null)
    setEnviando(false)
    if (!r) return setError(ERRORES.error)
    if (r.ok) return router.push(`/${locale}/mensajes/${r.id}`)
    if (r.error === "sin_sesion") return setSinSesion(true)
    if (r.error === "bloqueado") {
      const que = (r.motivos || []).map((m) => EXPLICACION_BLOQUEO[m]).filter(Boolean).join(", ")
      return setError(
        `Tu mensaje no se envió porque contiene ${que || "datos de contacto"}. ` +
          `Por tu seguridad, los tratos se hacen dentro de HETNA, donde estás protegido. Quita ese dato y vuelve a enviarlo.`
      )
    }
    setError(ERRORES[r.error] || ERRORES.error)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={
          className ||
          "inline-flex h-12 items-center justify-center rounded-lg border-2 border-[#C2560A] px-5 text-base font-semibold text-[#C2560A] hover:bg-[#C2560A] hover:text-white"
        }
      >
        {etiqueta}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4" onClick={() => setAbierto(false)}>
          <div
            className="w-full max-w-lg rounded-t-2xl bg-white p-4 dark:bg-[#142033] md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`Escribir a ${tallerNombre}`}
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Escribir a {tallerNombre}</h2>
            {productoTitulo && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sobre: {productoTitulo}</p>}

            {sinSesion ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-200">Para escribir al taller primero inicia sesión o crea tu cuenta (es gratis y toma un minuto).</p>
                <Link href={`/${locale}/user`} className="flex h-12 items-center justify-center rounded-lg bg-[#C2560A] text-base font-semibold text-white">
                  Iniciar sesión
                </Link>
              </div>
            ) : (
              <>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  autoFocus
                  placeholder="Cuéntale qué necesitas: material, medidas, cantidad, para cuándo…"
                  className="mt-3 w-full rounded-lg border border-gray-300 bg-white p-3 text-base text-gray-900 dark:border-gray-600 dark:bg-[#0F1826] dark:text-gray-100"
                />
                {error && (
                  <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                    {error}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">No compartas teléfonos, correos ni redes sociales: el chat los bloquea para protegerte.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setAbierto(false)} className="h-12 flex-1 rounded-lg border border-gray-300 text-base text-gray-700 dark:border-gray-600 dark:text-gray-200">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={enviar}
                    disabled={enviando || !texto.trim()}
                    className="h-12 flex-1 rounded-lg bg-[#C2560A] text-base font-semibold text-white disabled:opacity-50"
                  >
                    {enviando ? "Enviando…" : "Enviar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
