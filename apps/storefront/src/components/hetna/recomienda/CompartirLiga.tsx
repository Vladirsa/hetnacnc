"use client"

// Botones para compartir la liga de Recomienda y gana: copiar, WhatsApp y
// Facebook. En celular usa el menú de compartir del teléfono si existe.
import { useState } from "react"

export function CompartirLiga({ liga, monto, minimo }: { liga: string; monto: number; minimo: number }) {
  const [copiado, setCopiado] = useState(false)
  const texto = `Te regalo $${monto} en tu primera compra de $${minimo} o más en HETNA CNC, la tienda de CNC en México (fresas, refacciones, diseños y talleres que te fabrican piezas). Regístrate con mi liga y usa el código BIENVENIDA:`

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(liga)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }

  const compartir = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ title: "HETNA CNC", text: texto, url: liga })
        return
      } catch {
        // cancelado: no pasa nada
      }
    } else {
      await copiar()
    }
  }

  const btn = "inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[14px] font-semibold"
  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={liga}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Tu liga para recomendar"
          className="h-11 min-w-0 flex-1 rounded-[10px] border border-[#D9D5C9] bg-white px-3 text-[14px] text-[#1B1B18]"
        />
        <button type="button" onClick={copiar} className={`${btn} bg-[#142033] text-white hover:bg-[#1B2A42]`}>
          {copiado ? "¡Copiada!" : "Copiar liga"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${texto} ${liga}`)}`}
          target="_blank"
          rel="noreferrer"
          className={`${btn} bg-[#1FA855] text-white hover:bg-[#178C46]`}
        >
          Enviar por WhatsApp
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(liga)}`}
          target="_blank"
          rel="noreferrer"
          className={`${btn} bg-[#1877F2] text-white hover:bg-[#1465CF]`}
        >
          Compartir en Facebook
        </a>
        <button type="button" onClick={compartir} className={`${btn} border border-[#D9D5C9] bg-white text-[#1B1B18] hover:border-[#C2560A]`}>
          Más opciones
        </button>
      </div>
    </div>
  )
}
