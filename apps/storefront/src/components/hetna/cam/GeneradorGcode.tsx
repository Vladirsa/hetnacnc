"use client"

import { useState } from "react"

// Flujo 1 del Laboratorio CAM: archivo -> G-code en pocos clics, sin cuenta.
// El material y la fresa mandan: el plan no se captura, se calcula.

const MATERIALES = [
  { clave: "mdf", nombre: "MDF" },
  { clave: "pino", nombre: "Pino / madera blanda" },
  { clave: "encino", nombre: "Encino / madera dura" },
  { clave: "acrilico", nombre: "Acrílico" },
  { clave: "aluminio", nombre: "Aluminio" },
]

const FRESAS = [3, 6, 8]

type Plan = {
  material: string
  diametro_fresa: number
  espesor: number
  avance: number
  penetracion: number
  rpm: number
  profundidad_pasada: number
  pasadas: number
  contornos_exteriores: number
  contornos_interiores: number
  largo_corte_mm: number
  tiempo_estimado_min: number
  pestanas: number
  advertencias: string[]
}

type Error = { mensaje: string; remedio: string }

export const GeneradorGcode = () => {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [material, setMaterial] = useState("mdf")
  const [diametro, setDiametro] = useState("6")
  const [espesor, setEspesor] = useState("18")
  const [trabajando, setTrabajando] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [gcode, setGcode] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const generar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!archivo) {
      setError({ mensaje: "Falta el archivo.", remedio: "Elige el DXF que quieres cortar." })
      return
    }

    setTrabajando(true)
    setError(null)
    setPlan(null)
    setGcode(null)

    const form = new FormData()
    form.append("dxf", archivo)
    form.append("material", material)
    form.append("diametro", diametro)
    form.append("espesor", espesor)

    try {
      const res = await fetch("/api/cam/gcode", { method: "POST", body: form })
      const cuerpo = await res.json()
      if (!cuerpo.ok) {
        setError({ mensaje: cuerpo.mensaje || "No se pudo generar el G-code.", remedio: cuerpo.remedio || "" })
      } else {
        setPlan(cuerpo.plan)
        setGcode(cuerpo.gcode)
      }
    } catch {
      setError({ mensaje: "Se cortó la conexión.", remedio: "Vuelve a intentarlo." })
    }
    setTrabajando(false)
  }

  const descargar = () => {
    if (!gcode) return
    const nombre = (archivo?.name || "pieza").replace(/\.dxf$/i, "") + ".nc"
    const url = URL.createObjectURL(new Blob([gcode], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = nombre
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
      <form onSubmit={generar} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-bold text-[#1B1B18]">1. Tu archivo</span>
          <span className="text-[13px] text-[#6B6A63] leading-relaxed">
            Un DXF con los contornos cerrados. Lo que esté abierto no se puede cortar y te
            lo vamos a decir.
          </span>
          <input
            type="file"
            accept=".dxf,image/vnd.dxf,application/dxf"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] || null)
              setError(null)
            }}
            className="mt-1 block w-full text-[14px] text-[#4A4943] file:mr-4 file:rounded-[10px] file:border-0 file:bg-[#1B1B18] file:px-4 file:py-2.5 file:text-[14px] file:font-semibold file:text-white hover:file:bg-[#333]"
          />
        </label>

        <fieldset className="border-0 p-0 m-0">
          <legend className="text-[15px] font-bold text-[#1B1B18] p-0">2. Material y fresa</legend>
          <p className="mt-1 text-[13px] text-[#6B6A63] leading-relaxed">
            De aquí sale todo lo demás: el avance, las revoluciones y cuántas pasadas hacen
            falta. No tienes que saberte esos números.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Campo etiqueta="Material">
              <select className={CLASE} value={material} onChange={(e) => setMaterial(e.target.value)}>
                {MATERIALES.map((m) => (
                  <option key={m.clave} value={m.clave}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Fresa (mm)">
              <select className={CLASE} value={diametro} onChange={(e) => setDiametro(e.target.value)}>
                {FRESAS.map((d) => (
                  <option key={d} value={d}>
                    {d} mm
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Espesor (mm)">
              <input
                className={CLASE}
                inputMode="decimal"
                value={espesor}
                onChange={(e) => setEspesor(e.target.value)}
              />
            </Campo>
          </div>
        </fieldset>

        <div>
          <button
            type="submit"
            disabled={trabajando || !archivo}
            className="bg-[#C2560A] hover:bg-[#A84A08] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-[10px] text-[15px]"
          >
            {trabajando ? "Calculando…" : "Generar el G-code"}
          </button>
          {error && (
            <div role="alert" className="mt-4 rounded-[12px] border border-[#E6C4BE] bg-[#FBF0EE] px-4 py-3.5">
              <p className="text-[14px] font-semibold text-[#9B3225]">{error.mensaje}</p>
              {error.remedio && <p className="mt-1 text-[14px] text-[#9B3225] leading-relaxed">{error.remedio}</p>}
            </div>
          )}
        </div>
      </form>

      <aside className="lg:sticky lg:top-6">
        {!plan ? (
          <div className="rounded-[14px] border border-dashed border-[#D9D5CC] bg-white px-5 py-8 text-center text-[14px] text-[#6B6A63] leading-relaxed">
            Aquí va a aparecer el plan de corte: cuántas pasadas, cuánto tarda y con qué
            números va a trabajar tu máquina.
          </div>
        ) : (
          <PlanDeCorte plan={plan} onDescargar={descargar} />
        )}
      </aside>
    </div>
  )
}

const PlanDeCorte = ({ plan, onDescargar }: { plan: Plan; onDescargar: () => void }) => (
  <div className="rounded-[14px] border border-[#E7E4DC] bg-white overflow-hidden">
    <div className="bg-[#142033] text-white px-5 py-4">
      <p className="text-[12px] uppercase tracking-wide text-[#9FB0C9]">Plan de corte</p>
      <p className="text-[26px] font-bold leading-tight">
        {plan.tiempo_estimado_min} min
      </p>
      <p className="mt-1 text-[13px] text-[#9FB0C9]">
        {plan.pasadas} {plan.pasadas === 1 ? "pasada" : "pasadas"} de {plan.profundidad_pasada} mm ·{" "}
        {(plan.largo_corte_mm / 1000).toFixed(1)} m de recorrido
      </p>
    </div>

    <dl className="px-5 py-4 flex flex-col gap-2.5 text-[14px]">
      <Fila termino="Material" valor={plan.material} />
      <Fila termino="Fresa" valor={`${plan.diametro_fresa} mm`} />
      <Fila termino="Avance" valor={`${plan.avance} mm/min`} />
      <Fila termino="Velocidad" valor={`${plan.rpm.toLocaleString("es-MX")} rpm`} />
      <Fila termino="Contornos" valor={`${plan.contornos_exteriores} exterior · ${plan.contornos_interiores} interior`} />
      <Fila termino="Pestañas" valor={String(plan.pestanas)} />
    </dl>

    {plan.advertencias.length > 0 && (
      <div className="border-t border-[#E7E4DC] bg-[#FBF5E9] px-5 py-4">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B5A2E]">Revisa esto</p>
        <ul className="mt-2 flex flex-col gap-2 text-[13px] text-[#6B5A2E] leading-relaxed">
          {plan.advertencias.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </div>
    )}

    <div className="border-t border-[#E7E4DC] px-5 py-4">
      <button
        type="button"
        onClick={onDescargar}
        className="w-full bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
      >
        Descargar el G-code
      </button>
      <p className="mt-2.5 text-[12px] text-[#6B6A63] leading-snug">
        Pruébalo primero en material de desecho. Las medidas están calculadas, pero el
        avance y las revoluciones dependen de tu máquina.
      </p>
    </div>
  </div>
)

const CLASE =
  "w-full rounded-[10px] border border-[#E7E4DC] bg-white px-3.5 py-2.5 text-[15px] text-[#1B1B18] outline-none focus:border-[#C2560A]"

const Campo = ({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[13px] font-semibold text-[#4A4943]">{etiqueta}</span>
    {children}
  </label>
)

const Fila = ({ termino, valor }: { termino: string; valor: string }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-[#6B6A63]">{termino}</dt>
    <dd className="text-[#1B1B18] font-medium text-right">{valor}</dd>
  </div>
)
