"use client"

import { useEffect, useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Calculadora, Campo, Entrada, Medidor, Resultado } from "@/lib/calculadora/comun"
import { PROCESOS, procesoPorId } from "@/lib/calculadora"

// Calculadora CNC profesional: la interfaz se arma a partir de la descripción
// de cada calculadora (campos + función). Lo único que vive aquí es el
// formulario, el perfil "Mi máquina" (localStorage) y la presentación.

const NARANJA = "#C2560A"
const clavePerfil = (proceso: string) => `hetna-calc-maquina-${proceso}`

const valoresIniciales = (c: Calculadora): Entrada => {
  const e: Entrada = {}
  for (const f of c.campos) if (f.inicial !== undefined) e[f.k] = f.inicial
  return e
}

const visible = (f: Campo, e: Entrada) => {
  if (!f.si) return true
  const v = String(e[f.si.k] ?? "")
  return Array.isArray(f.si.v) ? f.si.v.includes(v) : f.si.v === v
}

const CampoInput = ({ f, valor, cambiar }: { f: Campo; valor: unknown; cambiar: (v: string) => void }) => {
  const grupos = useMemo(() => {
    if (f.tipo !== "opcion" || !f.opciones) return null
    const conGrupo = f.opciones.some((o) => o.grupo)
    if (!conGrupo) return null
    const m = new Map<string, typeof f.opciones>()
    for (const o of f.opciones) {
      const g = o.grupo || "Otros"
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(o)
    }
    return [...m.entries()]
  }, [f])
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[12.5px] font-semibold text-[#40403A]">
        {f.etiqueta}
        {f.req && <span className="text-[#C2560A]"> *</span>}
      </span>
      {f.tipo === "opcion" ? (
        <span className="flex items-center rounded-[10px] border border-[#DEDACF] bg-[#FBFAF7] transition focus-within:border-[#C2560A] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(194,86,10,0.14)]">
          <select value={String(valor ?? "")} onChange={(e) => cambiar(e.target.value)} className="w-full min-w-0 px-3 py-2.5 text-[15px] text-[#1B1B18] bg-transparent outline-none">
            {grupos
              ? grupos.map(([g, os]) => (
                  <optgroup key={g} label={g}>
                    {os.map((o) => (
                      <option key={o.v} value={o.v}>{o.t}</option>
                    ))}
                  </optgroup>
                ))
              : f.opciones?.map((o) => (
                  <option key={o.v} value={o.v}>{o.t}</option>
                ))}
          </select>
        </span>
      ) : (
        <span className="flex items-center rounded-[10px] border border-[#DEDACF] bg-[#FBFAF7] transition focus-within:border-[#C2560A] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(194,86,10,0.14)]">
          <input
            type="text"
            inputMode={f.tipo === "numero" ? "decimal" : "text"}
            value={valor === undefined || valor === null ? "" : String(valor)}
            onChange={(e) => cambiar(e.target.value)}
            placeholder={f.req ? "necesario" : "opcional"}
            className="w-full min-w-0 bg-transparent px-3 py-2.5 font-mono text-[16px] text-[#142033] outline-none placeholder:font-sans placeholder:text-[#C5C2B8]"
          />
          {f.unidad && <span className="pr-3 text-[13px] text-[#9A978C] whitespace-nowrap">{f.unidad}</span>}
        </span>
      )}
      {f.ayuda && <span className="text-[12px] text-[#6B6A63]">{f.ayuda}</span>}
    </label>
  )
}

const Confianza = ({ v }: { v: number }) => {
  const color = v >= 80 ? "#3FD08A" : v >= 50 ? "#F5B13D" : "#FF7A70"
  const texto = v >= 80 ? "Punto de partida confiable" : v >= 50 ? "Revisa los avisos antes de cortar" : "Caso fuera de lo normal: prueba con cuidado"
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15" role="img" aria-label={`Confianza ${v} de 100`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="whitespace-nowrap text-[12px] font-semibold" style={{ color }}>{texto}</span>
    </div>
  )
}

