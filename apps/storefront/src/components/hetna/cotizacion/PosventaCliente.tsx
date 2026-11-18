"use client"

import { useEffect, useState } from "react"

// Posventa en la liga del cliente (hetnacnc.com/c/<token>), con el pedido ya
// entregado: reporta una falla, pide garantía o un ajuste con hasta 3 fotos y
// ve aquí la respuesta del taller. Backend: /api/cotizacion-liga/<token>/posventa
// (packages/api/src/lib/cotizador-posventa.ts), que avisa al taller.

type Caso = { id: string; tipo: string; descripcion: string; estado: string; respuesta: string | null; creado: string }

const TIPOS: Record<string, string> = { falla: "Falla o defecto", garantia: "Garantía", ajuste: "Ajuste o cambio", otro: "Otro" }
const ESTADOS: Record<string, [string, string]> = {
  nuevo: ["Recibido", "text-[#C2560A]"],
  en_revision: ["En revisión", "text-[#185FA5]"],
  resuelto: ["Resuelto", "text-[#1E7B3A]"],
  no_procede: ["No procede", "text-[#6B6A63]"],
}
const MAX_FOTOS = 3
const MAX_MB = 8

const caja = "rounded-[18px] border border-[#E7E4DC] bg-white p-5 md:p-7"
const boton =
  "inline-flex items-center justify-center rounded-[10px] bg-[#C2560A] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-60"
const botonClaro =
  "inline-flex items-center justify-center rounded-[10px] border border-[#E7E4DC] bg-white px-5 py-3 text-[15px] font-semibold text-[#1B1B18] hover:border-[#C2560A] disabled:opacity-60"
const campo =
  "w-full rounded-[10px] border border-[#E7E4DC] bg-[#FAF9F6] px-4 py-3 text-[15px] text-[#1B1B18] focus:border-[#C2560A] focus:outline-none"

export function PosventaCliente({ token }: { token: string }) {
  const [disponible, setDisponible] = useState(false)
  const [casos, setCasos] = useState<Caso[]>([])
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState("falla")
  const [descripcion, setDescripcion] = useState("")
  const [nombre, setNombre] = useState("")
  const [contacto, setContacto] = useState("")
  const [trampa, setTrampa] = useState("")
  const [fotos, setFotos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [listo, setListo] = useState(false)

  const cargar = async () => {
    try {
      const r = await fetch(`/api/cotizacion-liga/${token}/posventa`, { cache: "no-store" })
      if (!r.ok) return
      const d = (await r.json()) as { disponible: boolean; casos: Caso[] }
      setDisponible(Boolean(d.disponible))
      setCasos(d.casos || [])
    } catch {
      // sin servidor: la sección no aparece
    }
  }
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const elegir = (lista: FileList | null) => {
    if (!lista) return
    const nuevas = Array.from(lista).filter((f) => /^image\//.test(f.type))
    const grandes = nuevas.filter((f) => f.size > MAX_MB * 1024 * 1024).length
    setFotos((ya) => [...ya, ...nuevas.filter((f) => f.size <= MAX_MB * 1024 * 1024)].slice(0, MAX_FOTOS))
    setError(grandes ? `Cada foto puede pesar hasta ${MAX_MB} MB.` : "")
  }

  const enviar = async () => {
    setError("")
    if (descripcion.trim().length < 10) {
      setError("Cuéntanos con un poco más de detalle qué pasó.")
      return
    }
    setEnviando(true)
    try {
      const form = new FormData()
      form.append("tipo", tipo)
      form.append("descripcion", descripcion.trim())
      form.append("nombre", nombre.trim())
      form.append("contacto", contacto.trim())
      form.append("sitio_web", trampa)
      fotos.forEach((f) => form.append("fotos", f))
      const r = await fetch(`/api/cotizacion-liga/${token}/posventa`, { method: "POST", body: form })
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!r.ok) throw new Error(d.error || d.message || "No se pudo enviar. Intenta de nuevo.")
      setDescripcion("")
      setFotos([])
      setAbierto(false)
      setListo(true)
      cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  if (!disponible && !casos.length) return null
  return (
    <section className={caja}>
      <h2 className="m-0 text-[17px] font-bold text-[#142033]">¿Algún problema con tu pedido?</h2>
      <p className="m-0 mt-1 text-[14px] text-[#6B6A63]">Reporta una falla, pide garantía o un ajuste. El taller te responde aquí mismo.</p>

      {casos.length ? (
        <ul className="m-0 mt-4 list-none space-y-2 p-0">
          {casos.map((c) => {
            const [etq, color] = ESTADOS[c.estado] || [c.estado, "text-[#6B6A63]"]
            return (
              <li key={c.id} className="rounded-[12px] bg-[#FAF9F6] p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <b className="text-[14px] text-[#1B1B18]">
                    {TIPOS[c.tipo] || "Reporte"} · {new Date(c.creado).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
                  </b>
                  <span className={`text-[13px] font-semibold ${color}`}>{etq}</span>
                </div>
                <p className="m-0 mt-1 text-[14px] text-[#40403A]">{c.descripcion}</p>
                {c.respuesta ? (
                  <p className="m-0 mt-2 text-[14px] text-[#1B1B18]">
                    <span className="block text-[12px] uppercase tracking-wide text-[#7A776E]">Respuesta del taller</span>
                    {c.respuesta}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {listo ? (
        <p className="m-0 mt-4 rounded-[12px] border border-[#CFE8D6] bg-[#EEF8F1] px-4 py-3 text-[14px] text-[#1E7B3A]">
          Recibimos tu reporte. El taller ya tiene el aviso y te responderá aquí.
        </p>
      ) : null}

      {disponible && !abierto ? (
        <button type="button" className={`${botonClaro} mt-4`} onClick={() => { setAbierto(true); setListo(false) }}>
          Reportar un problema
        </button>
      ) : null}

      {abierto ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(TIPOS).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTipo(k)}
                className={`rounded-full border px-4 py-2 text-[14px] ${tipo === k ? "border-[#C2560A] bg-[#FFF4EA] font-semibold text-[#8A3D06]" : "border-[#E7E4DC] bg-white text-[#40403A]"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <textarea className={campo} rows={4} maxLength={2000} placeholder="¿Qué pasó?" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={campo} placeholder="Tu nombre" maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <input className={campo} placeholder="WhatsApp o correo para contactarte" maxLength={160} value={contacto} onChange={(e) => setContacto(e.target.value)} />
          </div>
          {/* Trampa para robots: oculta para las personas */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={trampa} onChange={(e) => setTrampa(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            {fotos.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[#F3F2EE] px-3 py-1 text-[13px]">
                {f.name.slice(0, 24)}
                <button type="button" aria-label="Quitar foto" className="font-bold" onClick={() => setFotos((ya) => ya.filter((_, j) => j !== i))}>
                  ×
                </button>
              </span>
            ))}
            {fotos.length < MAX_FOTOS ? (
              <label className={`${botonClaro} cursor-pointer !py-2 !text-[14px]`}>
                Agregar fotos ({fotos.length}/{MAX_FOTOS})
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="hidden" onChange={(e) => { elegir(e.target.files); e.target.value = "" }} />
              </label>
            ) : null}
          </div>
          {error ? <p className="m-0 text-[14px] text-[#B42318]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={boton} disabled={enviando} onClick={enviar}>
              {enviando ? "Enviando…" : "Enviar reporte"}
            </button>
            <button type="button" className={botonClaro} disabled={enviando} onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
