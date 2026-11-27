"use client"

// Formulario para comprar publicidad en HETNA. Cuatro pasos: quién se anuncia,
// dónde, cómo paga (por periodo o por vistas) y el anuncio. La imagen se revisa
// y se reduce en el navegador (WebP liviano) antes de enviarse. El pago se hace
// en Mercado Pago; el anuncio sale cuando HETNA lo revisa.

// Pasa por ImagenSegura: estas direcciones vienen de la base o del navegador,
// y next/image TRUENA con las que no empiezan en "/" o "https://" (una vista
// previa "blob:", por ejemplo).
import { T } from "@/components/hetna/i18n/Idioma"
import { ImagenSegura as Imagen } from "@/components/hetna/ImagenSegura"

import { useMemo, useState } from "react"

import { calcularMonto, miles, montoVistas, PAQUETES_VISTAS, pesos, PLANES } from "@/lib/publicidad/precios"
import { enlaceInterno, TIPOS_ANUNCIANTE, type EspacioId, type TipoAnunciante, nombreCorto } from "@/lib/publicidad/tipos"

export type EspacioVenta = {
  id: EspacioId
  nombre: string
  donde: string
  medidas: string
  anchoMax: number
  ratio: string
  max: number
  precio: number // 30 días
  milVistas: number // precio por 1,000 vistas
  vistasMes: number | null // vistas reales al mes de un anuncio en este espacio (null = espacio nuevo)
}

const campo = "w-full border border-[#E0DCD2] rounded-[10px] px-3.5 py-3 text-[15px] bg-white focus:outline-none focus:border-[#C2560A]"
const paso = "m-0 text-[20px] font-bold text-[#1B1B18]"

/** "unos 3 meses", "unas 2 semanas"… a partir de las vistas reales del espacio. */
function cuantoTarda(vistas: number, vistasMes: number | null): string {
  if (!vistasMes) return "Espacio nuevo: aún no hay datos para estimar el tiempo."
  const dias = (vistas / vistasMes) * 30
  if (dias < 14) return `Al ritmo actual, unos ${Math.max(1, Math.round(dias))} días.`
  if (dias < 60) return `Al ritmo actual, unas ${Math.round(dias / 7)} semanas.`
  if (dias < 365 * 2) return `Al ritmo actual, unos ${Math.round(dias / 30)} meses.`
  return `Al ritmo actual tardaría más de 2 años: mejor elige un paquete más chico o pago por periodo.`
}

