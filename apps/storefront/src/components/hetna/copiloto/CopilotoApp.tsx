"use client"

// Pasa por ImagenSegura: estas direcciones vienen de la base o del navegador,
// y next/image TRUENA con las que no empiezan en "/" o "https://" (una vista
// previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { copilotoEstado, copilotoGuardarMaquinas, copilotoPreguntar } from "@/lib/copiloto/acciones"
import { analizarDxf, analizarGcode, analizarStl, tipoArchivo, type Analisis } from "@/lib/copiloto/archivos"
import { CALCULADORAS, ejecutar, type Calculo, type Maquina, type Resultado } from "@/lib/copiloto/motor"

import { usarAltoLibre } from "../usarAltoLibre"
import { Markdown } from "./Markdown"
import { TarjetaResultado } from "./Tarjetas"

// Copiloto IA CNC de HETNA: chat especializado en CNC + calculadoras + "Mi maquina".
// Va debajo del encabezado de la tienda y ocupa todo el ancho y el alto que queda libre.

type Vista = "copiloto" | "calculadoras" | "maquina"
type Msg = {
  id: string
  rol: "usuario" | "copiloto"
  texto: string
  calculos?: Calculo[]
  archivo?: Pick<Analisis, "titulo" | "filas" | "avisos">
  imagen?: string
  error?: boolean
}
type Pendiente =
  | { tipo: "archivo"; analisis: Analisis }
  | { tipo: "imagen"; media: string; datos: string; vista: string; nombre: string }
  | null
type Estado = { sesion: boolean; iaActiva: boolean; plan: string; usadas: number; limite: number }

const LS_CHAT = "hetna-copiloto-chat-v1"
const LS_MAQ = "hetna-copiloto-maquinas-v1"
const LS_ACTIVA = "hetna-copiloto-activa-v1"

const leerLS = <T,>(k: string, def: T): T => {
  try {
    const v = window.localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : def
  } catch {
    return def
  }
}
const guardarLS = (k: string, v: unknown) => {
  try {
    window.localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* sin espacio o bloqueado: no pasa nada */
  }
}
const nuevoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

const SUGERENCIAS = [
  "Tengo MDF de 18 mm, fresa de 6 mm y spindle de 2.2 kW. ¿Con qué parámetros corto?",
  "¿Por qué se quema la madera cuando corto con el router?",
  "¿Qué velocidad y potencia uso para acrílico de 6 mm en un láser de 80 W?",
  "Plasma de 45 A en lámina de 1/4\": velocidad y altura",
  "¿Cómo configuro el cambio de herramienta manual en Mach3?",
  "Me sale 'soft limit' en GRBL al arrancar el trabajo, ¿qué reviso?",
  "¿Cuánto cobro por 20 letreros de MDF de 30 × 60 cm?",
  "¿Qué fresa uso para cortar ACM (Alucobond) y para doblarlo?",
]

const CAPACIDADES = [
  ["Parámetros de corte", "RPM, avance, pasadas y potencia para router, láser, plasma, fibra y 3D."],
  ["Diagnóstico", "Quemado, fundido, fresa rota, escoria, vibración, errores del controlador."],
  ["Lee tus archivos", "G-code, DXF y STL: medidas, tiempo y problemas antes de cortar."],
  ["Fotos", "Sube una foto del corte o de la pantalla de error y te dice qué pasa."],
  ["Software", "Mach3, GRBL, Vectric, Fusion, ArtCAM, LightBurn, RDWorks y más."],
  ["Costos", "Del tiempo de máquina al precio de venta con margen e IVA."],
]

const TIPOS_MAQUINA = [
  { v: "router", t: "Router CNC" },
  { v: "fresadora", t: "Fresadora / centro de maquinado" },
  { v: "torno", t: "Torno CNC" },
  { v: "laser_co2", t: "Láser CO₂" },
  { v: "fibra", t: "Láser de fibra" },
  { v: "plasma", t: "Plasma CNC" },
  { v: "impresora_3d", t: "Impresora 3D" },
]
const CONTROLADORES = ["Mach3", "Mach4", "GRBL (UGS, Candle, gSender)", "NcStudio", "DSP RichAuto", "UCCNC", "LinuxCNC", "Ruida (RDWorks / LightBurn)", "EZCAD", "Marlin / Klipper"]
const PROGRAMAS = ["Vectric VCarve / Aspire", "Autodesk Fusion", "ArtCAM", "Carveco", "SheetCAM", "Mastercam", "LightBurn", "RDWorks", "EZCAD", "Inkscape", "Cura / PrusaSlicer / Orca"]
const NOMBRE_PLAN: Record<string, string> = { anonimo: "Sin cuenta", gratis: "Gratis", prueba: "Prueba", taller: "Taller", pro: "Pro", industrial: "Industrial" }

