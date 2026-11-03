"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"

import { leerArchivoCad, type GeoCad } from "@/lib/cotizador/archivo-cad"
import type { ServicioPublico, TallerPublico, TipoPublico } from "@/lib/cotizador/taller-publico"

// Cotizador en línea de un taller (hetnacnc.com/t/<slug>):
// 1) sube tu archivo  2) elige el trabajo  3) ve el precio estimado  4) manda tu solicitud.
// El archivo se mide aquí mismo (lib/cotizador/archivo-cad.ts) y se manda junto
// con la solicitud a /api/taller-publico/<slug>/solicitar.

const caja = "rounded-[18px] border border-[#E7E4DC] bg-white p-5 md:p-6"
const boton =
  "inline-flex items-center justify-center rounded-[10px] bg-[#C2560A] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-60"
const botonClaro =
  "inline-flex items-center justify-center rounded-[10px] border border-[#E7E4DC] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#1B1B18] hover:border-[#C2560A] disabled:opacity-60"
const campo =
  "w-full rounded-[10px] border border-[#E7E4DC] bg-[#FAF9F6] px-4 py-3 text-[15px] text-[#1B1B18] focus:border-[#C2560A] focus:outline-none"
const etiqueta = "mb-1 block text-[13px] font-semibold text-[#40403A]"

type Estimado =
  | { estimable: true; moneda: string; minimo: number; recomendado: number; iva_pct: number }
  | { estimable: false; motivo?: string; oculto?: boolean }

const dinero = (n: number, m: string) =>
  `$${n.toLocaleString(m === "USD" ? "en-US" : "es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${m}`
