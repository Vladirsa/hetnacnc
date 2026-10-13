"use client"

// Panel de publicidad: inicio de sesión, lista de anuncios con estadísticas y formulario con subida de imagen.
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react"

import {
  alternarPub,
  borrarPub,
  cerrarSesionPub,
  guardarPub,
  iniciarSesionPub,
  listarPub,
} from "@/lib/publicidad/acciones"
import { ESPACIOS, ORDEN_ESPACIOS, type EspacioId, type Pieza } from "@/lib/publicidad/tipos"

type Borrador = {
  id?: string
  espacio: EspacioId
  titulo: string
  subtitulo: string
  boton: string
  enlace: string
  imagen_url: string
  imagen_movil_url: string
  video_url: string
  anunciante: string
  es_publicidad: boolean
  orden: number
  desde: string // aaaa-mm-dd
  hasta: string // aaaa-mm-dd
  activo: boolean
}

const vacio = (espacio: EspacioId): Borrador => ({
  espacio,
  titulo: "",
  subtitulo: "",
  boton: "",
  enlace: "/",
  imagen_url: "",
  imagen_movil_url: "",
  video_url: "",
  anunciante: "",
  es_publicidad: ESPACIOS[espacio].publicidad,
  orden: 1,
  desde: "",
  hasta: "",
  activo: true,
})

const deteccion = (p: Pieza): Borrador => ({
  id: p.id,
  espacio: (p.espacio in ESPACIOS ? p.espacio : "franja_inicio") as EspacioId,
  titulo: p.titulo || "",
  subtitulo: p.subtitulo || "",
  boton: p.boton || "",
  enlace: p.enlace || "/",
  imagen_url: p.imagen_url || "",
  imagen_movil_url: p.imagen_movil_url || "",
  video_url: p.video_url || "",
  anunciante: p.anunciante || "",
  es_publicidad: p.es_publicidad,
  orden: p.orden,
  desde: p.desde.slice(0, 10),
  hasta: p.hasta ? p.hasta.slice(0, 10) : "",
  activo: p.activo,
})

const estadoDe = (p: Pieza): { texto: string; color: string } => {
  const ahora = Date.now()
  if (!p.activo) return { texto: "Pausado", color: "bg-[#E7E4DC] text-[#44433D]" }
  if (Date.parse(p.desde) > ahora) return { texto: "Programado", color: "bg-[#DCEBFA] text-[#1D4E89]" }
  if (p.hasta && Date.parse(p.hasta) < ahora) return { texto: "Vencido", color: "bg-[#F8DADA] text-[#9B1C1C]" }
  return { texto: "Activo", color: "bg-[#D9F2E3] text-[#16794F]" }
}

const diasRestantes = (p: Pieza): number | null =>
  p.hasta ? Math.ceil((Date.parse(p.hasta) - Date.now()) / 86_400_000) : null

const fechaCorta = (t: string | null) => (t ? t.slice(0, 10) : "sin fin")

