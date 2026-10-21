"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { Button } from "@/components/atoms"
import { enviarResena } from "@/lib/resenas/acciones"

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
  const router = useRouter()

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

      {error && (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-[#9B3225]">
          {error}
        </p>
      )}

      <Button
        onClick={enviar}
        disabled={!calificacion || enviando}
        loading={enviando}
        className="mt-2 px-6 py-2.5 font-bold"
      >
        Publicar reseña
      </Button>
    </div>
  )
}