const mm = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)} m` : `${Math.round(n)} mm`)

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className={caja}>
      <h2 className="m-0 flex items-center gap-3 text-[17px] font-bold text-[#142033]">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#142033] text-[13px] text-white">{n}</span>
        {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function VistaPrevia({ geo }: { geo: GeoCad }) {
  const ancho = Math.max(geo.largo, 1)
  const alto = Math.max(geo.ancho, 1)
  const trazo = Math.max(ancho, alto) / 300
  return (
    <svg
      viewBox={`${-trazo * 4} ${-trazo * 4} ${ancho + trazo * 8} ${alto + trazo * 8}`}
      className="h-[220px] w-full rounded-[12px] bg-[#FAF9F6]"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Vista previa de tu pieza"
    >
      <g transform={`translate(0 ${alto}) scale(1 -1)`} fill="none" stroke="#142033" strokeWidth={trazo} strokeLinejoin="round" strokeLinecap="round">
        {geo.trazos.map((t, i) => (
          <polyline key={i} points={t.map(([x, y]) => `${x},${y}`).join(" ")} />
        ))}
      </g>
    </svg>
  )
}

export function CotizadorEnLinea({ taller }: { taller: TallerPublico }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [geo, setGeo] = useState<GeoCad | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState("")
  const [manual, setManual] = useState({ largo: "", ancho: "", alto: "" })
  const [servicio, setServicio] = useState<ServicioPublico | null>(taller.servicios.length === 1 ? taller.servicios[0] : null)
  const [tipo, setTipo] = useState<TipoPublico | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [estimado, setEstimado] = useState<Estimado | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [datos, setDatos] = useState({ nombre: "", telefono: "", correo: "", empresa: "", mensaje: "", sitio_web: "" })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [listo, setListo] = useState("")
  const entrada = useRef<HTMLInputElement>(null)

  const aceptar = taller.extensiones.map((e) => `.${e}`).join(",")

  // Medidas: las del archivo o las que escribió el cliente
  const medidas = useMemo(() => {
    if (geo)
      return {
        largo: geo.largo,
        ancho: geo.ancho,
        alto: geo.alto,
        corte_mm: geo.corte_mm,
        perforaciones: geo.perforaciones,
        volumen_cm3: geo.volumen_cm3,
      }
    const n = (v: string) => Math.max(0, parseFloat(v.replace(",", ".")) || 0)
    return { largo: n(manual.largo), ancho: n(manual.ancho), alto: n(manual.alto) }
  }, [geo, manual])

  const elegirArchivo = async (f: File | null) => {
    setErrorArchivo("")
    setGeo(null)
    setArchivo(null)
    if (!f) return
    const ext = f.name.split(".").pop()?.toLowerCase() || ""
    if (!taller.extensiones.includes(ext)) {
      setErrorArchivo(`Ese tipo de archivo no se acepta. Usa: ${taller.extensiones.join(", ").toUpperCase()}.`)
      return
    }
    if (f.size > taller.max_mb * 1024 * 1024) {
      setErrorArchivo(`El archivo pesa más de ${taller.max_mb} MB.`)
      return
    }
    setArchivo(f)
    setLeyendo(true)
    try {
      setGeo(await leerArchivoCad(f))
    } catch (e) {
      setErrorArchivo(`${(e as Error).message} Puedes escribir las medidas a mano.`)
    } finally {
      setLeyendo(false)
    }
  }

  // Si el archivo es 3D, sugerir el tipo de trabajo que pide medidas 3D
  useEffect(() => {
    if (!servicio) return setTipo(null)
    if (tipo && servicio.tipos.some((x) => x.id === tipo.id)) return
    const preferido = geo ? servicio.tipos.find((x) => x.medidas === geo.tipo && x.estimable) : null
    setTipo(preferido || servicio.tipos[0] || null)
  }, [servicio, geo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Precio estimado (con una pausa para no pedirlo en cada tecla)
  useEffect(() => {
    setEstimado(null)
    if (!servicio || !tipo) return
    if (!tipo.estimable) {
      setEstimado({ estimable: false, motivo: "Este trabajo se cotiza a mano: el taller revisa tu archivo y te manda el precio." })
      return
    }
    const sinMedidas = !(medidas.largo > 0 && medidas.ancho > 0)
    if (sinMedidas) return
    const t = setTimeout(async () => {
      setCalculando(true)
      try {
        const r = await fetch(`/api/taller-publico/${taller.slug}/estimar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ servicio_id: servicio.id, tipo_id: tipo.id, cantidad, medidas }),
        })
        const d = await r.json().catch(() => ({}))
        setEstimado(r.ok ? (d as Estimado) : { estimable: false, motivo: d.error || "No pudimos calcular el precio." })
      } catch {
        setEstimado({ estimable: false, motivo: "No pudimos calcular el precio ahora; el taller te lo manda." })
      } finally {
        setCalculando(false)
      }
    }, 450)
    return () => clearTimeout(t)
  }, [servicio, tipo, cantidad, medidas, taller.slug])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (!datos.nombre.trim()) return setError("Escribe tu nombre.")
    if (datos.telefono.replace(/\D/g, "").length < 10 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo.trim()))
      return setError("Déjanos tu WhatsApp (10 dígitos) o tu correo para mandarte la cotización.")
    setEnviando(true)
    try {
      const fd = new FormData()
      Object.entries(datos).forEach(([k, v]) => fd.append(k, v))
      fd.append("cantidad", String(cantidad))
      if (servicio) fd.append("servicio_id", servicio.id)
      if (tipo) fd.append("tipo_id", tipo.id)
      fd.append("medidas", JSON.stringify(medidas))
      if (archivo) fd.append("archivo", archivo)
      const r = await fetch(`/api/taller-publico/${taller.slug}/solicitar`, { method: "POST", body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || d.message || "No se pudo mandar. Intenta de nuevo.")
      setListo(d.mensaje || "¡Listo! El taller recibió tu solicitud.")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const wa = taller.whatsapp
    ? `https://wa.me/${taller.whatsapp.length === 10 ? "52" + taller.whatsapp : taller.whatsapp}?text=${encodeURIComponent(
        `Hola ${taller.nombre}, vi su cotizador en línea en hetnacnc.com`
      )}`
    : ""

  const encabezado = (
    <section className={caja}>
      <div className="flex flex-wrap items-center gap-4">
        {taller.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={taller.logo} alt={taller.nombre} className="h-16 w-16 rounded-[12px] object-contain" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[13px] uppercase tracking-wide text-[#7A776E]">Cotiza en línea{taller.ciudad ? ` · ${taller.ciudad}` : ""}</p>
          <h1 className="m-0 text-[24px] font-bold leading-tight text-[#142033] md:text-[28px]">{taller.titulo}</h1>
          {taller.descripcion ? <p className="m-0 mt-1 whitespace-pre-line text-[15px] text-[#40403A]">{taller.descripcion}</p> : null}
        </div>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener" className={botonClaro}>
            WhatsApp
          </a>
        ) : null}
      </div>
      {taller.servicios.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {taller.servicios.map((s) => (
            <span key={s.id} className="rounded-full bg-[#F3F2EE] px-3 py-1 text-[13px] text-[#40403A]">
              {s.emoji} {s.nombre}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )

  if (listo) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {encabezado}
        <section className={`${caja} text-center`}>
          <p className="m-0 text-[44px] leading-none" aria-hidden="true">
            ✅
          </p>
          <h2 className="m-0 mt-3 text-[22px] font-bold text-[#142033]">¡Solicitud enviada!</h2>
          <p className="m-0 mt-2 text-[15px] leading-relaxed text-[#40403A]">{listo}</p>
          <button
            type="button"
            className={`${botonClaro} mt-5`}
            onClick={() => {
              setListo("")
              setArchivo(null)
              setGeo(null)
              setEstimado(null)
            }}
          >
            Cotizar otra pieza
          </button>
        </section>
      </div>
    )
  }

  const tresD = tipo?.medidas === "3d" || geo?.tipo === "3d"

  return (
    <form onSubmit={enviar} className="mx-auto max-w-3xl space-y-4" noValidate>
      {encabezado}

      <Paso n={1} titulo="Sube tu archivo">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            elegirArchivo(e.dataTransfer.files?.[0] || null)
          }}
          className="flex flex-col items-center justify-center rounded-[14px] border-2 border-dashed border-[#E7E4DC] bg-[#FAF9F6] px-4 py-6 text-center"
        >
          <p className="m-0 text-[15px] text-[#40403A]">
            {archivo ? (
              <b className="break-all text-[#1B1B18]">{archivo.name}</b>
            ) : (
              <>Arrastra aquí tu DXF, SVG, STL u OBJ (también PDF, STEP o imagen)</>
            )}
          </p>
          <button type="button" className={`${botonClaro} mt-3`} onClick={() => entrada.current?.click()}>
            {archivo ? "Cambiar archivo" : "Elegir archivo"}
          </button>
          <input
            ref={entrada}
            type="file"
            accept={aceptar}
            className="hidden"
            onChange={(e) => elegirArchivo(e.target.files?.[0] || null)}
          />
          <p className="m-0 mt-2 text-[12px] text-[#7A776E]">Máximo {taller.max_mb} MB. Tu archivo sólo lo ve el taller.</p>
        </div>
        {leyendo ? <p className="m-0 mt-3 text-[14px] text-[#7A776E]">Midiendo tu pieza…</p> : null}
        {errorArchivo ? <p className="m-0 mt-3 text-[14px] text-[#B42318]">{errorArchivo}</p> : null}

        {geo ? (
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
            <VistaPrevia geo={geo} />
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px] md:grid-cols-1">
              <div>
                <dt className="text-[12px] uppercase tracking-wide text-[#7A776E]">Medidas</dt>
                <dd className="m-0 font-semibold text-[#1B1B18]">
                  {Math.round(geo.largo)} × {Math.round(geo.ancho)}
                  {geo.tipo === "3d" ? ` × ${Math.round(geo.alto)}` : ""} mm
                </dd>
              </div>
              {geo.tipo === "2d" ? (
                <>
                  <div>
                    <dt className="text-[12px] uppercase tracking-wide text-[#7A776E]">Corte total</dt>
                    <dd className="m-0 font-semibold text-[#1B1B18]">{mm(geo.corte_mm)}</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] uppercase tracking-wide text-[#7A776E]">Perforaciones</dt>
                    <dd className="m-0 font-semibold text-[#1B1B18]">{geo.perforaciones}</dd>
                  </div>
                </>
              ) : geo.volumen_cm3 > 0 ? (
                <div>
                  <dt className="text-[12px] uppercase tracking-wide text-[#7A776E]">Volumen</dt>
                  <dd className="m-0 font-semibold text-[#1B1B18]">{geo.volumen_cm3.toFixed(1)} cm³</dd>
                </div>
              ) : null}
            </dl>
            {geo.avisos.length ? (
              <p className="m-0 text-[12px] text-[#8A3D06] md:col-span-2">{geo.avisos.join(" ")}</p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            <p className="m-0 mb-2 text-[13px] text-[#7A776E]">
              {archivo ? "No pudimos medir este archivo. " : "¿Sin archivo? "}Escribe las medidas aproximadas de tu pieza (mm):
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["largo", "ancho", ...(tresD ? ["alto"] : [])] as ("largo" | "ancho" | "alto")[]).map((k) => (
                <label key={k}>
                  <span className={etiqueta}>{k[0].toUpperCase() + k.slice(1)}</span>
                  <input
                    className={campo}
                    inputMode="decimal"
                    value={manual[k]}
                    onChange={(e) => setManual({ ...manual, [k]: e.target.value })}
                    placeholder="mm"
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </Paso>

      <Paso n={2} titulo="¿Qué trabajo necesitas?">
        {taller.servicios.length ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {taller.servicios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setServicio(s)}
                  className={`rounded-[12px] border px-4 py-3 text-left transition ${
                    servicio?.id === s.id ? "border-[#C2560A] bg-[#FFF4EA]" : "border-[#E7E4DC] bg-white hover:border-[#C2560A]"
                  }`}
                >
                  <span className="block text-[15px] font-semibold text-[#1B1B18]">
                    {s.emoji} {s.nombre}
                  </span>
                  {s.descripcion ? <span className="mt-0.5 block text-[12px] text-[#7A776E]">{s.descripcion}</span> : null}
                </button>
              ))}
            </div>
            {servicio ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
                <label>
                  <span className={etiqueta}>Tipo de trabajo</span>
                  <select
                    className={campo}
                    value={tipo?.id || ""}
                    onChange={(e) => setTipo(servicio.tipos.find((x) => x.id === e.target.value) || null)}
                  >
                    {servicio.tipos.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={etiqueta}>Piezas</span>
                  <input
                    className={campo}
                    type="number"
                    min={1}
                    max={10000}
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, Math.min(10000, parseInt(e.target.value, 10) || 1)))}
                  />
                </label>
              </div>
            ) : null}
          </>
        ) : (
          <p className="m-0 text-[14px] text-[#40403A]">Cuéntale al taller qué necesitas en el mensaje de abajo.</p>
        )}

        {servicio && tipo ? (
          <div className="mt-4 rounded-[12px] bg-[#FAF9F6] p-4">
            <p className="m-0 text-[13px] uppercase tracking-wide text-[#7A776E]">Precio estimado</p>
            {calculando ? (
              <p className="m-0 mt-1 text-[15px] text-[#7A776E]">Calculando…</p>
            ) : estimado?.estimable ? (
              <>
                <p className="m-0 mt-1 text-[24px] font-bold text-[#142033]">
                  {dinero(estimado.recomendado, estimado.moneda)}
                  <span className="ml-1 text-[14px] font-normal text-[#7A776E]">{estimado.iva_pct ? `+ IVA` : ""}</span>
                </p>
                <p className="m-0 mt-1 text-[12px] text-[#7A776E]">
                  Estimado con las tarifas de {taller.nombre} para {cantidad} pieza{cantidad > 1 ? "s" : ""}. Es el trabajo de máquina; el material y los
                  acabados, si los necesitas, te los confirma el taller junto con el precio final.
                </p>
              </>
            ) : estimado ? (
              <p className="m-0 mt-1 text-[14px] text-[#40403A]">{estimado.motivo || "El taller revisa tu archivo y te manda el precio."}</p>
            ) : (
              <p className="m-0 mt-1 text-[14px] text-[#40403A]">Sube tu archivo o escribe las medidas para ver el precio.</p>
            )}
          </div>
        ) : null}
      </Paso>

      <Paso n={3} titulo="Tus datos para mandarte la cotización">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={etiqueta}>Nombre *</span>
            <input className={campo} value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} maxLength={120} autoComplete="name" />
          </label>
          <label>
            <span className={etiqueta}>WhatsApp</span>
            <input
              className={campo}
              value={datos.telefono}
              onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
              inputMode="tel"
              maxLength={30}
              autoComplete="tel"
              placeholder="10 dígitos"
            />
          </label>
          <label>
            <span className={etiqueta}>Correo</span>
            <input
              className={campo}
              type="email"
              value={datos.correo}
              onChange={(e) => setDatos({ ...datos, correo: e.target.value })}
              maxLength={160}
              autoComplete="email"
            />
          </label>
          <label>
            <span className={etiqueta}>Empresa (opcional)</span>
            <input className={campo} value={datos.empresa} onChange={(e) => setDatos({ ...datos, empresa: e.target.value })} maxLength={120} autoComplete="organization" />
          </label>
          <label className="sm:col-span-2">
            <span className={etiqueta}>Detalles (material, espesor, acabado, fecha…)</span>
            <textarea className={`${campo} min-h-[96px]`} value={datos.mensaje} onChange={(e) => setDatos({ ...datos, mensaje: e.target.value })} maxLength={2000} />
          </label>
          {/* Trampa para robots: una persona no ve este campo */}
          <input
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            className="absolute left-[-9999px] h-px w-px opacity-0"
            value={datos.sitio_web}
            onChange={(e) => setDatos({ ...datos, sitio_web: e.target.value })}
            name="sitio_web"
          />
        </div>
        {error ? <p className="m-0 mt-3 text-[14px] text-[#B42318]">{error}</p> : null}
        <button type="submit" className={`${boton} mt-4 w-full sm:w-auto`} disabled={enviando || leyendo}>
          {enviando ? "Enviando…" : "Pedir mi cotización"}
        </button>
        <p className="m-0 mt-2 text-[12px] text-[#7A776E]">
          Tus datos y tu archivo los recibe sólo {taller.nombre} para cotizarte. Consulta el{" "}
          <a href="/aviso-de-privacidad" className="underline">
            aviso de privacidad
          </a>
          .
        </p>
      </Paso>

      <p className="m-0 text-center text-[12px] text-[#7A776E]">
        <a href="/t" className="underline">Más talleres que cotizan en línea</a> ·{" "}
        <a href="/servicios/cotizador-cnc" className="underline">
          ¿Tienes taller? Ten tu cotizador gratis
        </a>
      </p>
    </form>
  )
}
