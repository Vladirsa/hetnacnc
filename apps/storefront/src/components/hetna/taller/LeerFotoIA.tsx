"use client"

// "¿Sin archivo? Toma una foto": la IA lee la foto o el boceto y llena la
// solicitud (estrategia 2.2). El cliente revisa y corrige antes de mandar.
// La foto también se adjunta a la solicitud para que el taller la vea.
import { useRef, useState } from "react"

import { leerFotoSolicitud, type LecturaFoto } from "@/lib/cotizar/acciones"

/** Reduce la foto a ≤ 1400 px y JPEG (las acciones del servidor aceptan ~1 MB). */
async function reducir(f: File): Promise<{ base64: string; medio: string }> {
  const url = URL.createObjectURL(f)
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error("No pude abrir la imagen."))
      i.src = url
    })
    for (const [lado, calidad] of [[1400, 0.82], [1100, 0.75], [900, 0.7]] as const) {
      const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement("canvas")
      c.width = Math.max(1, Math.round(img.naturalWidth * k))
      c.height = Math.max(1, Math.round(img.naturalHeight * k))
      const ctx = c.getContext("2d")
      if (!ctx) break
      ctx.fillStyle = "#fff"
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      const base64 = c.toDataURL("image/jpeg", calidad).split(",")[1] || ""
      if (base64.length < 900_000) return { base64, medio: "image/jpeg" }
    }
    throw new Error("La foto es muy pesada. Prueba con otra.")
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function LeerFotoIA({ alLeer, adjuntar }: { alLeer: (l: LecturaFoto) => void; adjuntar: (f: File) => void }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [estado, setEstado] = useState<"" | "leyendo">("")
  const [error, setError] = useState("")
  const [lectura, setLectura] = useState<LecturaFoto | null>(null)

  const elegir = async (f: File | undefined) => {
    if (!f) return
    setError("")
    setLectura(null)
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|heic)$/i.test(f.name)) return setError("Sube una foto (JPG o PNG).")
    setEstado("leyendo")
    try {
      const { base64, medio } = await reducir(f)
      const texto = (document.getElementById("descripcion") as HTMLTextAreaElement | null)?.value || ""
      const r = await leerFotoSolicitud({ imagen: base64, medio, texto })
      if (!r.ok) return setError(r.mensaje)
      setLectura(r.lectura)
      adjuntar(f)
      if (r.lectura.es_pieza) alLeer(r.lectura)
    } catch (e) {
      setError((e as Error).message || "No se pudo leer la foto.")
    } finally {
      setEstado("")
      if (entrada.current) entrada.current.value = ""
    }
  }

  return (
    <div className="rounded-xl border border-[#F2C9A5] bg-[#FFF8F1] p-4">
      <p className="m-0 text-sm font-bold text-[#142033]">📷 ¿No tienes archivo? Toma una foto o un boceto</p>
      <p className="m-0 mt-1 text-xs text-[#6B675C]">
        De la pieza que quieres copiar, de un dibujo a mano o de una referencia. La IA llena la solicitud por ti y tú la revisas antes de mandarla.
      </p>
      <input ref={entrada} type="file" accept="image/*" capture="environment" className="sr-only" id="foto-ia" onChange={(e) => elegir(e.target.files?.[0])} />
      <label
        htmlFor="foto-ia"
        className={`mt-3 inline-flex cursor-pointer items-center rounded-lg px-4 py-2 text-sm font-semibold text-white ${estado ? "bg-[#9A968B]" : "bg-[#C2560A] hover:bg-[#A84A08]"}`}
      >
        {estado ? "Leyendo tu foto…" : "Tomar o subir foto"}
      </label>
      {error && <p className="m-0 mt-2 text-xs font-semibold text-[#B3261E]">{error}</p>}
      {lectura && !lectura.es_pieza && (
        <p className="m-0 mt-2 text-xs text-[#8A3D06]">
          No vimos una pieza para fabricar en esa foto. {lectura.descripcion} Prueba con otra o describe tu pieza abajo.
        </p>
      )}
      {lectura?.es_pieza && (
        <div className="mt-3 rounded-lg bg-white p-3 text-xs text-[#40403A]">
          <p className="m-0 font-bold text-[#0F7A4A]">✓ Llenamos la solicitud con lo que se ve: {lectura.pieza}</p>
          <p className="m-0 mt-1">
            Proceso sugerido: <b>{lectura.proceso}</b>
            {lectura.material ? <> · Material: <b>{lectura.material}</b></> : null}
            {lectura.medidas ? <> · Medidas{lectura.medidas_aproximadas ? " aprox." : ""}: <b>{lectura.medidas}</b></> : null}
          </p>
          {lectura.preguntas.length > 0 && (
            <>
              <p className="m-0 mt-2 font-semibold text-[#142033]">Para que te coticen bien, agrega en los detalles:</p>
              <ul className="m-0 mt-1 list-disc pl-4">
                {lectura.preguntas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </>
          )}
          <p className="m-0 mt-2 text-[11px] text-[#7A776E]">
            Revisa y corrige abajo antes de enviar.{lectura.confianza === "baja" ? " La foto no era muy clara: revisa con cuidado." : ""} La foto va adjunta para el taller.
          </p>
        </div>
      )}
    </div>
  )
}