// Reduce la imagen en el navegador (WebP, máx. ~900 KB) para que el sitio siga rápido.
async function comprimir(archivo: File, anchoMax: number): Promise<Blob> {
  const bmp = await createImageBitmap(archivo)
  const escala = Math.min(1, anchoMax / bmp.width)
  const lienzo = document.createElement("canvas")
  lienzo.width = Math.round(bmp.width * escala)
  lienzo.height = Math.round(bmp.height * escala)
  lienzo.getContext("2d")!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height)
  const aBlob = (q: number) =>
    new Promise<Blob>((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo comprimir"))), "image/webp", q))
  let calidad = 0.85
  let blob = await aBlob(calidad)
  while (blob.size > 900 * 1024 && calidad > 0.45) {
    calidad -= 0.1
    blob = await aBlob(calidad)
  }
  return blob
}

const CAMPO = "w-full rounded-lg border border-[#D9D4C8] bg-white px-3 py-2.5 text-[15px] text-[#1B1B18]"
const ETIQ = "mb-1 block text-[13px] font-semibold text-[#44433D]"
const BTN = "rounded-xl bg-[#C2560A] px-5 py-3 text-[15px] font-bold text-white hover:bg-[#A84A08] disabled:opacity-60"
const BTN2 = "rounded-xl border border-[#D9D4C8] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#1B1B18] hover:bg-[#F6F4EF] disabled:opacity-60"

function CampoImagen({
  etiqueta,
  ayuda,
  valor,
  anchoMax,
  onCambio,
}: {
  etiqueta: string
  ayuda: string
  valor: string
  anchoMax: number
  onCambio: (url: string) => void
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState("")

  const elegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    setSubiendo(true)
    setMsg("")
    try {
      const blob = await comprimir(f, anchoMax)
      const fd = new FormData()
      fd.append("archivo", new File([blob], "banner.webp", { type: "image/webp" }))
      const r = await fetch("/api/pub/subir", { method: "POST", body: fd })
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!r.ok || !j.url) throw new Error(j.error || (r.status === 413 ? "La imagen es muy pesada para el servidor." : "No se pudo subir."))
      onCambio(j.url)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo subir la imagen.")
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div>
      <span className={ETIQ}>{etiqueta}</span>
      <p className="m-0 mb-2 text-[12.5px] text-[#6B6A63]">{ayuda}</p>
      {valor && (
        <div className="mb-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={valor} alt="Vista previa" className="h-24 max-w-[60%] rounded-lg border border-[#E7E4DC] object-cover" />
          <button type="button" className={BTN2} onClick={() => onCambio("")}>
            Quitar
          </button>
        </div>
      )}
      <label className={`${BTN2} inline-block cursor-pointer`}>
        {subiendo ? "Subiendo…" : valor ? "Cambiar imagen" : "Elegir imagen"}
        <input type="file" accept="image/*" className="hidden" onChange={elegir} disabled={subiendo} />
      </label>
      {msg && <p className="m-0 mt-2 text-[13px] font-semibold text-[#9B1C1C]">{msg}</p>}
    </div>
  )
}

export default function PanelPublicidad({ autenticadoInicial }: { autenticadoInicial: boolean }) {
  const [autenticado, setAutenticado] = useState(autenticadoInicial)
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const [editando, setEditando] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    const r = await listarPub()
    setCargando(false)
    if (r.ok) {
      setPiezas(r.piezas)
      setError("")
    } else if (r.error === "sin_sesion") {
      setAutenticado(false)
    } else {
      setError(r.error)
    }
  }, [])

  useEffect(() => {
    if (autenticado) void cargar()
  }, [autenticado, cargar])

  // ---------- Inicio de sesión ----------
  const [email, setEmail] = useState("")
  const [clave, setClave] = useState("")
  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setCargando(true)
    const r = await iniciarSesionPub(email, clave)
    setCargando(false)
    if (r.ok) {
      setClave("")
      setAutenticado(true)
    } else setError(r.error)
  }

  if (!autenticado) {
    return (
      <form onSubmit={entrar} className="mx-auto mt-6 flex max-w-[420px] flex-col gap-4 rounded-2xl border border-[#E7E4DC] bg-white p-6">
        <h1 className="m-0 text-[22px] font-bold text-[#1B1B18]">Panel de publicidad</h1>
        <p className="m-0 text-[14px] text-[#6B6A63]">Entra con el mismo correo y contraseña que usas en el /dashboard.</p>
        <div>
          <label className={ETIQ} htmlFor="pub-correo">Correo</label>
          <input id="pub-correo" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={CAMPO} />
        </div>
        <div>
          <label className={ETIQ} htmlFor="pub-clave">Contraseña</label>
          <input id="pub-clave" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} className={CAMPO} />
        </div>
        {error && <p className="m-0 text-[14px] font-semibold text-[#9B1C1C]">{error}</p>}
        <button type="submit" disabled={cargando} className={BTN}>
          {cargando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    )
  }

  // ---------- Acciones ----------
  const salir = async () => {
    await cerrarSesionPub()
    setAutenticado(false)
    setPiezas([])
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!editando) return
    setGuardando(true)
    setError("")
    const b = editando
    const r = await guardarPub({
      ...b,
      desde: b.desde ? `${b.desde}T00:00:00-06:00` : "",
      hasta: b.hasta ? `${b.hasta}T23:59:59-06:00` : "",
    })
    setGuardando(false)
    if (r.ok) {
      setEditando(null)
      await cargar()
    } else if (r.error === "sin_sesion") setAutenticado(false)
    else setError(r.error)
  }

  const alternar = async (p: Pieza) => {
    const r = await alternarPub(p.id, !p.activo)
    if (!r.ok && r.error === "sin_sesion") return setAutenticado(false)
    await cargar()
  }

  const borrar = async (p: Pieza) => {
    if (!window.confirm(`¿Borrar "${p.titulo || p.anunciante || "este anuncio"}" para siempre? Esto no se puede deshacer.`)) return
    const r = await borrarPub(p.id)
    if (!r.ok && r.error === "sin_sesion") return setAutenticado(false)
    await cargar()
  }

  const cambia = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setEditando((b) => (b ? { ...b, [k]: v } : b))

  // ---------- Formulario ----------
  if (editando) {
    const cfg = ESPACIOS[editando.espacio]
    return (
      <form onSubmit={guardar} className="flex flex-col gap-5 rounded-2xl border border-[#E7E4DC] bg-white p-5 md:p-7">
        <h1 className="m-0 text-[22px] font-bold text-[#1B1B18]">{editando.id ? "Editar anuncio" : "Nuevo anuncio"}</h1>

        <div>
          <label className={ETIQ} htmlFor="pub-espacio">¿Dónde se va a mostrar?</label>
          <select
            id="pub-espacio"
            className={CAMPO}
            value={editando.espacio}
            onChange={(e) => {
              const esp = e.target.value as EspacioId
              setEditando((b) => (b ? { ...b, espacio: esp, es_publicidad: ESPACIOS[esp].publicidad } : b))
            }}
          >
            {ORDEN_ESPACIOS.map((id) => (
              <option key={id} value={id}>
                {ESPACIOS[id].nombre}
              </option>
            ))}
          </select>
          <p className="m-0 mt-1.5 text-[13px] text-[#6B6A63]">{cfg.ayuda}</p>
          <p className="m-0 mt-1 text-[13px] font-semibold text-[#B34D07]">Medida recomendada: {cfg.medidas} · caben {cfg.max} a la vez</p>
        </div>

        <CampoImagen
          etiqueta="Imagen"
          ayuda="Se reduce sola a WebP para que cargue rápido. Si la imagen ya trae el texto, deja vacíos título y botón."
          valor={editando.imagen_url}
          anchoMax={cfg.anchoMax}
          onCambio={(u) => cambia("imagen_url", u)}
        />

        {editando.espacio === "carrusel_principal" && (
          <>
            <CampoImagen
              etiqueta="Imagen para celular (opcional)"
              ayuda="Versión más vertical, 800 × 900 px aprox. Si no la subes, se usa la misma imagen."
              valor={editando.imagen_movil_url}
              anchoMax={900}
              onCambio={(u) => cambia("imagen_movil_url", u)}
            />
            <div>
              <label className={ETIQ} htmlFor="pub-video">Video MP4 (opcional)</label>
              <input id="pub-video" className={CAMPO} placeholder="https://…/video.mp4 (corto, menos de 5 MB)" value={editando.video_url} onChange={(e) => cambia("video_url", e.target.value)} />
            </div>
          </>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={ETIQ} htmlFor="pub-titulo">Título (opcional)</label>
            <input id="pub-titulo" className={CAMPO} maxLength={140} value={editando.titulo} onChange={(e) => cambia("titulo", e.target.value)} />
          </div>
          <div>
            <label className={ETIQ} htmlFor="pub-boton">Texto del botón (opcional)</label>
            <input id="pub-boton" className={CAMPO} maxLength={40} placeholder="Ej. Ver ofertas" value={editando.boton} onChange={(e) => cambia("boton", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={ETIQ} htmlFor="pub-sub">Subtítulo (opcional)</label>
          <input id="pub-sub" className={CAMPO} maxLength={300} value={editando.subtitulo} onChange={(e) => cambia("subtitulo", e.target.value)} />
        </div>
        <div>
          <label className={ETIQ} htmlFor="pub-enlace">¿A dónde lleva al hacer clic?</label>
          <input id="pub-enlace" required className={CAMPO} placeholder="/talleres/mi-taller  ó  https://sitio-del-anunciante.com" value={editando.enlace} onChange={(e) => cambia("enlace", e.target.value)} />
          <p className="m-0 mt-1 text-[12.5px] text-[#6B6A63]">Dentro del sitio empieza con /  ·  Fuera del sitio empieza con https://</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={ETIQ} htmlFor="pub-anunciante">Anunciante (taller o empresa)</label>
            <input id="pub-anunciante" className={CAMPO} maxLength={120} value={editando.anunciante} onChange={(e) => cambia("anunciante", e.target.value)} />
          </div>
          <div>
            <label className={ETIQ} htmlFor="pub-orden">Orden (1 aparece primero)</label>
            <input id="pub-orden" type="number" min={0} max={99} className={CAMPO} value={editando.orden} onChange={(e) => cambia("orden", Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className={ETIQ} htmlFor="pub-desde">Empieza el (vacío = hoy)</label>
            <input id="pub-desde" type="date" className={CAMPO} value={editando.desde} onChange={(e) => cambia("desde", e.target.value)} />
          </div>
          <div>
            <label className={ETIQ} htmlFor="pub-hasta">Termina el (vacío = sin fecha de fin)</label>
            <input id="pub-hasta" type="date" className={CAMPO} value={editando.hasta} onChange={(e) => cambia("hasta", e.target.value)} />
          </div>
        </div>

        <label className="flex items-start gap-3 text-[14.5px] text-[#1B1B18]">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={editando.es_publicidad} onChange={(e) => cambia("es_publicidad", e.target.checked)} />
          <span>
            <strong>Es publicidad de un tercero</strong>
            <br />
            <span className="text-[13px] text-[#6B6A63]">Muestra la etiqueta "Publicidad" sobre la imagen (recomendado cuando el anunciante paga).</span>
          </span>
        </label>
        <label className="flex items-center gap-3 text-[14.5px] text-[#1B1B18]">
          <input type="checkbox" className="h-5 w-5" checked={editando.activo} onChange={(e) => cambia("activo", e.target.checked)} />
          <strong>Activo (visible en el sitio)</strong>
        </label>

        {error && <p className="m-0 text-[14px] font-semibold text-[#9B1C1C]">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={guardando} className={BTN}>
            {guardando ? "Guardando…" : "Guardar anuncio"}
          </button>
          <button type="button" className={BTN2} onClick={() => { setEditando(null); setError("") }}>
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  // ---------- Lista ----------
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-[24px] font-bold text-[#1B1B18]">Panel de publicidad</h1>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={BTN} onClick={() => setEditando(vacio("franja_inicio"))}>
            + Nuevo anuncio
          </button>
          <button type="button" className={BTN2} onClick={salir}>
            Salir
          </button>
        </div>
      </div>

      {error && <p className="m-0 rounded-lg bg-[#F8DADA] p-3 text-[14px] font-semibold text-[#9B1C1C]">{error}</p>}
      {cargando && <p className="m-0 text-[14px] text-[#6B6A63]">Cargando…</p>}

      {ORDEN_ESPACIOS.map((id) => {
        const cfg = ESPACIOS[id]
        const lista = piezas.filter((p) => p.espacio === id)
        const vigentes = lista.filter((p) => estadoDe(p).texto === "Activo").length
        return (
          <section key={id} className="rounded-2xl border border-[#E7E4DC] bg-white p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="m-0 text-[17px] font-bold text-[#1B1B18]">{cfg.nombre}</h2>
                <p className="m-0 mt-0.5 text-[13px] text-[#6B6A63]">
                  {cfg.medidas} · {vigentes} de {cfg.max} activos
                </p>
              </div>
              <button type="button" className={BTN2} onClick={() => setEditando(vacio(id))}>
                + Agregar aquí
              </button>
            </div>

            {lista.length === 0 ? (
              <p className="m-0 mt-3 text-[14px] text-[#9A978C]">Sin anuncios. Se muestra el contenido de siempre.</p>
            ) : (
              <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
                {lista.map((p) => {
                  const est = estadoDe(p)
                  const dias = diasRestantes(p)
                  const porVencer = est.texto === "Activo" && dias !== null && dias <= 7
                  const ctr = p.vistas > 0 ? ((p.clics / p.vistas) * 100).toFixed(1) : "0.0"
                  return (
                    <li key={p.id} className="flex flex-col gap-3 rounded-xl border border-[#EFECE5] p-3 md:flex-row md:items-center">
                      {p.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagen_url} alt="" className="h-20 w-full rounded-lg bg-[#F1EFEA] object-cover md:w-40" />
                      ) : (
                        <span className="flex h-20 w-full items-center justify-center rounded-lg bg-[#F1EFEA] text-[12px] text-[#9A978C] md:w-40">Sin imagen</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="truncate text-[15px] text-[#1B1B18]">{p.titulo || p.anunciante || "(sin título)"}</strong>
                          <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${est.color}`}>{est.texto}</span>
                          {p.es_publicidad && <span className="rounded-full bg-[#FDEEE1] px-2 py-0.5 text-[11.5px] font-bold text-[#B34D07]">Publicidad</span>}
                        </div>
                        <p className="m-0 mt-1 text-[13px] text-[#6B6A63]">
                          {p.anunciante ? `${p.anunciante} · ` : ""}
                          {fechaCorta(p.desde)} → {fechaCorta(p.hasta)} · orden {p.orden}
                        </p>
                        <p className="m-0 mt-1 text-[13px] text-[#44433D]">
                          {p.vistas} vistas · {p.clics} clics · {ctr}% de clics
                        </p>
                        {porVencer && (
                          <p className="m-0 mt-1 text-[13px] font-bold text-[#B34D07]">
                            {dias! <= 0 ? "Vence hoy" : `Vence en ${dias} día${dias === 1 ? "" : "s"}`} — es buen momento de ofrecerle renovar.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={BTN2} onClick={() => setEditando(deteccion(p))}>Editar</button>
                        <button type="button" className={BTN2} onClick={() => alternar(p)}>{p.activo ? "Pausar" : "Activar"}</button>
                        <button type="button" className={`${BTN2} text-[#9B1C1C]`} onClick={() => borrar(p)}>Borrar</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}

      <section className="rounded-2xl border border-dashed border-[#D9D4C8] bg-[#FAF9F6] p-4 text-[14px] text-[#44433D]">
        <strong>Próxima etapa:</strong> cobro a anunciantes con Mercado Pago, mensajes a talleres ofreciendo el servicio de publicidad y avisos automáticos para renovar antes de que termine.
      </section>
    </div>
  )
}
