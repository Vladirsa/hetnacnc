"use client"

// Guardar, abrir y compartir el trabajo del CAM 2D y del torno en la cuenta
// del cliente. La herramienta le pasa cómo sacar su estado (`obtener`) y cómo
// ponerlo (`aplicar`); aquí vive la lista, la liga para compartir y los avisos.
//
// Una liga compartida (?proyecto=ID) abre una COPIA: quien la recibe puede
// cambiarla y guardarla como suya, sin tocar la original.
import { useCallback, useEffect, useState } from "react"

type Resumen = { id: string; nombre: string; compartido: boolean; actualizado: string }
type Props = {
  herramienta: "2d" | "torno"
  /** Estado actual de la herramienta, o un texto con el motivo por el que no hay nada que guardar */
  obtener: () => unknown | string
  /** Pone un proyecto en la herramienta; devuelve false si no lo pudo leer */
  aplicar: (datos: any) => boolean
  oscuro?: boolean
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" })

export function ProyectosCam({ herramienta, obtener, aplicar, oscuro = false }: Props) {
  const [lista, setLista] = useState<Resumen[] | null>(null) // null = sin sesión o sin cargar
  const [sesion, setSesion] = useState(true)
  const [nombre, setNombre] = useState("")
  const [actual, setActual] = useState<string | null>(null)
  const [aviso, setAviso] = useState("")
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/cam/proyectos?herramienta=${herramienta}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null)
    if (r?.ok) setLista(r.proyectos)
    else if (r?.codigo === "sesion") setSesion(false)
  }, [herramienta])

  const abrir = useCallback(
    async (id: string, deLiga = false) => {
      setOcupado(true)
      const r = await fetch(`/api/cam/proyectos?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null)
      setOcupado(false)
      if (!r?.ok || r.proyecto?.herramienta !== herramienta) return setAviso(r?.mensaje || "No se pudo abrir ese proyecto.")
      if (!aplicar(r.proyecto.datos)) return setAviso("Ese proyecto no se pudo leer.")
      setNombre(r.proyecto.nombre)
      setActual(r.proyecto.propio ? r.proyecto.id : null)
      setAviso(r.proyecto.propio ? `Abriste "${r.proyecto.nombre}".` : deLiga ? `Abriste una copia de "${r.proyecto.nombre}". Guárdala para tenerla en tu cuenta.` : "")
    },
    [aplicar, herramienta]
  )

  useEffect(() => {
    cargar()
    const id = new URLSearchParams(window.location.search).get("proyecto")
    if (id) abrir(id, true)
    // sólo al montar: la liga se abre una vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const guardar = async (comoNuevo: boolean) => {
    const datos = obtener()
    if (typeof datos === "string") return setAviso(datos)
    setOcupado(true)
    const r = await fetch("/api/cam/proyectos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: comoNuevo ? null : actual, herramienta, nombre: nombre.trim() || "Proyecto sin nombre", datos }) })
      .then((x) => x.json())
      .catch(() => null)
    setOcupado(false)
    if (!r?.ok) {
      if (r?.codigo === "sesion") setSesion(false)
      return setAviso(r?.mensaje || "No se pudo guardar.")
    }
    setActual(r.proyecto.id)
    setAviso("Guardado en tu cuenta.")
    cargar()
  }

  const compartir = async (p: Resumen) => {
    const r = await fetch(`/api/cam/proyectos?id=${p.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ compartido: true }) }).then((x) => x.json()).catch(() => null)
    if (!r?.ok) return setAviso(r?.mensaje || "No se pudo compartir.")
    const liga = `${window.location.origin}${window.location.pathname}?proyecto=${p.id}`
    try {
      await navigator.clipboard.writeText(liga)
      setAviso("Liga copiada: quien la abra recibe una copia de tu proyecto.")
    } catch {
      setAviso(`Comparte esta liga: ${liga}`)
    }
    cargar()
  }
  const dejarDeCompartir = async (p: Resumen) => {
    await fetch(`/api/cam/proyectos?id=${p.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ compartido: false }) }).catch(() => null)
    setAviso("La liga de ese proyecto ya no funciona.")
    cargar()
  }
  const borrar = async (p: Resumen) => {
    if (!window.confirm(`¿Borrar "${p.nombre}"?`)) return
    await fetch(`/api/cam/proyectos?id=${p.id}`, { method: "DELETE" }).catch(() => null)
    if (actual === p.id) setActual(null)
    cargar()
  }

  const c = oscuro
    ? { caja: "border-[#2B3648] bg-[#151C27] text-white", suave: "text-[#8A97AB]", campo: "bg-[#1C2431] text-white placeholder:text-[#8A97AB]", fila: "bg-[#1C2431]", boton: "bg-[#2B3648] text-white hover:bg-[#3A475C]" }
    : { caja: "border-[#E7E4DC] bg-white text-[#1B1B18]", suave: "text-[#6B6A63]", campo: "border border-[#E7E4DC] bg-white text-[#1B1B18]", fila: "bg-[#FAF9F6]", boton: "border border-[#C9C4B8] bg-white text-[#1B1B18] hover:border-[#C2560A]" }
  const boton = `rounded-[8px] px-3 py-2 text-[13px] font-semibold disabled:opacity-50 ${c.boton}`

  return (
    <div className={`flex flex-col gap-2 rounded-[10px] border p-3 ${c.caja}`}>
      <b className="text-[13px]">Mis proyectos</b>
      {!sesion ? (
        <span className={`text-[12.5px] leading-snug ${c.suave}`}>
          <a href={`/mx/login?volver=${encodeURIComponent(typeof window === "undefined" ? "/mx" : window.location.pathname)}`} className="font-semibold text-[#C2560A] underline">Entra a tu cuenta</a> para guardar tu trabajo, retomarlo después y compartirlo con una liga.
        </span>
      ) : (
        <>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proyecto" maxLength={80} className={`rounded-[8px] px-2.5 py-2 text-[13px] outline-none ${c.campo}`} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={ocupado} onClick={() => guardar(false)} className="rounded-[8px] bg-[#C2560A] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-50">
              {actual ? "Guardar cambios" : "Guardar en mi cuenta"}
            </button>
            {actual && (
              <button type="button" disabled={ocupado} onClick={() => guardar(true)} className={boton}>
                Guardar como nuevo
              </button>
            )}
          </div>
          {lista && lista.length > 0 && (
            <ul className="m-0 flex max-h-56 flex-col gap-1 overflow-y-auto p-0">
              {lista.map((p) => (
                <li key={p.id} className={`flex list-none items-center gap-2 rounded-[6px] px-2 py-1.5 text-[12.5px] ${c.fila}`}>
                  <button type="button" onClick={() => abrir(p.id)} className="min-w-0 flex-1 truncate text-left font-semibold hover:text-[#C2560A]" title="Abrir">
                    {p.nombre} <span className={`font-normal ${c.suave}`}>· {fecha(p.actualizado)}{p.compartido ? " · compartido" : ""}</span>
                  </button>
                  <button type="button" onClick={() => compartir(p)} className="text-[#C2560A] hover:underline">Copiar liga</button>
                  {p.compartido && <button type="button" onClick={() => dejarDeCompartir(p)} className={`hover:underline ${c.suave}`}>Quitar liga</button>}
                  <button type="button" onClick={() => borrar(p)} className={`hover:text-[#B3261E] ${c.suave}`} aria-label={`Borrar ${p.nombre}`}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {aviso && <span role="status" className={`text-[12.5px] leading-snug ${c.suave}`}>{aviso}</span>}
    </div>
  )
}
