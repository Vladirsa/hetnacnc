"use client"

// En la liga privada del cliente: quién descargó sus planos y modelos (cada
// descarga queda registrada en HETNA) y el botón para borrarlos cuando la
// solicitud termina. Problema 4 de la auditoría.
import { T } from "@/components/hetna/i18n/Idioma"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { borrarArchivosSolicitud, type VistaSolicitud } from "@/lib/cotizar/solicitud-taller"

const fecha = (s: string) =>
  new Date(s).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

export default function ArchivosProtegidos({ token, s }: { token: string; s: VistaSolicitud }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState("")
  const a = s.archivos_protegidos
  const tiene = (s.trabajo?.archivos || []).length > 0
  if (!a || (!tiene && !a.borrados_en)) return null

  const borrar = () => {
    if (!window.confirm("¿Borrar tus archivos para siempre? Nadie podrá volver a descargarlos, tampoco tú desde aquí.")) return
    iniciar(async () => {
      setError("")
      const r = await borrarArchivosSolicitud(token)
      if (!r.ok) return setError(r.mensaje)
      router.refresh()
    })
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-[#142033]"><T>Tus archivos</T></h2>
      {a.borrados_en ? (
        <p className="mt-2 text-sm text-[#40403A]">
          <T>Se borraron el</T> {fecha(a.borrados_en)}: {a.borrados.join(", ")}<T>. Ya no se pueden descargar.</T>
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-[#40403A]">
            <T>Están en un almacenamiento privado. Mientras recibes propuestas, los descargan sólo los talleres que pueden
            cotizar tu solicitud, según los permisos que elegiste; en cuanto eliges una propuesta o la solicitud cierra,
            únicamente el taller elegido. Cada liga dura una hora y cada descarga queda registrada aquí.</T>
            {" "}<T>Se borran</T> {a.dias_conservacion} <T>días después de que la solicitud se cierra o se cancela.</T>
          </p>
          {a.descargas.length === 0 ? (
            <p className="mt-3 text-sm text-[#6B675C]"><T>Nadie ha descargado tus archivos todavía.</T></p>
          ) : (
            <ul className="mt-3 grid gap-1 text-sm text-[#40403A]">
              {a.descargas.slice(0, 30).map((d, i) => (
                <li key={i}>
                  <span className="text-xs text-[#6B675C]">{fecha(d.fecha)}</span> · <strong>{d.quien}</strong>{" "}
                  {d.accion === "vista" ? "vio" : "descargó"} {d.archivo}
                </li>
              ))}
            </ul>
          )}
          {a.puede_borrar && (
            <button
              type="button"
              onClick={borrar}
              disabled={pendiente}
              className="mt-4 rounded-xl border border-[#B3261E] px-4 py-2 text-sm font-semibold text-[#B3261E] disabled:opacity-60"
            >
              {pendiente ? "Borrando…" : "Borrar mis archivos ahora"}
            </button>
          )}
          {error && <p className="mt-2 text-sm text-[#B3261E]">{error}</p>}
        </>
      )}
    </section>
  )
}
