"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { publicarTema } from "@/lib/foro/acciones"
import { leerVideo } from "@/lib/foro/contenido"
import { MENSAJES, TIPOS_NEGOCIO, TIPOS_TEMA, type TipoTema } from "@/lib/foro/tipos"

import { AvisoSeguro } from "./AvisoSeguro"
import { PideCuenta } from "./Interaccion"
import { type FotoSubida, SubirFotos } from "./SubirFotos"

type SeccionCorta = { slug: string; nombre: string; soloNegocios: boolean }

const AYUDA_CUERPO: Record<TipoTema, string> = {
  pregunta: "Cuenta tu máquina (tamaño, spindle o láser, controlador), el material y espesor, la herramienta y qué pasa. Entre más datos, mejores respuestas.",
  debate: "Explica el tema y tu opinión. Puedes agregar una encuesta abajo.",
  trabajo: "Qué hiciste, con qué máquina, material, herramienta, tiempo y cómo lo resolviste. Sube tus mejores fotos.",
  video: "Pega la liga del video (YouTube, TikTok, Facebook o Instagram) y cuenta de qué trata.",
  novedad: "Qué ofreces, para quién es y por qué conviene. Recuerda: las ventas se cierran dentro de HETNA.",
  busco: "Qué pieza o trabajo necesitas: material, medidas, cantidad, ciudad y para cuándo. Los talleres de esa especialidad reciben aviso. Si quieres propuestas formales con precio, pídelas en Cotizar.",
  ofrezco: "Qué máquina tienes libre, cuántas horas o qué días, en qué ciudad, qué materiales y qué tamaño máximo. Los clientes te contratan dentro de HETNA.",
  evento: "De qué trata, para quién es, temario o actividades, costo (si tiene) y cómo registrarse. La fecha y el lugar van abajo.",
  vacante: "Puesto, qué máquinas o programas debe manejar, ciudad, horario, sueldo o rango y prestaciones. Los interesados se postulan con su perfil y sólo tú ves sus postulaciones.",
}

