"use client"

// Formulario para comprar un espacio publicitario. La imagen se revisa y se reduce en el navegador
// (WebP liviano) antes de enviarse. El pago se hace en Mercado Pago.

// Pasa por ImagenSegura: estas direcciones vienen de la base o del navegador,
// y next/image TRUENA con las que no empiezan en "/" o "https://" (una vista
// previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'

import { useMemo, useState } from "react"

export type EspacioVenta = {
  id: string
  nombre: string
  medidas: string
  anchoMax: number
  ratio: string
  max: number
  precio: number
}

const PLANES = [
  { dias: 30, etiqueta: "1 mes", descuento: 0 },
  { dias: 90, etiqueta: "3 meses (10% menos)", descuento: 0.1 },
]

const pesos = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)

const campo = "w-full border border-[#E0DCD2] rounded-[10px] px-3.5 py-3 text-[15px] bg-white focus:outline-none focus:border-[#C2560A]"

export default function FormAnunciate({ espacios, inicial }: { espacios: EspacioVenta[]; inicial?: string }) {
  const [espacioId, setEspacioId] = useState(espacios.find((e) => e.id === inicial)?.id || espacios[0].id)
  const [dias, setDias] = useState(30)
  const [imagen, setImagen] = useState<Blob | null>(null)
  const [vista, setVista] = useState("")
  const [errorImg, setErrorImg] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)

  const espacio = useMemo(() => espacios.find((e) => e.id === espacioId)!, [espacios, espacioId])
  const plan = PLANES.find((p) => p.dias === dias)!
  const total = Math.round(espacio.precio * (dias / 30) * (1 - plan.descuento))

  const elegirArchivo = async (archivo: File | undefined) => {
    setErrorImg("")
    setImagen(null)
    setVista("")
    if (!archivo) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) return setErrorImg("Usa una imagen JPG, PNG o WebP.")
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      const [rw, rh] = espacio.ratio.split("/").map((n) => Number(n.trim()))
      const esperado = rw / rh
      const real = img.naturalWidth / img.naturalHeight
      if (Math.abs(real - esperado) / esperado > 0.12) {
        URL.revokeObjectURL(url)
        return setErrorImg(`La imagen no tiene la proporción correcta. Para este espacio usa ${espacio.medidas}.`)
      }
      const ancho = Math.min(img.naturalWidth, espacio.anchoMax)
      const alto = Math.round(ancho / real)
      const lienzo = document.createElement("canvas")
      lienzo.width = ancho
      lienzo.height = alto
      lienzo.getContext("2d")!.drawImage(img, 0, 0, ancho, alto)
      const intentar = (calidad: number) =>
        lienzo.toBlob(
          (b) => {
            if (!b) return setErrorImg("No se pudo preparar la imagen.")
            if (b.size > 1_400_000 && calidad > 0.5) return intentar(calidad - 0.15)
            if (b.size > 1_400_000) return setErrorImg("La imagen es muy pesada. Usa una más simple o más pequeña.")
            setImagen(b)
            setVista(URL.createObjectURL(b))
          },
          "image/webp",
          calidad
        )
      intentar(0.85)
      URL.revokeObjectURL(url)
    }
    img.onerror = () => setErrorImg("No se pudo leer la imagen.")
    img.src = url
  }

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    if (!imagen) return setError("Sube la imagen de tu anuncio.")
    const datos = new FormData(e.currentTarget)
    datos.set("espacio", espacio.id)
    datos.set("dias", String(dias))
    datos.set("archivo", imagen, "anuncio.webp")
    datos.set("aceptar", (e.currentTarget.elements.namedItem("aceptar") as HTMLInputElement).checked ? "1" : "0")
    setEnviando(true)
    try {
      const r = await fetch("/api/pub/comprar", { method: "POST", headers: { "x-hetna-pub": "1" }, body: datos })
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!r.ok || !j.url) {
        setError(j.error || "No se pudo crear el pedido. Intenta de nuevo.")
        setEnviando(false)
        return
      }
      window.location.href = j.url
    } catch {
      setError("No hay conexión. Intenta de nuevo.")
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="bg-white border border-[#E7E4DC] rounded-[16px] p-5 sm:p-6 flex flex-col gap-5" id="comprar">
      <h2 className="m-0 text-[20px] font-bold text-[#1B1B18]">1. Elige tu espacio</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {espacios.map((e) => (
          <label
            key={e.id}
            className={`cursor-pointer border rounded-[12px] p-4 flex flex-col gap-1 ${espacioId === e.id ? "border-[#C2560A] bg-[#FFF6EE]" : "border-[#E0DCD2] bg-white"}`}
          >
            <input type="radio" name="espacio_ui" className="sr-only" checked={espacioId === e.id} onChange={() => { setEspacioId(e.id); setImagen(null); setVista(""); setErrorImg("") }} />
            <span className="font-bold text-[15px] text-[#1B1B18]">{e.nombre}</span>
            <span className="text-[13px] text-[#6B6A63]">Medidas: {e.medidas}</span>
            <span className="text-[15px] font-bold text-[#B34D07]">{pesos(e.precio)} / mes</span>
          </label>
        ))}
      </div>

      <h2 className="m-0 text-[20px] font-bold text-[#1B1B18]">2. Duración</h2>
      <div className="flex gap-3 flex-wrap">
        {PLANES.map((p) => (
          <button
            type="button"
            key={p.dias}
            onClick={() => setDias(p.dias)}
            className={`px-4 py-3 rounded-[10px] border text-[14.5px] font-semibold ${dias === p.dias ? "bg-[#C2560A] border-[#C2560A] text-white" : "bg-white border-[#E0DCD2] text-[#44433D]"}`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <h2 className="m-0 text-[20px] font-bold text-[#1B1B18]">3. Tu anuncio</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input name="anunciante" required maxLength={120} placeholder="Nombre de tu taller o empresa" className={campo} />
        <input name="nombre" maxLength={120} placeholder="Tu nombre" className={campo} />
        <input name="correo" type="email" required maxLength={160} placeholder="Correo (aquí te avisamos)" className={campo} />
        <input name="telefono" maxLength={30} placeholder="WhatsApp (opcional)" className={campo} />
        <input name="enlace" required maxLength={1000} placeholder="A dónde lleva el clic (https://... o /ruta)" className={`${campo} sm:col-span-2`} />
        <input name="titulo" maxLength={140} placeholder="Título del anuncio (opcional)" className={campo} />
        <input name="boton" maxLength={40} placeholder="Texto del botón (opcional)" className={campo} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-semibold text-[#1B1B18]">Imagen ({espacio.medidas})</label>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => elegirArchivo(e.target.files?.[0])} className="text-[14px]" />
        {errorImg && <p className="m-0 text-[13.5px] text-[#A42A2A]">{errorImg}</p>}
        {vista && (
          // eslint-disable-next-line @next/next/no-img-element
          <Image src={vista} alt="Vista previa de tu anuncio" className="w-full max-w-[520px] rounded-[10px] border border-[#E7E4DC]" width={300} height={300} />
        )}
      </div>

      <label className="flex items-start gap-2 text-[13.5px] text-[#44433D]">
        <input type="checkbox" name="aceptar" className="mt-1" />
        <span>
          Entiendo que HETNA revisa cada anuncio antes de publicarlo (normalmente en 24 horas) y puede rechazar los que sean engañosos, ofensivos o de productos prohibidos.
          Si no se aprueba, se reembolsa.
        </span>
      </label>

      <div className="flex items-center justify-between gap-4 flex-wrap border-t border-[#F0EDE6] pt-4">
        <div className="flex flex-col">
          <span className="text-[13px] text-[#6B6A63]">Total a pagar</span>
          <span className="text-[26px] font-bold text-[#1B1B18]">{pesos(total)}</span>
        </div>
        <button type="submit" disabled={enviando} className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-bold px-7 py-3.5 rounded-[12px] text-[16px] disabled:opacity-60">
          {enviando ? "Abriendo el pago…" : "Pagar con Mercado Pago"}
        </button>
      </div>
      {error && <p role="alert" className="m-0 text-[14px] text-[#A42A2A]">{error}</p>}
    </form>
  )
}
