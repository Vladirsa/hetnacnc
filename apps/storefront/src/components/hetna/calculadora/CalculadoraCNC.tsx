"use client"

import { useEffect, useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Calculadora, Campo, Entrada, Resultado } from "@/lib/calculadora/comun"
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
      <span className="text-[13px] font-semibold text-[#1B1B18]">
        {f.etiqueta}
        {f.req && <span className="text-[#C2560A]"> *</span>}
      </span>
      {f.tipo === "opcion" ? (
        <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
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
        <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
          <input
            type="text"
            inputMode={f.tipo === "numero" ? "decimal" : "text"}
            value={valor === undefined || valor === null ? "" : String(valor)}
            onChange={(e) => cambiar(e.target.value)}
            placeholder={f.req ? "necesario" : "opcional"}
            className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none placeholder:text-[#C5C2B8]"
          />
          {f.unidad && <span className="pr-3 text-[13px] text-[#9A978C] whitespace-nowrap">{f.unidad}</span>}
        </span>
      )}
      {f.ayuda && <span className="text-[12px] text-[#6B6A63]">{f.ayuda}</span>}
    </label>
  )
}

const Confianza = ({ v }: { v: number }) => {
  const color = v >= 80 ? "#19B374" : v >= 50 ? "#E09A1A" : "#C8322B"
  const texto = v >= 80 ? "Punto de partida confiable" : v >= 50 ? "Revisa los avisos antes de cortar" : "Caso fuera de lo normal: prueba con cuidado"
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 rounded-full bg-[#EEECE5] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color }}>{texto}</span>
    </div>
  )
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

  return (
    <div className="flex flex-col gap-4">
      {/* procesos */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5" role="tablist" aria-label="Proceso">
        {PROCESOS.map((p) => {
          const activo = p.id === proceso.id
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => elegirProceso(p.id)}
              className={`rounded-[12px] border px-2 py-2.5 text-[12.5px] sm:text-[13px] font-semibold leading-tight text-center transition ${activo ? "bg-[#142033] border-[#142033] text-white" : "bg-white border-[#E7E4DC] text-[#1B1B18] hover:border-[#C2560A]"}`}
            >
              {p.corto}
            </button>
          )
        })}
      </div>
      <p className="m-0 text-[14px] text-[#6B6A63]">{proceso.texto}</p>

      <div className="grid lg:grid-cols-[400px_1fr] gap-5 items-start">
        {/* formulario */}
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          {proceso.modos.length > 1 && (
            <div className="grid grid-cols-2 gap-1.5 bg-[#F3F1EA] rounded-[12px] p-1">
              {proceso.modos.map((m) => (
                <button key={m.id} type="button" onClick={() => setModoId(m.id)} className={`rounded-[10px] px-2 py-2 text-[13px] font-semibold ${m.id === calc.id ? "bg-white text-[#1B1B18] shadow-sm" : "text-[#6B6A63]"}`}>
                  {m.nombre}
                </button>
              ))}
            </div>
          )}

          {tieneMaquina && proceso.presets.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[#1B1B18]">{proceso.presetEtiqueta}: empieza con una típica</span>
              <div className="flex flex-wrap gap-1.5">
                {proceso.presets.map((p) => (
                  <button key={p.id} type="button" onClick={() => aplicarPreset(p.valores)} className="rounded-full border border-[#E7E4DC] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1B1B18] hover:border-[#C2560A]">
                    {p.nombre.length > 34 ? p.nombre.slice(0, 32) + "…" : p.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {secciones.map(([titulo, campos]) => (
            <div key={titulo} className="flex flex-col gap-2 border-t border-[#E7E4DC] pt-3 first:border-0 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold tracking-wide uppercase text-[#9A978C]">{titulo}</span>
                {titulo === "Máquina" && tieneMaquina && (
                  <span className="flex items-center gap-2">
                    {perfilGuardado && (
                      <button type="button" onClick={olvidarMaquina} className="text-[12px] text-[#6B6A63] underline">
                        olvidar
                      </button>
                    )}
                    <button type="button" onClick={guardarMaquina} className="text-[12px] font-semibold rounded-full px-2.5 py-1 border" style={{ borderColor: NARANJA, color: NARANJA }}>
                      {perfilGuardado ? "Mi máquina ✓ guardada" : "Guardar como mi máquina"}
                    </button>
                  </span>
                )}
              </div>
              <div className={`grid gap-2 ${campos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {campos.map((f) => (
                  <div key={f.k} className={f.tipo === "opcion" || campos.length === 1 ? "col-span-2" : ""}>
                    <CampoInput f={f} valor={e[f.k]} cambiar={(v) => poner(f.k, v)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="m-0 text-[12px] text-[#6B6A63]">Los resultados son puntos de partida de tablas de fabricantes. Siempre prueba primero en un retazo del mismo material.</p>
        </section>

        {/* resultados */}
        <section className="flex flex-col gap-3 min-w-0">
          {!R ? (
            <div className="bg-[#FDECEC] border border-[#F2B8B5] text-[#8A1C1C] rounded-[12px] px-4 py-3 text-[14px]">Revisa los datos: hay un valor que no se puede calcular.</div>
          ) : (
            <>
              {R.faltan.length > 0 && (
                <div className="bg-[#FFF6E8] border border-[#F2C98F] text-[#5A3A12] rounded-[12px] px-4 py-3 text-[14px]">
                  <strong>Falta:</strong> {R.faltan.join(", ")}.
                </div>
              )}
              {R.bloques.length > 0 && (
                <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="m-0 font-display text-[20px] font-bold text-[#1B1B18]">{R.titulo}</h2>
                    <div className="flex gap-2">
                      <button type="button" onClick={copiar} className="rounded-[10px] border border-[#E7E4DC] bg-white px-3 py-2 text-[13px] font-semibold text-[#1B1B18] hover:border-[#C2560A]">
                        {copiado ? "Copiado ✓" : "Copiar"}
                      </button>
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-[10px] bg-[#19B374] px-3 py-2 text-[13px] font-semibold text-white no-underline">
                        WhatsApp
                      </a>
                    </div>
                  </div>
                  <Confianza v={R.confianza} />
                  {R.bloques.map((b) => {
                    const destacadas = b.filas.filter((f) => f.destacado)
                    const resto = b.filas.filter((f) => !f.destacado)
                    return (
                      <div key={b.titulo} className="flex flex-col gap-2">
                        <span className="text-[12px] font-bold tracking-wide uppercase text-[#9A978C]">{b.titulo}</span>
                        {destacadas.length > 0 && (
                          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 m-0">
                            {destacadas.map((f) => (
                              <div key={f.etiqueta} className="bg-[#FFF3EA] border border-[#F6CDB0] rounded-[12px] px-3 py-2.5 min-w-0">
                                <dt className="text-[12px] text-[#6B6A63]">{f.etiqueta}</dt>
                                <dd className="m-0 text-[18px] font-bold text-[#1B1B18] leading-tight break-words">{f.valor}</dd>
                                {f.nota && <dd className="m-0 mt-0.5 text-[11.5px] text-[#6B6A63]">{f.nota}</dd>}
                              </div>
                            ))}
                          </dl>
                        )}
                        {resto.length > 0 && (
                          <dl className="m-0 divide-y divide-[#F0EEE7] border border-[#E7E4DC] rounded-[12px] overflow-hidden">
                            {resto.map((f) => (
                              <div key={f.etiqueta} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2 bg-white">
                                <dt className="text-[13px] text-[#6B6A63]">{f.etiqueta}</dt>
                                <dd className="m-0 text-[14px] font-semibold text-[#1B1B18] text-right">{f.valor}</dd>
                                {f.nota && <dd className="m-0 col-span-2 text-[11.5px] text-[#9A978C]">{f.nota}</dd>}
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {R.avisos.length > 0 && (
                <ul className="m-0 pl-5 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] py-3 pr-4 flex flex-col gap-1">
                  {R.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
              {R.consejos.length > 0 && (
                <div className="bg-white border border-[#E7E4DC] rounded-[12px] px-4 py-3">
                  <span className="text-[12px] font-bold tracking-wide uppercase text-[#9A978C]">Consejos para este caso</span>
                  <ul className="m-0 mt-1.5 pl-5 text-[13.5px] text-[#1B1B18] flex flex-col gap-1">
                    {R.consejos.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {R.supuestos.length > 0 && (
                <p className="m-0 text-[12px] text-[#6B6A63]">
                  <strong>Supuestos:</strong> {R.supuestos.join(" ")}
                </p>
              )}
            </>
          )}
          <div className="bg-[#142033] text-white rounded-[14px] px-4 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[15px] font-bold">¿Quieres cotizar con estos tiempos?</p>
              <p className="m-0 text-[13px] text-white/75">La app HETNA CNC convierte el tiempo de máquina en precio con tus costos, y controla tu taller.</p>
            </div>
            <LocalizedClientLink href="/servicios/cotizador-cnc" className="rounded-[10px] px-4 py-2 text-[14px] font-bold text-[#142033] no-underline" style={{ background: "#FFC53D" }}>
              Conocer la app
            </LocalizedClientLink>
          </div>
        </section>
      </div>
    </div>
  )
}