// Resumen corto de un mensaje anterior para que la IA recuerde el contexto
const paraHistorial = (m: Msg) => {
  let t = m.texto
  if (m.archivo) t += `\n[Adjuntó ${m.archivo.titulo}: ${m.archivo.filas.slice(0, 7).map((f) => `${f.etiqueta} ${f.valor}`).join("; ")}]`
  if (m.imagen) t += "\n[Adjuntó una foto]"
  if (m.calculos && m.calculos.length)
    t += `\n[Cálculos mostrados al usuario: ${m.calculos
      .map((c) => `${c.resultado.titulo}: ${c.resultado.filas.slice(0, 8).map((f) => `${f.etiqueta} ${f.valor}`).join(", ")}`)
      .join(" | ")}]`
  return t
}

const comprimirImagen = async (file: File) => {
  const bmp = await createImageBitmap(file)
  const dibujar = (lado: number, q: number) => {
    const e = Math.min(1, lado / Math.max(bmp.width, bmp.height))
    const c = document.createElement("canvas")
    c.width = Math.round(bmp.width * e)
    c.height = Math.round(bmp.height * e)
    const ctx = c.getContext("2d")
    if (!ctx) throw new Error("canvas")
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    return c.toDataURL("image/jpeg", q)
  }
  let lado = 1400
  let q = 0.82
  let url = dibujar(lado, q)
  for (let i = 0; i < 5 && url.length > 750_000; i++) {
    lado *= 0.8
    q = Math.max(0.5, q - 0.08)
    url = dibujar(lado, q)
  }
  const vista = dibujar(320, 0.7)
  return { media: "image/jpeg", datos: url.split(",")[1], vista }
}