export function FormTema({ secciones, seccionInicial, tipoInicial, esNegocio }: { secciones: SeccionCorta[]; seccionInicial?: string; tipoInicial?: string; esNegocio: boolean }) {
  const router = useRouter()
  const { locale } = useParams() as { locale?: string }
  // Novedad, Ofrezco capacidad y Vacante son de negocios: talleres, proveedores y marcas.
  const tipos = (Object.keys(TIPOS_TEMA) as TipoTema[]).filter((t) => !TIPOS_NEGOCIO.includes(t) || esNegocio)
  const [tipo, setTipo] = useState<TipoTema>(tipos.includes(tipoInicial as TipoTema) ? (tipoInicial as TipoTema) : "pregunta")
  const disponibles = secciones.filter((s) => !s.soloNegocios || esNegocio)
  const [seccion, setSeccion] = useState(disponibles.some((s) => s.slug === seccionInicial) ? (seccionInicial as string) : "")
  const [titulo, setTitulo] = useState("")
  const [cuerpo, setCuerpo] = useState("")
  const [ligas, setLigas] = useState<string[]>([""])
  const [fotos, setFotos] = useState<FotoSubida[]>([])
  const [conEncuesta, setConEncuesta] = useState(false)
  const [pregunta, setPregunta] = useState("")
  const [opciones, setOpciones] = useState(["", ""])
  const [inicio, setInicio] = useState("")
  const [fin, setFin] = useState("")
  const [modalidad, setModalidad] = useState<"presencial" | "en_linea">("presencial")
  const [lugar, setLugar] = useState("")
  const [ligaEvento, setLigaEvento] = useState("")
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!seccion) return setError("Elige en qué sección va tu publicación.")
    iniciar(async () => {
      const r = await publicarTema({
        seccion,
        tipo,
        titulo,
        cuerpo,
        ligas: ligas.filter((l) => l.trim()),
        fotos: fotos.map((f) => f.id),
        encuesta: tipo === "debate" && conEncuesta ? { pregunta, opciones: opciones.filter((o) => o.trim()) } : null,
        evento: tipo === "evento" ? { inicio, fin, modalidad, lugar, liga: ligaEvento } : null,
      })
      if (!r.ok) return setError(r.error)
      const extra = r.estado === "revision" ? "?aviso=revision" : r.ocultos ? "?aviso=contacto" : ""
      router.push(`/${locale || "mx"}${r.url}${extra}`)
    })
  }

  const campo = "w-full border border-[#E0DCD2] rounded-[10px] px-3.5 py-2.5 text-[15px] bg-white focus:outline-none focus:border-[#C2560A]"
  const etiqueta = "text-[14px] font-bold text-[#1B1B18]"

  return (
    <form onSubmit={enviar} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
        <legend className={`${etiqueta} mb-2`}>¿Qué quieres publicar?</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {tipos.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => {
                setTipo(t)
                // Los eventos van, de entrada, en su comunidad
                if (t === "evento" && !seccion && disponibles.some((x) => x.slug === "eventos")) setSeccion("eventos")
              }}
              aria-pressed={tipo === t}
              className={`text-left rounded-[10px] border px-3 py-2.5 transition ${tipo === t ? "border-[#C2560A] bg-[#FDEEE1]" : "border-[#E0DCD2] bg-white hover:border-[#C2560A]"}`}
            >
              <span className="block text-[14.5px] font-bold text-[#1B1B18]">{TIPOS_TEMA[t].nombre}</span>
              <span className="block text-[12.5px] text-[#6B6A63] leading-snug">{TIPOS_TEMA[t].ayuda}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className={etiqueta}>Sección</span>
        <select value={seccion} onChange={(e) => setSeccion(e.target.value)} className={campo} required>
          <option value="">Elige una sección…</option>
          {disponibles.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className={etiqueta}>Título</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={150}
          required
          placeholder={tipo === "pregunta" ? "Ej. ¿Qué fresa uso para cortar MDF de 18 mm sin quemar el borde?" : "Escribe un título claro"}
          className={campo}
        />
        <span className="text-[12.5px] text-[#6B6A63]">Escríbelo como lo buscarías en Google. {titulo.trim().length}/150</span>
      </label>

      <label className="flex flex-col gap-2">
        <span className={etiqueta}>Detalles</span>
        <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} maxLength={20000} required rows={8} placeholder={AYUDA_CUERPO[tipo]} className={`${campo} leading-relaxed resize-y`} />
        <span className="text-[12.5px] text-[#6B6A63]">Para compartir G-code, escríbelo entre ``` y ```.</span>
      </label>

      <div className="flex flex-col gap-2">
        <span className={etiqueta}>Fotos</span>
        <SubirFotos fotos={fotos} onCambio={setFotos} max={8} />
      </div>

      <div className="flex flex-col gap-2">
        <span className={etiqueta}>Ligas y videos</span>
        {ligas.map((l, i) => {
          const v = l.trim() ? leerVideo(/^https?:\/\//.test(l.trim()) ? l.trim() : `https://${l.trim()}`) : null
          return (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={l}
                onChange={(e) => setLigas(ligas.map((x, j) => (j === i ? e.target.value : x)))}
                inputMode="url"
                placeholder="https://youtu.be/… o la liga de tu página"
                className={campo}
              />
              {v && <span className="shrink-0 text-[12px] font-bold text-[#16794F]">Video ✓</span>}
            </div>
          )
        })}
        {ligas.length < 5 && (
          <button type="button" onClick={() => setLigas([...ligas, ""])} className="self-start text-[13.5px] font-semibold text-[#B34D07] hover:underline">
            + Otra liga
          </button>
        )}
        <span className="text-[12.5px] text-[#6B6A63]">Los videos de YouTube, TikTok, Facebook e Instagram se ven dentro del tema.</span>
      </div>

      {tipo === "evento" && (
        <fieldset className="m-0 flex flex-col gap-3 rounded-[12px] border border-[#BFE0CC] bg-[#F3FAF5] p-4">
          <legend className={`${etiqueta} px-1`}>Fecha y lugar del evento</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold text-[#44433D]">
              Empieza (hora de México)
              <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} required className={campo} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold text-[#44433D]">
              Termina (opcional)
              <input type="datetime-local" value={fin} min={inicio || undefined} onChange={(e) => setFin(e.target.value)} className={campo} />
            </label>
          </div>
          <div className="flex gap-4 text-[14.5px]">
            {(["presencial", "en_linea"] as const).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="modalidad" checked={modalidad === m} onChange={() => setModalidad(m)} className="accent-[#16794F]" />
                {m === "presencial" ? "Presencial" : "En línea"}
              </label>
            ))}
          </div>
          <input
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            maxLength={150}
            required
            placeholder={modalidad === "presencial" ? "Lugar: recinto, dirección y ciudad" : "Plataforma: Zoom, YouTube, Facebook Live…"}
            className={campo}
          />
          <input
            value={ligaEvento}
            onChange={(e) => setLigaEvento(e.target.value)}
            inputMode="url"
            placeholder="Liga de registro o transmisión (opcional)"
            className={campo}
          />
        </fieldset>
      )}

      {tipo === "debate" && (
        <div className="flex flex-col gap-3 border border-[#E7E4DC] rounded-[12px] p-4 bg-[#FCFBF8]">
          <label className="flex items-center gap-2 text-[14px] font-bold cursor-pointer">
            <input type="checkbox" checked={conEncuesta} onChange={(e) => setConEncuesta(e.target.checked)} />
            Agregar encuesta
          </label>
          {conEncuesta && (
            <>
              <input value={pregunta} onChange={(e) => setPregunta(e.target.value)} maxLength={150} placeholder="Pregunta de la encuesta" className={campo} />
              {opciones.map((o, i) => (
                <input
                  key={i}
                  value={o}
                  onChange={(e) => setOpciones(opciones.map((x, j) => (j === i ? e.target.value : x)))}
                  maxLength={80}
                  placeholder={`Opción ${i + 1}`}
                  className={campo}
                />
              ))}
              {opciones.length < 6 && (
                <button type="button" onClick={() => setOpciones([...opciones, ""])} className="self-start text-[13.5px] font-semibold text-[#B34D07] hover:underline">
                  + Otra opción
                </button>
              )}
            </>
          )}
        </div>
      )}

      <AvisoSeguro compacto />

      {error && (["sin_sesion", "sin_perfil"].includes(error) ? <PideCuenta error={error} /> : <p role="alert" className="m-0 text-[14px] text-[#A42A2A]">{MENSAJES[error] || error}</p>)}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pendiente} className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-6 py-3 rounded-[10px] text-[15px] disabled:opacity-50">
          {pendiente ? "Publicando…" : "Publicar"}
        </button>
        <span className="text-[12.5px] text-[#6B6A63]">Al publicar aceptas que los teléfonos y correos se ocultan.</span>
      </div>
    </form>
  )
}