// Barra que muestra dónde cae un valor respecto a su rango sano (la zona verde).
const MedidorBarra = ({ m }: { m: Medidor }) => {
  const ancho = Math.max(1e-9, m.escalaMax - m.escalaMin)
  const pct = (x: number) => Math.min(100, Math.max(0, ((x - m.escalaMin) / ancho) * 100))
  const dentro = m.valor >= m.okMin - 1e-9 && m.valor <= m.okMax + 1e-9
  const lejos = m.valor > m.okMax * 1.5 || (m.okMin > 0 && m.valor < m.okMin * 0.6)
  const color = dentro ? "#16794F" : lejos ? "#C8322B" : "#C77A0A"
  return (
    <div className="relative h-2 rounded-full bg-[#EEECE5]" role="img" aria-label={dentro ? "Dentro del rango recomendado" : "Fuera del rango recomendado"}>
      <div className="absolute inset-y-0 rounded-full bg-[#BFE5CF]" style={{ left: `${pct(m.okMin)}%`, width: `${Math.max(2, pct(m.okMax) - pct(m.okMin))}%` }} />
      <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${pct(m.valor)}%`, background: color }} />
    </div>
  )
}

const IconoProceso = ({ id }: { id: string }) => {
  const c = { viewBox: "0 0 24 24", className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true }
  switch (id) {
    case "router":
      return <svg {...c}><rect x="8" y="2.5" width="8" height="7" rx="1.2" /><path d="M10 9.5v4l2 2.5 2-2.5v-4M12 16v3M4 21h16" /></svg>
    case "laser":
      return <svg {...c}><path d="M12 3v9" /><path d="M9 3h6" /><path d="M12 12l-5 7M12 12l5 7M12 12v8" strokeDasharray="1.5 2.5" /><path d="M4 21h16" /></svg>
    case "fibra":
      return <svg {...c}><circle cx="12" cy="12" r="2.2" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>
    case "plasma":
      return <svg {...c}><path d="M13 2L6 13h5l-1 9 8-12h-5l1-8z" /></svg>
    case "impresora":
      return <svg {...c}><path d="M4 4h16M12 4v5M9.5 9h5l-1 3h-3l-1-3zM12 12v2" /><path d="M7 20h10M8.5 17h7" /></svg>
    default:
      return <svg {...c}><circle cx="12" cy="12" r="8" /></svg>
  }
}

const textoResultado = (c: Calculadora, e: Entrada, R: Resultado) => {
  const entradas = c.campos
    .filter((f) => visible(f, e) && e[f.k] !== undefined && e[f.k] !== "")
    .map((f) => {
      const v = f.tipo === "opcion" ? f.opciones?.find((o) => o.v === String(e[f.k]))?.t ?? e[f.k] : `${e[f.k]}${f.unidad ? " " + f.unidad : ""}`
      return `${f.etiqueta}: ${v}`
    })
  const lineas = [`${R.titulo} — HETNA CNC`, "", ...entradas, ""]
  for (const b of R.bloques) {
    lineas.push(`${b.titulo.toUpperCase()}`)
    for (const f of b.filas) lineas.push(`• ${f.etiqueta}: ${f.valor}${f.nota ? ` (${f.nota})` : ""}`)
    lineas.push("")
  }
  if (R.avisos.length) lineas.push("AVISOS", ...R.avisos.map((a) => `⚠ ${a}`), "")
  lineas.push("Calculado en hetnacnc.com/calculadora-cnc")
  return lineas.join("\n")
}

export const CalculadoraCNC = ({ procesoInicial }: { procesoInicial?: string }) => {
  const [procesoId, setProcesoId] = useState(procesoPorId(procesoInicial).id)
  const proceso = procesoPorId(procesoId)
  const [modoId, setModoId] = useState(proceso.modos[0].id)
  const calc = proceso.modos.find((m) => m.id === modoId) || proceso.modos[0]
  const [entradas, setEntradas] = useState<Record<string, Entrada>>({})
  const [perfilGuardado, setPerfilGuardado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const e = entradas[calc.id] || valoresIniciales(calc)

  // perfil "Mi máquina" guardado en el navegador
  useEffect(() => {
    try {
      const raw = localStorage.getItem(clavePerfil(proceso.id))
      if (!raw) {
        setPerfilGuardado(false)
        return
      }
      const perfil = JSON.parse(raw) as Entrada
      setPerfilGuardado(true)
      setEntradas((prev) => {
        const sig = { ...prev }
        for (const m of proceso.modos) sig[m.id] = { ...(prev[m.id] || valoresIniciales(m)), ...perfil }
        return sig
      })
    } catch {
      /* sin almacenamiento */
    }
  }, [proceso])

  const poner = (k: string, v: string) => setEntradas((prev) => ({ ...prev, [calc.id]: { ...(prev[calc.id] || valoresIniciales(calc)), [k]: v } }))

  const elegirProceso = (id: string) => {
    const p = procesoPorId(id)
    setProcesoId(p.id)
    setModoId(p.modos[0].id)
    setCopiado(false)
  }

  const aplicarPreset = (valores: Record<string, string | number>) => {
    setEntradas((prev) => {
      const sig = { ...prev }
      for (const m of proceso.modos) sig[m.id] = { ...(prev[m.id] || valoresIniciales(m)), ...valores }
      return sig
    })
  }

  const guardarMaquina = () => {
    const perfil: Entrada = {}
    for (const f of calc.campos) if (f.maquina && e[f.k] !== undefined && e[f.k] !== "") perfil[f.k] = e[f.k]
    try {
      localStorage.setItem(clavePerfil(proceso.id), JSON.stringify(perfil))
      setPerfilGuardado(true)
    } catch {
      /* sin almacenamiento */
    }
  }
  const olvidarMaquina = () => {
    try {
      localStorage.removeItem(clavePerfil(proceso.id))
    } catch {
      /* nada */
    }
    setPerfilGuardado(false)
  }

  const R = useMemo(() => {
    try {
      return calc.calcular(e)
    } catch {
      return null
    }
  }, [calc, e])

  const secciones = useMemo(() => {
    const m = new Map<string, Campo[]>()
    for (const f of calc.campos) {
      if (!visible(f, e)) continue
      const s = f.seccion || "Datos"
      if (!m.has(s)) m.set(s, [])
      m.get(s)!.push(f)
    }
    return [...m.entries()]
  }, [calc, e])
  const tieneMaquina = calc.campos.some((f) => f.maquina)

  const copiar = async () => {
    if (!R) return
    try {
      await navigator.clipboard.writeText(textoResultado(calc, e, R))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* sin portapapeles */
    }
  }
  const whatsapp = R ? `https://wa.me/?text=${encodeURIComponent(textoResultado(calc, e, R))}` : "#"

  const principal = R?.bloques[0]
  const grandes = principal ? principal.filas.filter((f) => f.destacado) : []

  return (
    <div className="flex flex-col gap-5">
      {/* procesos */}
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6" role="tablist" aria-label="Proceso">
        {PROCESOS.map((p) => {
          const activo = p.id === proceso.id
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => elegirProceso(p.id)}
              className={`group flex flex-col items-start gap-2 rounded-[14px] border px-3 py-3 text-left transition ${
                activo ? "border-[#C2560A] bg-white shadow-[0_6px_20px_rgba(194,86,10,0.18)]" : "border-white/10 bg-white/[0.06] hover:bg-white/[0.12]"
              }`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-[10px] ${activo ? "bg-[#C2560A] text-white" : "bg-white/10 text-white"}`}>
                <IconoProceso id={p.icono} />
              </span>
              <span className={`text-[13px] font-bold leading-tight ${activo ? "text-[#142033]" : "text-white"}`}>{p.corto}</span>
            </button>
          )
        })}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,410px)_minmax(0,1fr)]">
        {/* formulario */}
        <section className="flex flex-col gap-4 rounded-[16px] border border-[#E7E4DC] bg-white p-4 shadow-[0_1px_2px_rgba(20,32,51,0.04)] lg:p-5">
          <div>
            <h2 className="m-0 font-display text-[18px] font-bold text-[#142033]">{proceso.nombre}</h2>
            <p className="m-0 mt-0.5 text-[13px] leading-snug text-[#6B6A63]">{proceso.texto}</p>
          </div>
          {proceso.modos.length > 1 && (
            <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-[#F1EFE8] p-1">
              {proceso.modos.map((m) => (
                <button key={m.id} type="button" onClick={() => setModoId(m.id)} className={`rounded-[9px] px-2 py-2 text-[13px] font-semibold transition ${m.id === calc.id ? "bg-[#142033] text-white shadow-sm" : "text-[#6B6A63] hover:text-[#142033]"}`}>
                  {m.nombre}
                </button>
              ))}
            </div>
          )}

          {tieneMaquina && proceso.presets.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A978C]">{proceso.presetEtiqueta}: empieza con una típica</span>
              <div className="flex flex-wrap gap-1.5">
                {proceso.presets.map((p) => {
                  const puesto = Object.entries(p.valores).every(([k, v]) => String(e[k] ?? "") === String(v))
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => aplicarPreset(p.valores)}
                      title={p.nombre}
                      className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${puesto ? "border-[#C2560A] bg-[#FFF3EA] text-[#A84A08]" : "border-[#E7E4DC] bg-white text-[#1B1B18] hover:border-[#C2560A]"}`}
                    >
                      {p.nombre.length > 34 ? p.nombre.slice(0, 32) + "…" : p.nombre}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {secciones.map(([titulo, campos], n) => (
            <div key={titulo} className="flex flex-col gap-2.5 border-t border-[#EEECE5] pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#142033]">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#142033] text-[10px] text-white">{n + 1}</span>
                  {titulo}
                </span>
                {titulo === "Máquina" && tieneMaquina && (
                  <span className="flex items-center gap-2">
                    {perfilGuardado && (
                      <button type="button" onClick={olvidarMaquina} className="text-[12px] text-[#6B6A63] underline">
                        olvidar
                      </button>
                    )}
                    <button type="button" onClick={guardarMaquina} className="rounded-full border px-2.5 py-1 text-[12px] font-semibold" style={{ borderColor: NARANJA, color: NARANJA }}>
                      {perfilGuardado ? "Mi máquina ✓ guardada" : "Guardar como mi máquina"}
                    </button>
                  </span>
                )}
              </div>
              <div className={`grid gap-2.5 ${campos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {campos.map((f) => (
                  <div key={f.k} className={f.tipo === "opcion" || campos.length === 1 ? "col-span-2" : ""}>
                    <CampoInput f={f} valor={e[f.k]} cambiar={(v) => poner(f.k, v)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* resultados */}
        <section className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4">
          {!R ? (
            <div className="rounded-[12px] border border-[#F2B8B5] bg-[#FDECEC] px-4 py-3 text-[14px] text-[#8A1C1C]">Revisa los datos: hay un valor que no se puede calcular.</div>
          ) : (
            <>
              {R.faltan.length > 0 && (
                <div className="rounded-[12px] border border-[#F2C98F] bg-[#FFF6E8] px-4 py-3 text-[14px] text-[#5A3A12]">
                  <strong>Falta:</strong> {R.faltan.join(", ")}.
                </div>
              )}
              {principal && (
                <div className="overflow-hidden rounded-[18px] bg-[#142033] text-white shadow-[0_18px_40px_rgba(20,32,51,0.22)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#FFB27A]">{principal.titulo}</span>
                      <h2 className="m-0 font-display text-[19px] font-bold leading-tight">{R.titulo}</h2>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={copiar} className="rounded-[10px] border border-white/20 bg-white/10 px-3 py-2 text-[13px] font-semibold text-white hover:bg-white/20">
                        {copiado ? "Copiado ✓" : "Copiar"}
                      </button>
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-[10px] bg-[#19B374] px-3 py-2 text-[13px] font-semibold text-white no-underline hover:bg-[#15A067]">
                        WhatsApp
                      </a>
                    </div>
                  </div>
                  {grandes.length > 0 && (
                    <dl className={`m-0 grid gap-px bg-white/10 mt-4 ${grandes.length >= 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
                      {grandes.map((f) => (
                        <div key={f.etiqueta} className="min-w-0 bg-[#142033] px-5 py-4">
                          <dt className="text-[12px] font-semibold text-white/60">{f.etiqueta}</dt>
                          <dd className={`m-0 mt-1 break-words font-bold leading-none tracking-tight text-white ${/^[≈<>\d$-]/.test(f.valor) ? "font-mono text-[26px] sm:text-[30px]" : "text-[19px] leading-tight sm:text-[21px]"}`}>{f.valor}</dd>
                          {f.nota && <dd className="m-0 mt-1.5 text-[11.5px] leading-snug text-white/55">{f.nota}</dd>}
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="border-t border-white/10 px-5 py-3.5">
                    <Confianza v={R.confianza} />
                  </div>
                </div>
              )}
              {R.bloques.map((b, n) => {
                const filas = n === 0 ? b.filas.filter((f) => !f.destacado) : b.filas
                if (!filas.length) return null
                return (
                  <div key={b.titulo} className="rounded-[16px] border border-[#E7E4DC] bg-white p-4">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A978C]">{n === 0 ? "Detalle del corte" : b.titulo}</span>
                    <dl className="m-0 mt-2 grid gap-x-6 sm:grid-cols-2">
                      {filas.map((f) => (
                        <div key={f.etiqueta} className={`flex flex-col gap-1 border-t border-[#F0EEE7] py-2.5 ${f.destacado ? "sm:col-span-2" : ""}`}>
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-[13px] text-[#6B6A63]">{f.etiqueta}</dt>
                            <dd className={`m-0 text-right font-bold text-[#142033] ${/^[≈<>\d$-]/.test(f.valor) ? "font-mono" : ""} ${f.destacado ? "text-[20px]" : "text-[15px]"}`}>{f.valor}</dd>
                          </div>
                          {f.medidor && <MedidorBarra m={f.medidor} />}
                          {f.nota && <dd className="m-0 text-[11.5px] leading-snug text-[#9A978C]">{f.nota}</dd>}
                        </div>
                      ))}
                    </dl>
                  </div>
                )
              })}
              {R.avisos.length > 0 && (
                <div className="rounded-[16px] border border-[#F2C98F] bg-[#FFF6E8] px-4 py-3">
                  <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A5A12]">
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 3l8 14H2L10 3z" strokeLinejoin="round" /><path d="M10 8.5v4M10 14.8v.2" strokeLinecap="round" /></svg>
                    Revisa antes de cortar
                  </span>
                  <ul className="m-0 mt-1.5 flex flex-col gap-1.5 pl-5 text-[13.5px] leading-snug text-[#5A3A12]">
                    {R.avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {R.consejos.length > 0 && (
                <div className="rounded-[16px] border border-[#E7E4DC] bg-white px-4 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9A978C]">Consejos para este caso</span>
                  <ul className="m-0 mt-1.5 flex list-none flex-col gap-1.5 p-0 text-[13.5px] leading-snug text-[#1B1B18]">
                    {R.consejos.map((c) => (
                      <li key={c} className="flex gap-2">
                        <span className="mt-[3px] h-4 w-4 flex-none rounded-full bg-[#E6F4EC] text-center text-[11px] font-bold leading-4 text-[#16794F]">✓</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {R.supuestos.length > 0 && (
                <p className="m-0 text-[12px] leading-snug text-[#6B6A63]">
                  <strong>Cómo se calculó:</strong> {R.supuestos.join(" ")}
                </p>
              )}
              <p className="m-0 text-[12px] leading-snug text-[#6B6A63]">Son puntos de partida calculados con rangos de fabricantes y los límites de tu máquina. Prueba siempre primero en un retazo del mismo material.</p>
            </>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#E7E4DC] bg-white px-4 py-3.5">
            <div className="min-w-0">
              <p className="m-0 text-[14.5px] font-bold text-[#142033]">¿Quieres cotizar con estos tiempos?</p>
              <p className="m-0 text-[13px] text-[#6B6A63]">La app HETNA CNC convierte el tiempo de máquina en precio con tus costos.</p>
            </div>
            <LocalizedClientLink href="/servicios/cotizador-cnc" className="rounded-[10px] bg-[#C2560A] px-4 py-2 text-[14px] font-bold text-white no-underline hover:bg-[#A84A08]">
              Conocer la app
            </LocalizedClientLink>
          </div>
        </section>
      </div>
    </div>
  )
}
