"use client"

import { useMemo, useState } from "react"

import {
  calcularPrecio,
  type ResultadoCalculo,
  type ServicioCatalogo,
} from "@/lib/cotizador/acciones"
import { dinero } from "@/lib/cotizador/formato"

// Tantea un precio sin guardar nada. Expone los parámetros que el motor usa
// en todos los servicios (medidas, tiempo, cantidad, complejidad, material).
// Los que son de un servicio en particular -- el calibre del plasma, el
// material del láser CO2 -- todavía no tienen control aquí: el motor los toma
// por su valor por omisión. Van cuando se arme la pantalla por servicio.
const COMPLEJIDADES = [
  { valor: "simple", etiqueta: "Simple" },
  { valor: "normal", etiqueta: "Normal" },
  { valor: "compleja", etiqueta: "Compleja" },
]

type Estado = {
  servicio: string
  tipo: string
  cantidad: string
  largo: string
  ancho: string
  alto: string
  horas: string
  minutos: string
  complejidad: string
  clienteTraeMaterial: boolean
  materialLibreNombre: string
  materialLibrePrecio: string
  aplicarIva: boolean
  descripcionEditable: string
}

const INICIAL: Estado = {
  servicio: "",
  tipo: "",
  cantidad: "1",
  largo: "",
  ancho: "",
  alto: "",
  horas: "",
  minutos: "",
  complejidad: "normal",
  clienteTraeMaterial: false,
  materialLibreNombre: "",
  materialLibrePrecio: "",
  aplicarIva: false,
  descripcionEditable: "",
}

