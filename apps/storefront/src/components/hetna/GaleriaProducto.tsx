"use client"

// Galería de la ficha de producto: foto grande, miniaturas debajo y ampliación a pantalla completa.
// Funciona con el dedo en celular (deslizar en la foto ampliada) y con flechas del teclado en computadora.

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

type Img = { id?: string; url: string }

const limpiaUrl = (u: string) => {
  try {
    return decodeURIComponent(u)
  } catch {
    return u
  }
}

export default function GaleriaProducto({ imagenes, titulo }: { imagenes: Img[]; titulo: string }) {
  const [i, setI] = useState(0)
  const [grande, setGrande] = useState(false)
  const inicioToque = useRef<number | null>(null)
  const total = imagenes.length

  const ir = useCallback((d: number) => setI((x) => (x + d + total) % total), [total])

  // Teclado y bloqueo del scroll mientras la foto está ampliada
  useEffect(() => {
    if (!grande) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGrande(false)
      if (e.key === "ArrowRight") ir(1)
      if (e.key === "ArrowLeft") ir(-1)
    }
    window.addEventListener("keydown", tecla)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", tecla)
      document.body.style.overflow = ""
    }
  }, [grande, ir])

  if (!total) return null
  const actual = imagenes[Math.min(i, total - 1)]
  const alt = (n: number) => `${titulo} - foto ${n + 1} de ${total}`

  return (
    <div data-testid="product-gallery">
      {/* Miniaturas a la izquierda y foto a la derecha, como en cualquier
          tienda grande. Antes la foto ocupaba el ancho completo de la columna
          -- en una pantalla de escritorio eso es un cuadrado de casi 900 px --
          y las miniaturas quedaban hasta abajo, fuera de la vista: parecía que
          el producto tenía una sola foto.

          La foto se topa en alto (no en ancho) para que no empuje el resto de
          la ficha fuera de la pantalla. */}
      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-start">
        <button
          type="button"
          onClick={() => setGrande(true)}
          className="relative block min-w-0 flex-1 cursor-zoom-in overflow-hidden rounded-[14px] border border-[#E7E4DC] bg-white"
          aria-label="Ampliar foto"
        >
          <Image
            priority
            fetchPriority="high"
            src={limpiaUrl(actual.url)}
            alt={alt(i)}
            width={800}
            height={800}
            quality={85}
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="mx-auto h-auto max-h-[300px] w-full object-contain sm:max-h-[420px] lg:max-h-[480px]"
          />
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
            Toca para ampliar{total > 1 ? ` · ${i + 1}/${total}` : ""}
          </span>
        </button>

        {total > 1 && (
          <div
            className="flex shrink-0 gap-2 overflow-x-auto pb-1 sm:max-h-[480px] sm:flex-col sm:overflow-y-auto sm:overflow-x-visible sm:pb-0 sm:pr-1"
            role="tablist"
            aria-label="Fotos del producto"
          >
            {imagenes.map((img, n) => (
              <button
                key={img.id || img.url}
                type="button"
                role="tab"
                aria-selected={n === i}
                aria-label={`Ver foto ${n + 1}`}
                onClick={() => setI(n)}
                onMouseEnter={() => setI(n)}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-[10px] border-2 bg-white transition sm:h-[68px] sm:w-[68px] ${
                  n === i
                    ? "border-[#C2560A] ring-2 ring-[#C2560A]/20"
                    : "border-[#E7E4DC] hover:border-[#C2560A]/60"
                }`}
              >
                <Image
                  src={limpiaUrl(img.url)}
                  alt={alt(n)}
                  width={140}
                  height={140}
                  quality={60}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Foto ampliada */}
      {grande && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          role="dialog"
          aria-label={`Fotos de ${titulo}`}
          onClick={() => setGrande(false)}
          onTouchStart={(e) => {
            inicioToque.current = e.touches[0].clientX
          }}
          onTouchEnd={(e) => {
            if (inicioToque.current === null) return
            const dx = e.changedTouches[0].clientX - inicioToque.current
            inicioToque.current = null
            if (Math.abs(dx) > 50 && total > 1) ir(dx < 0 ? 1 : -1)
          }}
        >
          <Image
            src={limpiaUrl(actual.url)}
            alt={alt(i)}
            width={1600}
            height={1600}
            quality={90}
            className="max-h-[90vh] w-auto max-w-[96vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setGrande(false)}
            aria-label="Cerrar"
            className="absolute right-3 top-3 h-12 w-12 rounded-full bg-white/15 text-2xl text-white"
          >
            ×
          </button>
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  ir(-1)
                }}
                aria-label="Foto anterior"
                className="absolute left-2 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-white/15 text-2xl text-white"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  ir(1)
                }}
                aria-label="Foto siguiente"
                className="absolute right-2 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-white/15 text-2xl text-white"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
