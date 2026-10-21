"use client"

// Subir fotos al foro: se reducen en el celular antes de subir (rápido y ligero)
// Pasa por ImagenSegura: estas direcciones vienen de la base o del navegador,
// y next/image TRUENA con las que no empiezan en "/" o "https://" (una vista
// previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'

import { useRef, useState } from "react"

export type FotoSubida = { id: string; url: string }

const LADO = 1600
const MAX = 950 * 1024

async function reducir(archivo: File): Promise<{ blob: Blob; ancho: number; alto: number }> {
  const bmp = await createImageBitmap(archivo)
  const k = Math.min(1, LADO / Math.max(bmp.width, bmp.height))
  const ancho = Math.max(1, Math.round(bmp.width * k))
  const alto = Math.max(1, Math.round(bmp.height * k))
  const lienzo = document.createElement("canvas")
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext("2d")
  if (!ctx) throw new Error("sin_canvas")
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, ancho, alto)
  ctx.drawImage(bmp, 0, 0, ancho, alto)
  bmp.close?.()
  const aBlob = (tipo: string, q: number) =>
    new Promise<Blob | null>((ok) => lienzo.toBlob((b) => ok(b), tipo, q))
  for (const q of [0.82, 0.72, 0.6, 0.5]) {
    let b = await aBlob("image/webp", q)
    if (!b || b.type !== "image/webp") b = await aBlob("image/jpeg", q) // Safari viejo no hace WebP
    if (b && b.size <= MAX) return { blob: b, ancho, alto }
  }
  throw new Error("muy_grande")
}

export function SubirFotos({ fotos, onCambio, max = 6, etiqueta = "Agregar fotos" }: { fotos: FotoSubida[]; onCambio: (f: FotoSubida[]) => void; max?: number; etiqueta?: string }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(0)
  const [error, setError] = useState("")

  const elegir = async (lista: FileList | null) => {
    if (!lista) return
    setError("")
    const archivos = Array.from(lista).slice(0, Math.max(0, max - fotos.length))
    let actuales = fotos
    setSubiendo(archivos.length)
    for (const a of archivos) {
      try {
        const { blob, ancho, alto } = await reducir(a)
        const form = new FormData()
        form.append("foto", blob, blob.type === "image/webp" ? "foto.webp" : "foto.jpg")
        form.append("ancho", String(ancho))
        form.append("alto", String(alto))
        const r = await fetch("/api/foro/foto", { method: "POST", body: form })
        const j = await r.json().catch(() => ({ ok: false, error: "No se pudo subir la foto." }))
        if (!j.ok) throw new Error(j.error)
        actuales = [...actuales, { id: j.id, url: j.url }]
        onCambio(actuales)
      } catch (e) {
        const m = (e as Error).message
        setError(m === "muy_grande" || m === "sin_canvas" || !m ? "No se pudo usar esa foto. Prueba con otra (JPG o PNG)." : m)
      }
      setSubiendo((n) => n - 1)
    }
    if (entrada.current) entrada.current.value = ""
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {fotos.map((f) => (
          <div key={f.id} className="relative w-[84px] h-[84px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image src={f.url} alt="" className="w-full h-full object-cover rounded-[10px] bg-[#F1EFEA]" width={300} height={300} />
            <button
              type="button"
              onClick={() => onCambio(fotos.filter((x) => x.id !== f.id))}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#1B1B18] text-white text-[14px] leading-none flex items-center justify-center"
              aria-label="Quitar foto"
            >
              ×
            </button>
          </div>
        ))}
        {Array.from({ length: subiendo }).map((_, i) => (
          <div key={`s${i}`} className="w-[84px] h-[84px] rounded-[10px] bg-[#F1EFEA] animate-pulse" />
        ))}
        {fotos.length + subiendo < max && (
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            className="w-[84px] h-[84px] rounded-[10px] border-2 border-dashed border-[#D9D4C8] text-[#6B6A63] hover:border-[#C2560A] hover:text-[#B34D07] flex flex-col items-center justify-center gap-1 text-[11.5px] font-semibold"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            </svg>
            {etiqueta}
          </button>
        )}
      </div>
      <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple={max > 1} hidden onChange={(e) => elegir(e.target.files)} />
      {error && <span className="text-[13px] text-[#A42A2A]">{error}</span>}
    </div>
  )
}