export const CopilotoApp = ({ locale, vistaInicial = "copiloto" }: { locale: string; vistaInicial?: Vista }) => {
  const [vista, setVista] = useState<Vista>(vistaInicial)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [mensajes, setMensajes] = useState<Msg[]>([])
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [activaId, setActivaId] = useState("")
  const [entrada, setEntrada] = useState("")
  const [pendiente, setPendiente] = useState<Pendiente>(null)
  const [cargando, setCargando] = useState(false)
  const [aviso, setAviso] = useState("")
  const [listo, setListo] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)
  const archivoRef = useRef<HTMLInputElement>(null)
  const textoRef = useRef<HTMLTextAreaElement>(null)
  const aqui = `/${locale}/servicios/copiloto-ia-cnc`
  const volver = encodeURIComponent(aqui)

  const maquina = useMemo(() => maquinas.find((m) => m.id === activaId) || null, [maquinas, activaId])

  const cajaRef = usarAltoLibre<HTMLElement>()

  // carga inicial: conversacion y maquinas guardadas + estado de la cuenta
  useEffect(() => {
    setMensajes(leerLS<Msg[]>(LS_CHAT, []))
    const locales = leerLS<Maquina[]>(LS_MAQ, [])
    setMaquinas(locales)
    setActivaId(leerLS<string>(LS_ACTIVA, locales[0]?.id || ""))
    setListo(true)
    copilotoEstado()
      .then((e) => {
        setEstado({ sesion: e.sesion, iaActiva: e.iaActiva, plan: e.plan, usadas: e.usadas, limite: e.limite })
        if (e.sesion && e.maquinas.length) {
          setMaquinas(e.maquinas)
          setActivaId((a) => (e.maquinas.some((m) => m.id === a) ? a : e.maquinas[0].id))
        } else if (e.sesion && locales.length) copilotoGuardarMaquinas(locales).catch(() => {})
      })
      .catch(() => setEstado({ sesion: false, iaActiva: false, plan: "anonimo", usadas: 0, limite: 0 }))
  }, [])

  useEffect(() => {
    if (!listo) return
    guardarLS(LS_CHAT, mensajes.slice(-40).map((m) => (m.imagen && m.imagen.length > 60_000 ? { ...m, imagen: undefined } : m)))
  }, [mensajes, listo])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [mensajes, cargando])

  const guardarMaquinas = useCallback(
    (lista: Maquina[], activa: string) => {
      setMaquinas(lista)
      setActivaId(activa)
      guardarLS(LS_MAQ, lista)
      guardarLS(LS_ACTIVA, activa)
      if (estado?.sesion) copilotoGuardarMaquinas(lista).catch(() => {})
    },
    [estado?.sesion]
  )

  const adjuntar = async (file: File) => {
    setAviso("")
    const tipo = tipoArchivo(file.name)
    try {
      if (!tipo) {
        setAviso("Puedo leer G-code (.nc, .tap, .gcode…), DXF, STL y fotos (JPG, PNG).")
        return
      }
      if (tipo === "imagen") {
        const img = await comprimirImagen(file)
        setPendiente({ tipo: "imagen", ...img, nombre: file.name })
      } else if (tipo === "stl") {
        if (file.size > 80_000_000) return setAviso("El STL pesa más de 80 MB; exporta uno más ligero.")
        setPendiente({ tipo: "archivo", analisis: analizarStl(file.name, await file.arrayBuffer()) })
      } else {
        if (file.size > 30_000_000) return setAviso("El archivo pesa más de 30 MB.")
        const t = await file.text()
        setPendiente({
          tipo: "archivo",
          analisis: tipo === "dxf" ? analizarDxf(file.name, t) : analizarGcode(file.name, t, maquina?.rapido || 5000),
        })
      }
      textoRef.current?.focus()
    } catch {
      setAviso(tipo === "imagen" ? "No pude abrir la foto. Si es HEIC (iPhone), mándala como JPG." : "No pude leer ese archivo.")
    }
  }

  const enviar = async (textoForzado?: string) => {
    const texto = (textoForzado ?? entrada).trim() || (pendiente ? (pendiente.tipo === "imagen" ? "¿Qué ves en esta foto y qué me recomiendas?" : "Revisa este archivo: ¿tiene problemas y cuánto tarda?") : "")
    if (!texto || cargando) return
    setAviso("")
    const msg: Msg = { id: nuevoId(), rol: "usuario", texto }
    if (pendiente?.tipo === "archivo") msg.archivo = { titulo: pendiente.analisis.titulo, filas: pendiente.analisis.filas, avisos: pendiente.analisis.avisos }
    if (pendiente?.tipo === "imagen") msg.imagen = pendiente.vista
    const previos = mensajes.filter((m) => !m.error)
    setMensajes((ms) => [...ms, msg])
    setEntrada("")
    const adj = pendiente
    setPendiente(null)

    if (estado && !estado.iaActiva) {
      setMensajes((ms) => [...ms, { id: nuevoId(), rol: "copiloto", texto: "El Copiloto IA se está activando. Mientras, usa la pestaña **Calculadoras**: dan los mismos números que usa la IA.", error: true }])
      return
    }
    setCargando(true)
    try {
      const r = await copilotoPreguntar({
        mensajes: [...previos, msg].map((m) => ({ rol: m.rol, texto: m.id === msg.id ? m.texto : paraHistorial(m) })),
        adjunto: adj ? (adj.tipo === "imagen" ? { tipo: "imagen", media: adj.media, datos: adj.datos } : { tipo: "archivo", texto: adj.analisis.texto }) : null,
        maquina,
      })
      if (r.ok) {
        setMensajes((ms) => [...ms, { id: nuevoId(), rol: "copiloto", texto: r.texto, calculos: r.calculos }])
        setEstado((e) => (e ? { ...e, usadas: r.uso.usadas, limite: r.uso.limite, plan: r.uso.plan } : e))
      } else {
        setMensajes((ms) => [...ms, { id: nuevoId(), rol: "copiloto", texto: r.mensaje, error: true }])
        if ("uso" in r && r.uso) setEstado((e) => (e ? { ...e, usadas: r.uso.usadas, limite: r.uso.limite } : e))
      }
    } catch {
      setMensajes((ms) => [...ms, { id: nuevoId(), rol: "copiloto", texto: "Se perdió la conexión. Intenta de nuevo.", error: true }])
    } finally {
      setCargando(false)
    }
  }

  const preguntarSobre = (r: Resultado) => {
    setVista("copiloto")
    const resumen = r.filas.map((f) => `${f.etiqueta}: ${f.valor}`).join("; ")
    setEntrada(`Calculé "${r.titulo}" y me dio: ${resumen}. ¿Qué me recomiendas y qué debo vigilar?`)
    setTimeout(() => textoRef.current?.focus(), 50)
  }

  const nuevaConversacion = () => {
    setMensajes([])
    setPendiente(null)
    setAviso("")
  }

  const restantes = estado ? Math.max(0, estado.limite - estado.usadas) : null
  const agotado = estado ? estado.iaActiva && restantes === 0 : false

  return (
    <main ref={cajaRef} className="w-full flex flex-col bg-[#FAF9F6] text-[#1B1B18] overflow-hidden">
      {/* Barra del Copiloto (debajo del encabezado de la tienda) */}
      <div className="shrink-0 bg-white border-b border-[#E7E4DC]">
        <div className="px-4 lg:px-8 flex items-center gap-2 lg:gap-4 min-h-[50px]">
          <span className="hidden sm:flex items-center gap-2 font-display font-bold text-[16px] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#C2560A]" aria-hidden="true" />
            Copiloto IA CNC
          </span>
          <nav className="flex items-center self-stretch overflow-x-auto scrollbar-hide" aria-label="Secciones del Copiloto">
            {(["copiloto", "calculadoras", "maquina"] as Vista[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                className={`h-full px-3 text-[13.5px] font-semibold border-b-2 whitespace-nowrap ${vista === v ? "border-[#C2560A] text-[#1B1B18]" : "border-transparent text-[#6B6A63] hover:text-[#1B1B18]"}`}
              >
                {v === "copiloto" ? "Chat" : v === "calculadoras" ? "Calculadoras" : `Mi máquina${maquina ? `: ${maquina.nombre}` : ""}`}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {estado && estado.iaActiva && (
              <span className="hidden md:inline text-[12px] bg-[#FAF6EF] border border-[#E7E4DC] rounded-full px-2.5 py-1 text-[#6B6A63]" title="Preguntas que te quedan">
                {NOMBRE_PLAN[estado.plan] || estado.plan} · te quedan {restantes} {estado.sesion ? "este mes" : "hoy"}
              </span>
            )}
            {estado && !estado.sesion && (
              <a href={`/${locale}/register?volver=${volver}`} className="text-[12.5px] font-semibold bg-[#C2560A] hover:bg-[#A84A08] text-white px-3 py-1.5 rounded-lg whitespace-nowrap">Crear cuenta gratis</a>
            )}
          </div>
        </div>
      </div>

      {vista === "copiloto" && (
        <section className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[880px] mx-auto px-4 py-5 flex flex-col gap-4">
              {mensajes.length === 0 ? (
                <Bienvenida estado={estado} onSugerencia={(s) => enviar(s)} onAdjuntar={() => archivoRef.current?.click()} locale={locale} volver={volver} />
              ) : (
                mensajes.map((m) => <Burbuja key={m.id} m={m} onPreguntar={preguntarSobre} />)
              )}
              {cargando && (
                <div className="flex items-center gap-2 text-[14px] text-[#6B6A63]" role="status">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#C2560A] animate-pulse" />
                  El Copiloto está calculando…
                </div>
              )}
              {agotado && !cargando && (
                <div className="bg-[#FDEEE1] border border-[#F2C9A4] rounded-[12px] p-4 text-[14px] flex flex-wrap items-center gap-3">
                  <span className="flex-1 min-w-[220px]">
                    {estado?.sesion
                      ? "Se acabaron tus preguntas de este mes. Las calculadoras siguen gratis."
                      : "Se acabaron las preguntas sin cuenta de hoy. Crea tu cuenta gratis para tener 20 al mes."}
                  </span>
                  {!estado?.sesion ? (
                    <a href={`/${locale}/register?volver=${volver}`} className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2 rounded-lg">Crear cuenta gratis</a>
                  ) : (
                    <a href={`/${locale}/servicios/cotizador-cnc#planes`} className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2 rounded-lg">Ver planes</a>
                  )}
                </div>
              )}
              <div ref={finRef} />
            </div>
          </div>

          {/* Barra para escribir */}
          <div className="shrink-0 border-t border-[#E7E4DC] bg-white">
            <div className="max-w-[880px] mx-auto px-3 sm:px-4 py-3 flex flex-col gap-2">
              {pendiente && (
                <div className="flex items-center gap-3 bg-[#FAF9F6] border border-[#E7E4DC] rounded-[10px] px-3 py-2 text-[13px]">
                  {pendiente.tipo === "imagen" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <Image src={pendiente.vista} alt="" className="w-12 h-12 object-cover rounded-md" width={300} height={300} />
                  ) : (
                    <span className="font-mono text-[11px] bg-[#142033] text-white px-2 py-1 rounded">{pendiente.analisis.tipo.toUpperCase()}</span>
                  )}
                  <span className="flex-1 min-w-0 truncate">
                    {pendiente.tipo === "imagen" ? pendiente.nombre : `${pendiente.analisis.nombre} · ${pendiente.analisis.filas[0]?.valor || ""}`}
                    {pendiente.tipo === "archivo" && pendiente.analisis.avisos.length > 0 && (
                      <span className="text-[#B34D07]"> · {pendiente.analisis.avisos.length} aviso(s)</span>
                    )}
                  </span>
                  <button type="button" onClick={() => setPendiente(null)} className="text-[#6B6A63] hover:text-[#1B1B18] px-1" aria-label="Quitar archivo">✕</button>
                </div>
              )}
              {aviso && <p className="m-0 text-[13px] text-[#B34D07]">{aviso}</p>}
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => archivoRef.current?.click()}
                  className="shrink-0 w-11 h-11 rounded-[10px] border border-[#E7E4DC] hover:border-[#C2560A] flex items-center justify-center text-[#6B6A63]"
                  aria-label="Adjuntar G-code, DXF, STL o foto"
                  title="Adjuntar G-code, DXF, STL o foto"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12.5l-8.5 8.5a5 5 0 0 1-7-7L14 5.5a3.5 3.5 0 0 1 5 5L10.5 19a2 2 0 0 1-3-3L15 8.5" /></svg>
                </button>
                <input
                  ref={archivoRef}
                  type="file"
                  className="hidden"
                  accept=".nc,.tap,.gcode,.gc,.ngc,.cnc,.txt,.mpf,.nci,.iso,.dxf,.stl,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) adjuntar(f)
                    e.target.value = ""
                  }}
                />
                <label htmlFor="copiloto-texto" className="sr-only">Tu pregunta</label>
                <textarea
                  id="copiloto-texto"
                  ref={textoRef}
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      enviar()
                    }
                  }}
                  rows={1}
                  placeholder={maquina ? `Pregunta sobre tu ${maquina.nombre}…` : "Ej. MDF 18 mm, fresa 6 mm, spindle 2.2 kW"}
                  className="flex-1 min-h-[44px] max-h-[160px] resize-none rounded-[10px] border border-[#E7E4DC] focus:border-[#C2560A] focus:outline-none px-3 py-2.5 text-[15px] leading-snug"
                />
                <button
                  type="button"
                  onClick={() => enviar()}
                  disabled={cargando || (!entrada.trim() && !pendiente)}
                  className="shrink-0 h-11 px-4 rounded-[10px] bg-[#C2560A] hover:bg-[#A84A08] disabled:opacity-40 text-white font-semibold text-[14px]"
                >
                  Enviar
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#6B6A63]">
                <span>
                  {maquina ? (
                    <>Usando: <button type="button" className="font-semibold text-[#B34D07] hover:underline" onClick={() => setVista("maquina")}>{maquina.nombre}</button></>
                  ) : (
                    <button type="button" className="font-semibold text-[#B34D07] hover:underline" onClick={() => setVista("maquina")}>Registra tu máquina</button>
                  )}
                </span>
                <span>Los valores son un punto de partida: confirma con un corte de prueba.</span>
                {mensajes.length > 0 && (
                  <button type="button" onClick={nuevaConversacion} className="ml-auto font-semibold hover:text-[#1B1B18]">Nueva conversación</button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {vista === "calculadoras" && (
        <section className="flex-1 overflow-y-auto">
          <Calculadoras maquina={maquina} onPreguntar={preguntarSobre} />
        </section>
      )}

      {vista === "maquina" && (
        <section className="flex-1 overflow-y-auto">
          <MisMaquinas maquinas={maquinas} activaId={activaId} sesion={!!estado?.sesion} onGuardar={guardarMaquinas} onListo={() => setVista("copiloto")} />
        </section>
      )}
    </main>
  )
}

