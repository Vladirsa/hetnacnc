"use client"

// Estudio "Imagen a 3D": la pantalla para crear un modelo con IA a partir de
// una foto (o de varias vistas). Oscura y con el modelo al centro, como un
// programa de 3D, en vez de un formulario.
//
// Las fotos se reducen en el navegador (máx. 2048 px) antes de subirlas: la IA
// no gana nada con 12 MP y en datos móviles la subida baja de 8 MB a ~600 KB.
// Se abre a pantalla completa dentro del 3D Studio.

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { crearEscaneo, type Escaneo } from "@/lib/escaneos/acciones"

type Vista = "front" | "left" | "back" | "right"
type Tipo = "Normal" | "Geometry"
type Detalle = "ligero" | "normal" | "alto"

const VISTAS: { id: Vista; nombre: string }[] = [
  { id: "front", nombre: "Frente" },
  { id: "left", nombre: "Izquierda" },
  { id: "back", nombre: "Atrás" },
  { id: "right", nombre: "Derecha" },
]

const DETALLES: { id: Detalle; nombre: string; caras: string }[] = [
  { id: "ligero", nombre: "Ligero", caras: "150 mil caras" },
  { id: "normal", nombre: "Normal", caras: "400 mil caras" },
  { id: "alto", nombre: "Alto", caras: "1 millón de caras" },
]

type Foto = {
  url: string // vista local (object URL)
  estado: "subiendo" | "lista" | "error"
  llave?: string
  mensaje?: string
}

export type InfoModeloIa = { gratis_por_mes: number; usados_mes: number; creditos: number }

type Props = {
  creditosPorEscaneo?: number
  modeloIa: InfoModeloIa
  saldo: { saldo: number; ilimitado: boolean } | null
  recientes: Escaneo[]
}

const ESTATUS: Record<Escaneo["estatus"], { t: string; c: string }> = {
  pendiente: { t: "En cola", c: "bg-sky-500/15 text-sky-300" },
  procesando: { t: "Generando", c: "bg-sky-500/15 text-sky-300" },
  listo: { t: "Listo", c: "bg-emerald-500/15 text-emerald-300" },
  fallido: { t: "Falló", c: "bg-rose-500/15 text-rose-300" },
}

async function reducir(archivo: File): Promise<Blob> {
  if (archivo.size < 1.2 * 1024 * 1024) return archivo
  try {
    const img = await createImageBitmap(archivo)
    const esc = Math.min(1, 2048 / Math.max(img.width, img.height))
    const lienzo = document.createElement("canvas")
    lienzo.width = Math.round(img.width * esc)
    lienzo.height = Math.round(img.height * esc)
    lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height)
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", 0.9))
    return blob || archivo
  } catch {
    return archivo
  }
}