export default function FormAnunciate({ espacios, inicial }: { espacios: EspacioVenta[]; inicial?: string }) {
  const [tipo, setTipo] = useState<TipoAnunciante>("cnc")
  const [espacioId, setEspacioId] = useState<EspacioId>(espacios.find((e) => e.id === inicial)?.id || espacios[0].id)
  const [modalidad, setModalidad] = useState<"periodo" | "vistas">("periodo")
  const [dias, setDias] = useState(30)
  const [vistas, setVistas] = useState<number>(PAQUETES_VISTAS[0])
  const [enlace, setEnlace] = useState("")
  const [imagen, setImagen] = useState<Blob | null>(null)
  const [vista, setVista] = useState("")
  const [errorImg, setErrorImg] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)

  const espacio = useMemo(() => espacios.find((e) => e.id === espacioId)!, [espacios, espacioId])
  const total = modalidad === "vistas" ? montoVistas(espacio.id, vistas) : calcularMonto(espacio.id, dias)
  const enlaceMal = tipo === "cnc" && enlace.trim() !== "" && !enlaceInterno(enlace.trim())

  const elegirArchivo = async (archivo: File | undefined) => {
    setErrorImg("")
    setImagen(null)
    setVista("")
    if (!archivo) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) return setErrorImg("Usa una imagen JPG, PNG o WebP.")
    const url = URL.createObjectURL(archivo)
    // window.Image: el "Image" de este archivo es el componente de imágenes, no el del navegador
    const img = new window.Image()
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
    if (enlaceMal) return setError("Como taller o proveedor CNC, tu anuncio debe llevar a una página de HETNA (empieza con / o con https://hetnacnc.com).")
    if (!imagen) return setError("Sube la imagen de tu anuncio.")
    const datos = new FormData(e.currentTarget)
    datos.set("tipo_anunciante", tipo)
    datos.set("espacio", espacio.id)
    datos.set("modalidad", modalidad)
    datos.set("dias", String(dias))
    datos.set("vistas", String(vistas))
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

  const opcion = (activo: boolean) =>
    `cursor-pointer border rounded-[12px] p-4 flex flex-col gap-1 text-left ${activo ? "border-[#C2560A] bg-[#FFF6EE]" : "border-[#E0DCD2] bg-white hover:border-[#C9C3B6]"}`

  return (
    <form onSubmit={enviar} className="bg-white border border-[#E7E4DC] rounded-[16px] p-5 sm:p-6 flex flex-col gap-5" id="comprar">
      <h2 className={paso}><T>1. ¿Quién se anuncia?</T></h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Tipo de anunciante">
        {(Object.keys(TIPOS_ANUNCIANTE) as TipoAnunciante[]).map((t) => (
          <button type="button" role="radio" aria-checked={tipo === t} key={t} onClick={() => setTipo(t)} className={opcion(tipo === t)}>
            <span className="font-bold text-[15px] text-[#1B1B18]"><T>{TIPOS_ANUNCIANTE[t].nombre}</T></span>
            <span className="text-[13px] text-[#6B6A63]"><T>{TIPOS_ANUNCIANTE[t].ayuda}</T></span>
          </button>
        ))}
      </div>

      <h2 className={paso}><T>2. Elige tu espacio</T></h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Espacio">
        {espacios.map((e) => (
          <button
            type="button"
            role="radio"
            aria-checked={espacioId === e.id}
            key={e.id}
            className={opcion(espacioId === e.id)}
            onClick={() => {
              setEspacioId(e.id)
              setImagen(null)
              setVista("")
              setErrorImg("")
            }}
          >
            <span className="font-bold text-[15px] text-[#1B1B18]">{nombreCorto(e.nombre)}</span>
            <span className="text-[13px] leading-snug text-[#44433D]"><T>{e.donde}</T></span>
            <span className="text-[12.5px] text-[#6B6A63]">
              <T>Medidas:</T> <T>{e.medidas}</T> · <T>{e.vistasMes ? `≈ ${miles(e.vistasMes)} vistas al mes` : "espacio nuevo"}</T>
            </span>
            <span className="text-[15px] font-bold text-[#B34D07]"><T>desde</T> {pesos(calcularMonto(e.id, 7))} <T>/ semana</T></span>
          </button>
        ))}
      </div>

      <h2 className={paso}><T>3. ¿Cómo quieres pagar?</T></h2>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Forma de pago">
        <button type="button" role="radio" aria-checked={modalidad === "periodo"} onClick={() => setModalidad("periodo")} className={opcion(modalidad === "periodo")}>
          <span className="font-bold text-[15px] text-[#1B1B18]"><T>Por tiempo</T></span>
          <span className="text-[13px] text-[#6B6A63]"><T>Tu anuncio sale los días que elijas.</T></span>
        </button>
        <button type="button" role="radio" aria-checked={modalidad === "vistas"} onClick={() => setModalidad("vistas")} className={opcion(modalidad === "vistas")}>
          <span className="font-bold text-[15px] text-[#1B1B18]"><T>Por vistas</T></span>
          <span className="text-[13px] text-[#6B6A63]"><T>Pagas un paquete y sale hasta cumplirlo, tarde lo que tarde.</T></span>
        </button>
      </div>

      {modalidad === "periodo" ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PLANES.map((p) => (
            <button
              type="button"
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className={`min-h-[44px] px-3 py-2.5 rounded-[10px] border text-left ${dias === p.dias ? "bg-[#C2560A] border-[#C2560A] text-white" : "bg-white border-[#E0DCD2] text-[#44433D]"}`}
            >
              <span className="block text-[14.5px] font-bold"><T>{p.etiqueta}</T></span>
              <span className="block text-[13px]">{pesos(calcularMonto(espacio.id, p.dias))}</span>
              {p.nota && <span className={`block text-[11.5px] ${dias === p.dias ? "text-white/85" : "text-[#6B6A63]"}`}><T>{p.nota}</T></span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PAQUETES_VISTAS.map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setVistas(v)}
                className={`min-h-[44px] px-3 py-2.5 rounded-[10px] border text-left ${vistas === v ? "bg-[#C2560A] border-[#C2560A] text-white" : "bg-white border-[#E0DCD2] text-[#44433D]"}`}
              >
                <span className="block text-[14.5px] font-bold">{miles(v)} <T>vistas</T></span>
                <span className="block text-[13px]">{pesos(montoVistas(espacio.id, v))}</span>
              </button>
            ))}
          </div>
          <p className="m-0 text-[13px] text-[#44433D]">
            {pesos(espacio.milVistas)} <T>por cada 1,000 vistas.</T> {cuantoTarda(vistas, espacio.vistasMes)} <T>Si tarda más, tu anuncio sigue saliendo sin costo hasta cumplir.</T>
          </p>
        </div>
      )}

      <h2 className={paso}><T>4. Tu anuncio</T></h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input name="anunciante" required maxLength={120} placeholder={tipo === "cnc" ? "Nombre de tu taller o empresa" : "Nombre de tu marca o empresa"} className={campo} />
        <input name="nombre" maxLength={120} placeholder="Tu nombre" className={campo} />
        <input name="correo" type="email" required maxLength={160} placeholder="Correo (aquí te mandamos tu panel)" className={campo} />
        <input name="telefono" maxLength={30} placeholder="Teléfono (opcional)" className={campo} />
        <div className="sm:col-span-2 flex flex-col gap-1">
          <input
            name="enlace"
            required
            maxLength={1000}
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder={tipo === "cnc" ? "A dónde lleva el clic: /talleres/tu-taller o /products/tu-producto" : "A dónde lleva el clic: https://tu-pagina.com"}
            className={`${campo} ${enlaceMal ? "border-[#A42A2A]" : ""}`}
            aria-invalid={enlaceMal}
          />
          <span className={`text-[12.5px] ${enlaceMal ? "text-[#A42A2A]" : "text-[#6B6A63]"}`}>
            <T>{tipo === "cnc"
              ? "Los talleres y proveedores CNC llevan el clic a su perfil, sus productos o su taller dentro de HETNA: así los pedidos y pagos quedan protegidos."
              : "Puede ser tu propia página (https://…)."}</T>
          </span>
        </div>
        <input name="titulo" maxLength={140} placeholder="Título del anuncio (opcional)" className={campo} />
        <input name="boton" maxLength={40} placeholder="Texto del botón (opcional)" className={campo} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[14px] font-semibold text-[#1B1B18]" htmlFor="archivo-anuncio">
          <T>Imagen (</T><T>{espacio.medidas}</T>)
        </label>
        <input id="archivo-anuncio" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => elegirArchivo(e.target.files?.[0])} className="text-[14px]" />
        {errorImg && <p className="m-0 text-[13.5px] text-[#A42A2A]"><T>{errorImg}</T></p>}
        {vista && <Imagen src={vista} alt="Vista previa de tu anuncio" className="w-full max-w-[520px] rounded-[10px] border border-[#E7E4DC]" width={300} height={300} />}
      </div>

      <label className="flex items-start gap-2 text-[13.5px] text-[#44433D]">
        <input type="checkbox" name="aceptar" className="mt-1" />
        <span>
          <T>Entiendo que HETNA revisa cada anuncio antes de publicarlo (normalmente en 24 horas) y puede rechazar los que sean engañosos, ofensivos, de productos
          prohibidos o, en el caso de talleres y proveedores CNC, los que lleven fuera de HETNA. Si no se aprueba, se reembolsa completo.</T>
        </span>
      </label>

      <div className="flex items-center justify-between gap-4 flex-wrap border-t border-[#F0EDE6] pt-4">
        <div className="flex flex-col">
          <span className="text-[13px] text-[#6B6A63]"><T>Total a pagar</T></span>
          <span className="text-[26px] font-bold text-[#1B1B18]">{pesos(total)}</span>
          <span className="text-[12.5px] text-[#6B6A63]">
            <T>{modalidad === "vistas" ? `${miles(vistas)} vistas en ${nombreCorto(espacio.nombre)}` : `${dias} días en ${nombreCorto(espacio.nombre)}`}</T>
          </span>
        </div>
        <button type="submit" disabled={enviando} className="min-h-[48px] bg-[#C2560A] hover:bg-[#A84A08] text-white font-bold px-7 py-3.5 rounded-[12px] text-[16px] disabled:opacity-60">
          <T>{enviando ? "Abriendo el pago…" : "Pagar con Mercado Pago"}</T>
        </button>
      </div>
      {error && (
        <p role="alert" className="m-0 text-[14px] text-[#A42A2A]">
          <T>{error}</T>
        </p>
      )}
    </form>
  )
}