// ---------------------------------------------------------------------
const Bienvenida = ({
  estado,
  onSugerencia,
  onAdjuntar,
  locale,
  volver,
}: {
  estado: Estado | null
  onSugerencia: (s: string) => void
  onAdjuntar: () => void
  locale: string
  volver: string
}) => (
  <div className="flex flex-col gap-6 py-2 lg:py-6">
    <div className="flex flex-col gap-2">
      <span className="self-start text-[11.5px] font-bold tracking-wide uppercase bg-[#FDEEE1] text-[#B34D07] px-3 py-1 rounded-full">IA especializada en CNC</span>
      <h1 className="m-0 font-display text-[28px] lg:text-[38px] leading-[1.1] font-bold">Pregúntale lo que sea a tu CNC</h1>
      <p className="m-0 text-[15px] lg:text-[16.5px] text-[#4A4943] max-w-[680px]">
        Dime tu material, herramienta y máquina, y te doy los parámetros de arranque y te digo qué datos faltan. También lee tu G-code, DXF, STL o una foto del problema.
      </p>
    </div>
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] font-semibold text-[#6B6A63]">Prueba con:</p>
      <div className="flex flex-wrap gap-2">
        {SUGERENCIAS.map((s) => (
          <button key={s} type="button" onClick={() => onSugerencia(s)} className="text-left text-[13.5px] bg-white border border-[#E7E4DC] hover:border-[#C2560A] rounded-[10px] px-3 py-2">
            {s}
          </button>
        ))}
        <button type="button" onClick={onAdjuntar} className="text-left text-[13.5px] bg-[#142033] text-white rounded-[10px] px-3 py-2 font-semibold">
          Revisar mi G-code / DXF / foto →
        </button>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {CAPACIDADES.map(([t, d]) => (
        <div key={t} className="bg-white border border-[#E7E4DC] rounded-[12px] p-4">
          <p className="m-0 font-bold text-[14.5px]">{t}</p>
          <p className="m-0 mt-1 text-[13px] text-[#6B6A63] leading-relaxed">{d}</p>
        </div>
      ))}
    </div>
    {estado && !estado.iaActiva && (
      <p className="m-0 text-[13.5px] bg-[#FDEEE1] border border-[#F2C9A4] rounded-[10px] px-4 py-3">
        El chat con IA se está activando. Ya puedes usar las <strong>Calculadoras</strong> (arriba): son las mismas cuentas que usa el Copiloto.
      </p>
    )}
    {estado && estado.iaActiva && !estado.sesion && (
      <p className="m-0 text-[13.5px] text-[#6B6A63]">
        Sin cuenta tienes {estado.limite} preguntas al día.{" "}
        <a className="font-semibold text-[#B34D07] underline" href={`/${locale}/register?volver=${volver}`}>Crea tu cuenta gratis</a> para 20 al mes y guardar tu máquina. Planes de HetNa Taller: Taller 200, Pro 600 e Industrial 2,000 preguntas al mes.
      </p>
    )}
  </div>
)