const num = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const Calculadora = ({
  servicios,
  moneda,
}: {
  servicios: ServicioCatalogo[]
  moneda: string
}) => {
  const [estado, setEstado] = useState<Estado>(() => ({
    ...INICIAL,
    servicio: servicios[0]?.clave || "",
    tipo: servicios[0]?.tipos[0] || "",
  }))
  const [calculando, setCalculando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null)
  const [costosPropios, setCostosPropios] = useState(true)

  const servicioActual = useMemo(
    () => servicios.find((s) => s.clave === estado.servicio),
    [servicios, estado.servicio]
  )

  const cambiarServicio = (clave: string) => {
    const s = servicios.find((x) => x.clave === clave)
    // El tipo pertenece al servicio: dejar el anterior mandaría al backend una
    // combinación que no existe y respondería 400.
    setEstado((p) => ({ ...p, servicio: clave, tipo: s?.tipos[0] || "" }))
    setResultado(null)
  }

  const calcular = async (e: React.FormEvent) => {
    e.preventDefault()
    setCalculando(true)
    setError(null)

    const res = await calcularPrecio({
      servicio: estado.servicio,
      tipo: estado.tipo,
      cantidad: Math.max(1, num(estado.cantidad)),
      largo: num(estado.largo),
      ancho: num(estado.ancho),
      alto: num(estado.alto),
      horas: num(estado.horas),
      minutos: num(estado.minutos),
      complejidad: estado.complejidad,
      clienteTraeMaterial: estado.clienteTraeMaterial,
      materialLibreNombre: estado.materialLibreNombre,
      materialLibrePrecio: num(estado.materialLibrePrecio),
      aplicarIva: estado.aplicarIva,
      descripcionEditable: estado.descripcionEditable,
    })

    setCalculando(false)
    if (!res.ok) {
      setError(res.mensaje)
      setResultado(null)
      return
    }
    setResultado(res.datos.resultado)
    setCostosPropios(res.datos.usando_costos_propios)
  }

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-8 items-start">
      <form onSubmit={calcular} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          <Campo etiqueta="Servicio">
            <select className={CLASE} value={estado.servicio} onChange={(e) => cambiarServicio(e.target.value)}>
              {servicios.map((s) => (
                <option key={s.clave} value={s.clave}>
                  {s.emoji ? `${s.emoji} ` : ""}
                  {s.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Tipo de trabajo">
            <select
              className={CLASE}
              value={estado.tipo}
              onChange={(e) => setEstado((p) => ({ ...p, tipo: e.target.value }))}
              disabled={!servicioActual?.tipos.length}
            >
              {(servicioActual?.tipos || []).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Cantidad de piezas">
            <input className={CLASE} inputMode="numeric" value={estado.cantidad} onChange={(e) => setEstado((p) => ({ ...p, cantidad: e.target.value }))} />
          </Campo>

          <Campo etiqueta="Complejidad">
            <select className={CLASE} value={estado.complejidad} onChange={(e) => setEstado((p) => ({ ...p, complejidad: e.target.value }))}>
              {COMPLEJIDADES.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.etiqueta}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Largo (cm)">
            <input className={CLASE} inputMode="decimal" value={estado.largo} onChange={(e) => setEstado((p) => ({ ...p, largo: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Ancho (cm)">
            <input className={CLASE} inputMode="decimal" value={estado.ancho} onChange={(e) => setEstado((p) => ({ ...p, ancho: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Alto (cm)">
            <input className={CLASE} inputMode="decimal" value={estado.alto} onChange={(e) => setEstado((p) => ({ ...p, alto: e.target.value }))} />
          </Campo>

          <Campo etiqueta="Horas de trabajo">
            <input className={CLASE} inputMode="decimal" value={estado.horas} onChange={(e) => setEstado((p) => ({ ...p, horas: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Minutos adicionales">
            <input className={CLASE} inputMode="numeric" value={estado.minutos} onChange={(e) => setEstado((p) => ({ ...p, minutos: e.target.value }))} />
          </Campo>
        </div>

        <fieldset className="border border-[#E7E4DC] rounded-[12px] p-4 bg-white">
          <legend className="px-2 text-[13px] font-semibold text-[#4A4943]">Material</legend>
          <label className="flex items-center gap-2.5 text-[14px] text-[#1B1B18]">
            <input
              type="checkbox"
              checked={estado.clienteTraeMaterial}
              onChange={(e) => setEstado((p) => ({ ...p, clienteTraeMaterial: e.target.checked }))}
              className="w-4 h-4 accent-[#C2560A]"
            />
            El cliente trae el material
          </label>

          {!estado.clienteTraeMaterial && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              <Campo etiqueta="Material">
                <input className={CLASE} value={estado.materialLibreNombre} onChange={(e) => setEstado((p) => ({ ...p, materialLibreNombre: e.target.value }))} placeholder="MDF 18mm" />
              </Campo>
              <Campo etiqueta="Precio del material">
                <input className={CLASE} inputMode="decimal" value={estado.materialLibrePrecio} onChange={(e) => setEstado((p) => ({ ...p, materialLibrePrecio: e.target.value }))} />
              </Campo>
            </div>
          )}
        </fieldset>

        <Campo etiqueta="Descripción del trabajo" nota="Es el texto que se copia a la partida de la cotización.">
          <textarea className={CLASE} rows={3} value={estado.descripcionEditable} onChange={(e) => setEstado((p) => ({ ...p, descripcionEditable: e.target.value }))} />
        </Campo>

        <label className="flex items-center gap-2.5 text-[14px] text-[#1B1B18]">
          <input
            type="checkbox"
            checked={estado.aplicarIva}
            onChange={(e) => setEstado((p) => ({ ...p, aplicarIva: e.target.checked }))}
            className="w-4 h-4 accent-[#C2560A]"
          />
          Incluir IVA en el total
        </label>

        <div>
          <button
            type="submit"
            disabled={calculando || !estado.servicio}
            className="bg-[#C2560A] hover:bg-[#A84A08] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-[10px] text-[15px]"
          >
            {calculando ? "Calculando…" : "Calcular precio"}
          </button>
          {error && <p role="alert" className="mt-3 text-[14px] font-medium text-[#9B3225]">{error}</p>}
        </div>
      </form>

      <aside className="lg:sticky lg:top-6">
        {!resultado ? (
          <div className="rounded-[14px] border border-dashed border-[#D9D5CC] bg-white px-5 py-8 text-center text-[14px] text-[#6B6A63]">
            Captura los datos del trabajo y el precio aparece aquí.
          </div>
        ) : (
          <ResultadoPrecio resultado={resultado} costosPropios={costosPropios} moneda={moneda} />
        )}
      </aside>
    </div>
  )
}

const ResultadoPrecio = ({
  resultado,
  costosPropios,
  moneda,
}: {
  resultado: ResultadoCalculo
  costosPropios: boolean
  moneda: string
}) => (
  <div className="rounded-[14px] border border-[#E7E4DC] bg-white overflow-hidden">
    <div className="bg-[#142033] text-white px-5 py-4">
      <p className="text-[12px] uppercase tracking-wide text-[#9FB0C9]">Precio recomendado</p>
      <p className="text-[30px] font-bold leading-tight tabular-nums">{dinero(resultado.pvRecomendado, moneda)}</p>
      <p className="mt-1 text-[13px] text-[#9FB0C9]">
        Margen {resultado.margenReal.toFixed(1)}% · {resultado.tiempoHoras.toFixed(2)} h de trabajo
      </p>
    </div>

    <dl className="px-5 py-4 flex flex-col gap-2.5 text-[14px]">
      <Fila termino="Mínimo aceptable" valor={dinero(resultado.pvMinimo, moneda)} />
      <Fila termino="Premium" valor={dinero(resultado.pvPremium, moneda)} />
      <Fila termino="Tu costo" valor={dinero(resultado.costoTotal, moneda)} />
      <Fila termino="Utilidad" valor={dinero(resultado.utilidad, moneda)} fuerte />
      <Fila termino="Ganancia por hora" valor={dinero(resultado.gananciaHora, moneda)} />
      {resultado.incluyeIva && (
        <>
          <Fila termino="IVA" valor={dinero(resultado.iva, moneda)} />
          <Fila termino="Total con IVA" valor={dinero(resultado.total, moneda)} fuerte />
        </>
      )}
    </dl>

    <div className="border-t border-[#E7E4DC] px-5 py-4">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6A63]">De dónde sale el costo</p>
      <dl className="mt-2.5 flex flex-col gap-1.5 text-[13px]">
        {Object.entries(resultado.costosDesglose)
          .filter(([, monto]) => Number(monto) > 0)
          .map(([concepto, monto]) => (
            <Fila key={concepto} termino={concepto} valor={dinero(monto, moneda)} />
          ))}
      </dl>
    </div>

    {!costosPropios && (
      <p className="border-t border-[#E7E4DC] bg-[#FBF5E9] px-5 py-3.5 text-[13px] text-[#6B5A2E] leading-relaxed">
        Este precio se calculó con costos de referencia, no con los tuyos. Captúralos en
        “Mi taller” para que el margen sea real.
      </p>
    )}
  </div>
)

const Fila = ({ termino, valor, fuerte }: { termino: string; valor: string; fuerte?: boolean }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-[#6B6A63]">{termino}</dt>
    <dd className={`tabular-nums ${fuerte ? "font-bold text-[#1B1B18]" : "text-[#1B1B18]"}`}>{valor}</dd>
  </div>
)

const CLASE =
  "w-full rounded-[10px] border border-[#E7E4DC] bg-white px-3.5 py-2.5 text-[15px] text-[#1B1B18] outline-none focus:border-[#C2560A] disabled:bg-[#F5F4F1]"

const Campo = ({
  etiqueta,
  nota,
  children,
}: {
  etiqueta: string
  nota?: string
  children: React.ReactNode
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[13px] font-semibold text-[#4A4943]">{etiqueta}</span>
    {children}
    {nota && <span className="text-[12px] text-[#6B6A63] leading-snug">{nota}</span>}
  </label>
)
