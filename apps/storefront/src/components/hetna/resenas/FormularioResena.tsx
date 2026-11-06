"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { Button } from "@/components/atoms/Button/Button"
import { enviarResena, subirFotoResena } from "@/lib/resenas/acciones"

const MAX_FOTOS = 3

// Reduce la foto en el navegador (lado mayor 1280 px, JPEG): sube rápido aun
// con datos móviles y cabe en el límite de la acción del servidor.
async function reducir(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new window.Image()
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error("No se pudo leer la foto."))
      i.src = url
    })
    for (const [lado, calidad] of [[1280, 0.8], [1024, 0.7], [800, 0.65]] as const) {
      const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement("canvas")
      c.width = Math.round(img.naturalWidth * escala)
      c.height = Math.round(img.naturalHeight * escala)
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
      const datos = c.toDataURL("image/jpeg", calidad)
      if (datos.length < 900_000) return datos
    }
    throw new Error("La foto es muy pesada.")
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Escribir la reseña. Sólo aparece para quien compró ESTE producto y todavía no
// lo ha reseñado: la lista de pendientes viene del backend, que la arma contra
// las órdenes pagadas del cliente.
export const FormularioResena = ({
  productId,
  orderId,
  titulo,
}: {
  productId: string
  orderId: string
  titulo: string
}) => {
  const [calificacion, setCalificacion] = useState(0)
  const [encima, setEncima] = useState(0)
  const [comentario, setComentario] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fotos, setFotos] = useState<{ id: string; vista: string }[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const router = useRouter()

  const agregarFotos = async (lista: FileList | null) => {
    if (!lista?.length) return
    setError(null)
    setSubiendo(true)
    try {
      for (const archivo of Array.from(lista).slice(0, MAX_FOTOS - fotos.length)) {
        if (!archivo.type.startsWith("image/")) continue
        const datos = await reducir(archivo)
        const r = await subirFotoResena(datos)
        if (!r.ok) {
          setError(r.mensaje)
          break
        }
        setFotos((f) => [...f, { id: r.id, vista: datos }])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.")
    } finally {
      setSubiendo(false)
    }
  }

  const marcadas = encima || calificacion

  const enviar = async () => {
    if (!calificacion || enviando) return
    setEnviando(true)
    setError(null)

    const res = await enviarResena({
      product_id: productId,
      order_id: orderId,
      calificacion,
      comentario: comentario.trim() || undefined,
      fotos: fotos.map((f) => f.id),
    })

    setEnviando(false)
    if (!res.ok) return setError(res.mensaje)

    setListo(true)
    router.refresh()
  }

  if (listo) {
    return (
      <p className="rounded-[10px] bg-[#EAF3EE] px-3 py-2.5 text-[14px] leading-relaxed text-[#1E7A52]">
        <strong>Gracias.</strong> Tu reseña se publica en cuanto la revisamos —
        no desapareció, nada más no se ve todavía.
      </p>
    )
  }

  return (
    <div>
      <p className="text-[14px] font-bold text-[#1B1B18]">
        Compraste esto. ¿Cómo te fue?
      </p>
      <p className="mt-0.5 text-[12px] text-[#6B6A63]">{titulo}</p>

      <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setEncima(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCalificacion(n)}
            onMouseEnter={() => setEncima(n)}
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
            className={`text-[26px] leading-none transition-colors ${
              n <= marcadas ? "text-[#F0A020]" : "text-[#D9D5CC] hover:text-[#F0A020]"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="¿Cortó bien? ¿Llegó como esperabas? Lo que le dirías a alguien del taller de al lado."
        className="mt-2.5 w-full rounded-[10px] border border-[#E7E4DC] px-3 py-2.5 text-[14px] text-[#1B1B18] outline-none focus:border-[#C2560A]"
      />

      <div className="mt-2">
        <p className="text-[13px] font-semibold text-[#1B1B18]">
          Agrega fotos de lo que recibiste <span className="font-normal text-[#6B6A63]">(opcional, hasta {MAX_FOTOS})</span>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {fotos.map((f) => (
            <span key={f.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.vista} alt="Tu foto" className="h-16 w-16 rounded-[8px] border border-[#E7E4DC] object-cover" />
              <button
                type="button"
                aria-label="Quitar foto"
                onClick={() => setFotos((l) => l.filter((x) => x.id !== f.id))}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#1B1B18] text-[11px] text-white"
              >
                ×
              </button>
            </span>
          ))}
          {fotos.length < MAX_FOTOS && (
            <label className={`grid h-16 w-16 cursor-pointer place-items-center rounded-[8px] border-2 border-dashed border-[#D9D5CC] text-center text-[11px] font-semibold text-[#6B6A63] hover:border-[#C2560A] ${subiendo ? "opacity-60" : ""}`}>
              {subiendo ? "Subiendo..." : "📷 Foto"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={subiendo}
                onChange={(e) => {
                  void agregarFotos(e.target.files)
                  e.target.value = ""
                }}
              />
            </label>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-[#9B3225]">
          {error}
        </p>
      )}

      <Button
        onClick={enviar}
        disabled={!calificacion || enviando || subiendo}
        loading={enviando}
        className="mt-2 px-6 py-2.5 font-bold"
      >
        Publicar reseña
      </Button>
    </div>
  )
}