const Burbuja = ({ m, onPreguntar }: { m: Msg; onPreguntar: (r: Resultado) => void }) => {
  if (m.rol === "usuario")
    return (
      <div className="self-end max-w-[88%] flex flex-col items-end gap-2">
        {m.imagen && (
          // eslint-disable-next-line @next/next/no-img-element
          <Image src={m.imagen} alt="Foto adjunta" className="max-w-[220px] rounded-[10px] border border-[#E7E4DC]" width={300} height={300} />
        )}
        {m.archivo && <TarjetaResultado r={m.archivo} />}
        <div className="bg-[#142033] text-white rounded-[14px] rounded-br-[4px] px-4 py-2.5 text-[15px] whitespace-pre-wrap">{m.texto}</div>
      </div>
    )
  return (
    <div className="self-start w-full flex flex-col gap-3">
      {(m.calculos || []).map((c, i) => (
        <TarjetaResultado key={i} r={c.resultado} onPreguntar={undefined} />
      ))}
      <div className={`rounded-[14px] rounded-bl-[4px] px-4 py-3 text-[15px] ${m.error ? "bg-[#FDEEE1] border border-[#F2C9A4]" : "bg-white border border-[#E7E4DC]"}`}>
        <Markdown texto={m.texto} />
      </div>
      {m.calculos && m.calculos.length > 0 && (
        <button type="button" onClick={() => onPreguntar(m.calculos![m.calculos!.length - 1].resultado)} className="self-start text-[12.5px] font-semibold text-[#B34D07] hover:underline">
          Ajustar este cálculo →
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
const Calculadoras = ({ maquina, onPreguntar }: { maquina: Maquina | null; onPreguntar: (r: Resultado) => void }) => {
  const [id, setId] = useState(CALCULADORAS[0].id)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [res, setRes] = useState<Resultado | null>(null)
  const calc = CALCULADORAS.find((c) => c.id === id) || CALCULADORAS[0]

  const elegir = (nuevo: string) => {
    setId(nuevo)
    setRes(null)
    const c = CALCULADORAS.find((x) => x.id === nuevo)
    const v: Record<string, string> = {}
    if (c) for (const f of c.campos) {
      if (f.tipo === "opcion" && f.opciones && f.req) v[f.k] = f.opciones[0].v
      if (maquina && f.deMaquina && maquina[f.deMaquina] !== undefined && maquina[f.deMaquina] !== "") v[f.k] = String(maquina[f.deMaquina])
    }
    setValores(v)
  }
  useEffect(() => {
    elegir(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maquina?.id])

  return (
    <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[22px] font-bold">Calculadoras CNC</h1>
        <p className="m-0 text-[13px] text-[#6B6A63] mb-2">Gratis y sin límite. Son las mismas cuentas que usa el Copiloto.</p>
        {CALCULADORAS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => elegir(c.id)}
            className={`text-left rounded-[12px] border px-4 py-3 ${c.id === id ? "border-[#C2560A] bg-white shadow-[0_2px_10px_rgba(194,86,10,0.12)]" : "border-[#E7E4DC] bg-white hover:border-[#C2560A]"}`}
          >
            <span className="block font-semibold text-[14.5px]">{c.nombre}</span>
            <span className="block text-[12.5px] text-[#6B6A63] leading-snug mt-0.5">{c.resumen}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <form
          className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setRes(ejecutar(calc.id, valores, maquina))
          }}
        >
          <div>
            <h2 className="m-0 font-display text-[20px] font-bold">{calc.nombre}</h2>
            {maquina && <p className="m-0 mt-1 text-[12.5px] text-[#6B6A63]">Datos de tu máquina ({maquina.nombre}) ya cargados.</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {calc.campos.map((f) => (
              <label key={f.k} className="flex flex-col gap-1 text-[13px]">
                <span className="font-semibold text-[#4A4943]">
                  {f.etiqueta}
                  {f.unidad ? <span className="font-normal text-[#6B6A63]"> ({f.unidad})</span> : null}
                  {f.req ? <span className="text-[#C2560A]"> *</span> : null}
                </span>
                {f.tipo === "opcion" ? (
                  <select
                    value={valores[f.k] || ""}
                    onChange={(e) => setValores((v) => ({ ...v, [f.k]: e.target.value }))}
                    className="h-10 rounded-[8px] border border-[#E7E4DC] px-2 bg-white text-[14px]"
                  >
                    {!f.req && <option value="">—</option>}
                    {(f.opciones || []).map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                  </select>
                ) : (
                  <input
                    inputMode="decimal"
                    value={valores[f.k] || ""}
                    onChange={(e) => setValores((v) => ({ ...v, [f.k]: e.target.value }))}
                    className="h-10 rounded-[8px] border border-[#E7E4DC] px-3 text-[14px] font-mono"
                    placeholder={f.ayuda || ""}
                  />
                )}
              </label>
            ))}
          </div>
          <button type="submit" className="self-start bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-6 py-2.5 rounded-[10px]">Calcular</button>
        </form>
        {res && <TarjetaResultado r={res} onPreguntar={() => onPreguntar(res)} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
const CAMPOS_TIPO: Record<string, (keyof Maquina)[]> = {
  router: ["potencia_kw", "rpm_min", "rpm_max", "avance_max", "rapido"],
  fresadora: ["potencia_kw", "rpm_min", "rpm_max", "avance_max", "rapido"],
  torno: ["potencia_kw", "rpm_max"],
  laser_co2: ["potencia_w", "avance_max"],
  fibra: ["potencia_w", "potencia_kw"],
  plasma: ["amperaje", "avance_max"],
  impresora_3d: [],
}
const ETIQUETAS: Partial<Record<keyof Maquina, string>> = {
  potencia_kw: "Potencia del spindle / fuente (kW)",
  potencia_w: "Potencia del láser (W)",
  amperaje: "Amperaje (A)",
  rpm_min: "RPM mínimas",
  rpm_max: "RPM máximas",
  avance_max: "Avance máximo de corte (mm/min)",
  rapido: "Velocidad de rápidos (mm/min)",
}

const MisMaquinas = ({
  maquinas,
  activaId,
  sesion,
  onGuardar,
  onListo,
}: {
  maquinas: Maquina[]
  activaId: string
  sesion: boolean
  onGuardar: (l: Maquina[], activa: string) => void
  onListo: () => void
}) => {
  const vacia = (): Maquina => ({ id: nuevoId(), nombre: "", tipo: "router" })
  const [edit, setEdit] = useState<Maquina>(() => maquinas.find((m) => m.id === activaId) || vacia())
  const [ok, setOk] = useState("")

  const cambiar = (k: keyof Maquina, v: string) => {
    setOk("")
    const numerico = ["potencia_kw", "potencia_w", "amperaje", "rpm_min", "rpm_max", "avance_max", "rapido"].includes(k)
    setEdit((e) => ({ ...e, [k]: numerico ? (v === "" ? undefined : Number(v.replace(",", "."))) : v }))
  }
  const guardar = () => {
    const m = { ...edit, nombre: (edit.nombre || "").trim() || TIPOS_MAQUINA.find((t) => t.v === edit.tipo)?.t || "Mi máquina" }
    const lista = maquinas.some((x) => x.id === m.id) ? maquinas.map((x) => (x.id === m.id ? m : x)) : [...maquinas, m]
    onGuardar(lista, m.id)
    setEdit(m)
    setOk(sesion ? "Guardada en tu cuenta." : "Guardada en este navegador. Crea tu cuenta para tenerla en todos tus dispositivos.")
  }
  const borrar = () => {
    const lista = maquinas.filter((x) => x.id !== edit.id)
    onGuardar(lista, lista[0]?.id || "")
    setEdit(lista[0] || vacia())
    setOk("")
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 lg:px-8 py-6 flex flex-col gap-5">
      <div>
        <h1 className="m-0 font-display text-[22px] font-bold">Mi máquina</h1>
        <p className="m-0 mt-1 text-[13.5px] text-[#6B6A63]">El Copiloto y las calculadoras usan estos datos para darte valores que tu máquina sí alcanza, sin preguntarte cada vez.</p>
      </div>
      {maquinas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {maquinas.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setEdit(m); onGuardar(maquinas, m.id); setOk("") }}
              className={`px-3 py-2 rounded-[10px] border text-[13.5px] font-semibold ${m.id === activaId ? "border-[#C2560A] bg-[#FDEEE1] text-[#B34D07]" : "border-[#E7E4DC] bg-white"}`}
            >
              {m.nombre}
            </button>
          ))}
          <button type="button" onClick={() => { setEdit(vacia()); setOk("") }} className="px-3 py-2 rounded-[10px] border border-dashed border-[#C9C4B8] text-[13.5px]">+ Otra máquina</button>
        </div>
      )}
      <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#4A4943]">Nombre</span>
          <input value={edit.nombre} onChange={(e) => cambiar("nombre", e.target.value)} placeholder="Ej. Router 1325 del taller" className="h-10 rounded-[8px] border border-[#E7E4DC] px-3 text-[14px]" />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#4A4943]">Tipo</span>
          <select value={edit.tipo} onChange={(e) => cambiar("tipo", e.target.value)} className="h-10 rounded-[8px] border border-[#E7E4DC] px-2 bg-white text-[14px]">
            {TIPOS_MAQUINA.map((t) => <option key={t.v} value={t.v}>{t.t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#4A4943]">Área de trabajo</span>
          <input value={edit.area || ""} onChange={(e) => cambiar("area", e.target.value)} placeholder="Ej. 1300 × 2500 × 200 mm" className="h-10 rounded-[8px] border border-[#E7E4DC] px-3 text-[14px]" />
        </label>
        {(CAMPOS_TIPO[edit.tipo] || []).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-[#4A4943]">{ETIQUETAS[k]}</span>
            <input inputMode="decimal" value={edit[k] === undefined ? "" : String(edit[k])} onChange={(e) => cambiar(k, e.target.value)} className="h-10 rounded-[8px] border border-[#E7E4DC] px-3 text-[14px] font-mono" />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#4A4943]">Controlador</span>
          <input list="lista-controladores" value={edit.controlador || ""} onChange={(e) => cambiar("controlador", e.target.value)} placeholder="Mach3, GRBL, DSP…" className="h-10 rounded-[8px] border border-[#E7E4DC] px-3 text-[14px]" />
          <datalist id="lista-controladores">{CONTROLADORES.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#4A4943]">Software CAM / diseño</span>
          <input list="lista-programas" value={edit.software || ""} onChange={(e) => cambiar("software", e.target.value)} placeholder="Vectric, Fusion, ArtCAM…" className="h-10 rounded-[8px] border border-[#E7E4DC] px-3 text-[14px]" />
          <datalist id="lista-programas">{PROGRAMAS.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="flex flex-col gap-1 text-[13px] sm:col-span-2">
          <span className="font-semibold text-[#4A4943]">Notas (herramientas que tienes, mesa de vacío, lubricación…)</span>
          <textarea value={edit.notas || ""} onChange={(e) => cambiar("notas", e.target.value)} rows={3} className="rounded-[8px] border border-[#E7E4DC] px-3 py-2 text-[14px]" />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button type="button" onClick={guardar} className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-6 py-2.5 rounded-[10px]">Guardar máquina</button>
          {maquinas.some((m) => m.id === edit.id) && (
            <>
              <button type="button" onClick={onListo} className="border border-[#E7E4DC] hover:border-[#C2560A] font-semibold px-5 py-2.5 rounded-[10px]">Ir al Copiloto</button>
              <button type="button" onClick={borrar} className="text-[13px] text-[#6B6A63] hover:text-[#B3261E] ml-auto">Quitar esta máquina</button>
            </>
          )}
          {ok && <span className="text-[13px] text-[#16794F]">{ok}</span>}
        </div>
      </div>
    </div>
  )
}