export function EstudioModeloIA({ modeloIa, saldo, recientes }: Props) {
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || "mx"

  const [varias, setVarias] = useState(false)
  const [fotos, setFotos] = useState<Partial<Record<Vista, Foto>>>({})
  const [tipo, setTipo] = useState<Tipo>("Normal")
  const [detalle, setDetalle] = useState<Detalle>("normal")
  const [titulo, setTitulo] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [arrastre, setArrastre] = useState<Vista | null>(null)
  const lote = useRef<string | undefined>(undefined)

  useEffect(() => () => Object.values(fotos).forEach((f) => f && URL.revokeObjectURL(f.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const gratisRestantes = Math.max(0, modeloIa.gratis_por_mes - modeloIa.usados_mes)
  const costo = saldo?.ilimitado ? 0 : gratisRestantes > 0 ? 0 : modeloIa.creditos
  const alcanza = costo === 0 || (saldo ? saldo.saldo >= costo : false)

  const vistasActivas = varias ? VISTAS : VISTAS.slice(0, 1)
  const elegidas = vistasActivas.filter((v) => fotos[v.id])
  const subiendo = elegidas.some((v) => fotos[v.id]!.estado === "subiendo")
  const listas = elegidas.filter((v) => fotos[v.id]!.estado === "lista")
  const puede = !!fotos.front && fotos.front.estado === "lista" && !subiendo && alcanza && !enviando

  const subir = async (vista: Vista, archivo: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) {
      setError("Usa una foto JPG, PNG o WebP.")
      return
    }
    setError(null)
    const url = URL.createObjectURL(archivo)
    setFotos((p) => {
      if (p[vista]) URL.revokeObjectURL(p[vista]!.url)
      return { ...p, [vista]: { url, estado: "subiendo" } }
    })
    const form = new FormData()
    form.append("foto", await reducir(archivo), archivo.name.replace(/\.\w+$/, "") + ".jpg")
    if (lote.current) form.append("lote", lote.current)
    try {
      const res = await fetch("/api/taller/foto-escaneo", { method: "POST", body: form })
      const cuerpo = await res.json().catch(() => ({}))
      if (!res.ok || !cuerpo.ok) {
        const mensaje =
          cuerpo.mensaje ||
          (res.status === 413 ? "La foto pesa demasiado" : res.status === 401 ? "Inicia sesión de nuevo" : `Error ${res.status}`)
        setFotos((p) => ({ ...p, [vista]: { url, estado: "error", mensaje } }))
        return
      }
      lote.current = lote.current || cuerpo.lote
      setFotos((p) => ({ ...p, [vista]: { url, estado: "lista", llave: cuerpo.storage_key } }))
    } catch {
      setFotos((p) => ({ ...p, [vista]: { url, estado: "error", mensaje: "Se cortó la conexión" } }))
    }
  }

  const quitar = (vista: Vista) =>
    setFotos((p) => {
      if (p[vista]) URL.revokeObjectURL(p[vista]!.url)
      const n = { ...p }
      delete n[vista]
      return n
    })

  const generar = async () => {
    if (!puede) return
    setEnviando(true)
    setError(null)
    const usar = vistasActivas.filter((v) => fotos[v.id]?.estado === "lista")
    const res = await crearEscaneo({
      modo: "preview",
      titulo: titulo.trim() || null,
      fotos: usar.map((v) => fotos[v.id]!.llave!),
      vistas: usar.map((v) => v.id),
      tipo,
      detalle,
    })
    if (!res.ok) {
      setEnviando(false)
      setError(res.mensaje)
      return
    }
    router.push(`/${locale}/user/escaneos/${res.datos.escaneo.id}`)
  }

  const ranura = (vista: { id: Vista; nombre: string }, grande?: boolean) => {
    const f = fotos[vista.id]
    return (
      <label
        key={vista.id}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastre(vista.id)
        }}
        onDragLeave={() => setArrastre(null)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastre(null)
          const a = e.dataTransfer.files?.[0]
          if (a) subir(vista.id, a)
        }}
        className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[14px] border text-center transition ${
          grande ? "aspect-square" : "aspect-[4/3]"
        } ${
          arrastre === vista.id
            ? "border-[#F07A1A] bg-[#F07A1A]/10"
            : f
              ? "border-white/10 bg-black/30"
              : "border-dashed border-white/20 bg-white/[0.03] hover:border-[#F07A1A]/70 hover:bg-white/[0.06]"
        }`}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const a = e.target.files?.[0]
            e.target.value = ""
            if (a) subir(vista.id, a)
          }}
        />
        {f ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={vista.nombre} className="absolute inset-0 h-full w-full object-contain p-2" />
            {f.estado === "subiendo" && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[13px] font-semibold">
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Subiendo…
              </span>
            )}
            {f.estado === "error" && (
              <span className="absolute inset-x-2 bottom-2 rounded-md bg-rose-600/90 px-2 py-1 text-[12px] font-semibold">
                {f.mensaje} · toca para reintentar
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                quitar(vista.id)
              }}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-[15px] leading-none hover:bg-black/80"
              aria-label={`Quitar ${vista.nombre}`}
            >
              ×
            </button>
            {!grande && (
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold">
                {vista.nombre}
              </span>
            )}
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className={`${grande ? "h-10 w-10" : "h-6 w-6"} text-white/45`} fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            <span className={`mt-2 font-semibold ${grande ? "text-[15px]" : "text-[12.5px]"}`}>
              {grande ? "Arrastra o toca para subir la foto" : vista.nombre}
              {!grande && vista.id === "front" ? " *" : ""}
            </span>
            {grande && <span className="mt-1 text-[12.5px] text-white/50">JPG, PNG o WebP · una pieza, fondo liso</span>}
          </>
        )}
      </label>
    )
  }

  const opcion = (clave: string, activa: boolean, onClick: () => void, children: React.ReactNode) => (
    <button
      key={clave}
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex-1 rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition ${
        activa ? "border-[#F07A1A] bg-[#F07A1A]/15 text-white" : "border-white/10 bg-white/[0.03] text-white/70 hover:text-white"
      }`}
    >
      {children}
    </button>
  )

  const principal = fotos.front

  return (
    <div className="flex flex-1 flex-col bg-[#0D1015] text-white">
        <div className="grid flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* Panel de control */}
          <div className="flex flex-col gap-5 border-b border-white/10 bg-[#12161D] p-4 [&>*]:shrink-0 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="m-0 text-[17px] font-bold">Imagen a 3D</h2>
                <p className="m-0 text-[12.5px] text-white/50">Modelo con IA a partir de una foto</p>
              </div>
              <LocalizedClientLink
                href="/user/creditos"
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12.5px] font-semibold hover:border-[#F07A1A]"
              >
                <span className="text-[#F07A1A]">◆</span>
                {saldo ? (saldo.ilimitado ? "Ilimitados" : `${saldo.saldo} ${saldo.saldo === 1 ? "crédito" : "créditos"}`) : "Créditos"}
              </LocalizedClientLink>
            </div>
            <div className="flex rounded-[10px] bg-white/[0.05] p-1">
              {[false, true].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setVarias(v)}
                  className={`flex-1 rounded-[8px] py-1.5 text-[13px] font-semibold transition ${
                    varias === v ? "bg-[#F07A1A] text-white" : "text-white/70 hover:text-white"
                  }`}
                >
                  {v ? "Varias vistas" : "Imagen única"}
                </button>
              ))}
            </div>

            {varias ? (
              <div>
                <div className="grid grid-cols-2 gap-2.5">
                  {VISTAS.map((v) => ranura(v))}
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-white/55">
                  El frente es obligatorio. Cada vista extra ayuda a la IA a reconstruir los lados que no se ven.
                </p>
              </div>
            ) : (
              ranura(VISTAS[0], true)
            )}

            <details className="rounded-[12px] border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white/70">
              <summary className="cursor-pointer font-semibold text-white">Consejos para un buen modelo</summary>
              <ul className="m-0 mt-2 flex list-disc flex-col gap-1 pl-4">
                <li>Una sola pieza, completa y centrada.</li>
                <li>Fondo liso de un color distinto al de la pieza.</li>
                <li>Buena luz, sin sombras fuertes ni reflejos.</li>
                <li>Foto real o render limpio; mejor de 3/4 que totalmente de frente.</li>
              </ul>
            </details>

            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-white/50">Modelo</p>
              <div className="flex gap-2">
                {opcion("n", tipo === "Normal", () => setTipo("Normal"), "Con textura")}
                {opcion("g", tipo === "Geometry", () => setTipo("Geometry"), "Sólo forma")}
              </div>
              <p className="mt-1.5 text-[12px] text-white/50">
                {tipo === "Normal" ? "Color y textura de la foto: para mostrar y vender." : "Modelo blanco: ideal para imprimir o maquinar."}
              </p>
            </div>

            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-white/50">Detalle</p>
              <div className="flex gap-2">
                {DETALLES.map((d) => opcion(d.id, detalle === d.id, () => setDetalle(d.id), d.nombre))}
              </div>
              <p className="mt-1.5 text-[12px] text-white/50">{DETALLES.find((d) => d.id === detalle)!.caras}</p>
            </div>

            <label className="block">
              <span className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-white/50">Nombre (opcional)</span>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={120}
                placeholder="Ej. Engrane de licuadora"
                className="w-full rounded-[10px] border border-white/10 bg-black/30 px-3 py-2.5 text-[14px] text-white placeholder:text-white/35 focus:border-[#F07A1A] focus:outline-none"
              />
            </label>

            <div className="rounded-[12px] border border-white/10 bg-black/25 px-3.5 py-3 text-[13px]">
              {saldo?.ilimitado ? (
                <span className="text-emerald-300">Cuenta HETNA: sin costo.</span>
              ) : costo === 0 ? (
                <span>
                  <strong className="text-emerald-300">Gratis.</strong>{" "}
                  <span className="text-white/65">
                    Te {gratisRestantes === 1 ? "queda" : "quedan"} {gratisRestantes} de {modeloIa.gratis_por_mes} este mes.
                  </span>
                </span>
              ) : (
                <span>
                  <strong>
                    Cuesta {costo} {costo === 1 ? "crédito" : "créditos"}.
                  </strong>{" "}
                  <span className="text-white/65">
                    Ya usaste tu{modeloIa.gratis_por_mes === 1 ? "" : "s"} gratis del mes. Tienes {saldo?.saldo ?? 0}.
                  </span>
                  {!alcanza && (
                    <LocalizedClientLink href="/user/creditos" className="mt-1 block font-semibold text-[#F59A4A] hover:underline">
                      Comprar créditos →
                    </LocalizedClientLink>
                  )}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={generar}
              disabled={!puede}
              className="flex items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-[#F07A1A] to-[#E0480F] px-4 py-3.5 text-[15px] font-bold shadow-[0_8px_24px_-8px_#F07A1A] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {enviando ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Enviando…
                </>
              ) : (
                <>✦ Generar modelo 3D</>
              )}
            </button>
            {error && <p className="-mt-2 text-[13px] font-semibold text-rose-300">{error}</p>}
            <p className="-mt-2 text-[11.5px] leading-relaxed text-white/40">
              Tarda de 3 a 5 minutos. La IA reconstruye la forma, no la mide: el STL sale a 100 mm por su lado más largo. Las
              fotos se procesan con Tencent Cloud (
              <LocalizedClientLink href="/aviso-de-privacidad" className="underline">
                aviso de privacidad
              </LocalizedClientLink>
              ).
            </p>
          </div>

          {/* Escenario + galería */}
          <div className="flex min-w-0 flex-col">
            <div
              className="relative flex min-h-[340px] flex-1 items-center justify-center p-6 lg:min-h-[520px]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 40%, rgba(240,122,26,0.10), transparent 60%), radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
                backgroundSize: "100% 100%, 22px 22px",
              }}
            >
              {principal ? (
                <div className="flex flex-col items-center">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={principal.url}
                      alt="Foto elegida"
                      className="max-h-[300px] max-w-full rounded-[14px] border border-white/10 object-contain shadow-2xl lg:max-h-[380px]"
                    />
                    {varias && listas.length > 1 && (
                      <span className="absolute -right-2 -top-2 rounded-full bg-[#F07A1A] px-2.5 py-1 text-[12px] font-bold">
                        {listas.length} vistas
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-[14px] text-white/70">
                    {principal.estado === "lista" ? "Foto lista. Ajusta las opciones y genera tu modelo." : principal.estado === "subiendo" ? "Subiendo foto…" : principal.mensaje}
                  </p>
                </div>
              ) : (
                <div className="max-w-[420px] text-center">
                  <svg viewBox="0 0 64 64" className="mx-auto h-20 w-20 text-white/25" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M32 6 56 19v26L32 58 8 45V19L32 6Z" />
                    <path d="M8 19l24 13 24-13M32 32v26" />
                  </svg>
                  <p className="mt-4 text-[20px] font-bold">De una foto a un modelo 3D</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/60">
                    Sube la foto de una pieza, figura o producto. La IA crea el modelo con textura en minutos y lo descargas en GLB
                    (con color) y STL (para imprimir o maquinar).
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-[#0A0C10] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-bold uppercase tracking-wider text-white/60">Mis modelos</p>
                <LocalizedClientLink href="/user/escaneos" className="text-[13px] font-semibold text-[#F59A4A] hover:underline">
                  Ver todos →
                </LocalizedClientLink>
              </div>
              {recientes.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                  {recientes.slice(0, 8).map((e) => (
                    <LocalizedClientLink
                      key={e.id}
                      href={`/user/escaneos/${e.id}`}
                      className="group overflow-hidden rounded-[12px] border border-white/10 bg-white/[0.03] hover:border-[#F07A1A]/60"
                    >
                      <div className="relative aspect-square bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/escaneos/${e.id}/miniatura`}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain p-1.5 transition group-hover:scale-[1.03]"
                          onError={(ev) => ((ev.target as HTMLImageElement).style.visibility = "hidden")}
                        />
                        <span className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTATUS[e.estatus].c}`}>
                          {ESTATUS[e.estatus].t}
                        </span>
                      </div>
                      <p className="truncate px-2.5 py-2 text-[12.5px] font-semibold text-white/85">
                        {e.titulo || (e.modo === "preview" ? "Modelo con IA" : "Escaneo")}
                      </p>
                    </LocalizedClientLink>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-white/45">Aquí aparecerán los modelos que generes.</p>
              )}
            </div>
          </div>
        </div>
    </div>
  )
}
