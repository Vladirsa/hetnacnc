"use client"

import { useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { crearCotizacion } from "@/lib/cotizador/acciones"
import { dinero } from "@/lib/cotizador/formato"

type PartidaForm = {
  concepto: string
  descripcion: string
  cantidad: string
  unidad: string
  precio_unitario: string
  material: string
  proceso: string
  tolerancia: string
  acabado: string
}

const PARTIDA_VACIA: PartidaForm = {
  concepto: "",
  descripcion: "",
  cantidad: "1",
  unidad: "pza",
  precio_unitario: "",
  material: "",
  proceso: "",
  tolerancia: "",
  acabado: "",
}

const num = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const FormNuevaCotizacion = ({
  moneda,
  ivaPct,
  condicionesPago,
  diasEntrega,
}: {
  moneda: string
  ivaPct: number
  condicionesPago: string
  diasEntrega: string
}) => {
  const router = useRouter()
  // router.push no pone el prefijo de idioma; LocalizedClientLink lo saca de
  // useParams y aquí se hace igual para que la navegación no pierda el locale.
  const params = useParams()
  const locale = (params?.locale as string) || "mx"

  const [cliente, setCliente] = useState({
    cliente_nombre: "",
    cliente_empresa: "",
    cliente_correo: "",
    cliente_telefono: "",
    cliente_rfc: "",
    cliente_direccion: "",
    proyecto_referencia: "",
  })
  const [partidas, setPartidas] = useState<PartidaForm[]>([{ ...PARTIDA_VACIA }])
  const [comercial, setComercial] = useState({
    descuento: "",
    envio: "",
    aplicar_iva: true,
    condiciones_pago: condicionesPago,
    dias_entrega: diasEntrega,
    resumen_ejecutivo: "",
    supuestos: "",
    notas_internas: "",
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Los mismos totales que calcula el backend (totalesDeCotizacion). Se
  // repiten aquí sólo para que el taller vea el total mientras captura; el
  // que se guarda es el del servidor, que es el que manda.
  const totales = useMemo(() => {
    const subtotal = partidas.reduce((acc, p) => acc + num(p.cantidad) * num(p.precio_unitario), 0)
    const descuento = num(comercial.descuento)
    const envio = num(comercial.envio)
    const base = Math.max(0, subtotal - descuento)
    const iva = comercial.aplicar_iva ? base * (ivaPct / 100) : 0
    return { subtotal, descuento, envio, iva, total: base + iva + envio }
  }, [partidas, comercial.descuento, comercial.envio, comercial.aplicar_iva, ivaPct])

  const setPartida = (i: number, clave: keyof PartidaForm, valor: string) =>
    setPartidas((p) => p.map((fila, j) => (j === i ? { ...fila, [clave]: valor } : fila)))

  const agregarPartida = () => setPartidas((p) => [...p, { ...PARTIDA_VACIA }])
  const quitarPartida = (i: number) => setPartidas((p) => (p.length === 1 ? p : p.filter((_, j) => j !== i)))

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!cliente.cliente_nombre.trim()) {
      setError("El nombre del cliente es obligatorio.")
      return
    }
    const conConcepto = partidas.filter((p) => p.concepto.trim())
    if (!conConcepto.length) {
      setError("Agrega al menos una partida con concepto.")
      return
    }

    setEnviando(true)
    setError(null)

    const res = await crearCotizacion({
      ...cliente,
      moneda,
      descuento: num(comercial.descuento),
      envio: num(comercial.envio),
      aplicar_iva: comercial.aplicar_iva,
      condiciones_pago: comercial.condiciones_pago || null,
      dias_entrega: comercial.dias_entrega ? num(comercial.dias_entrega) : null,
      resumen_ejecutivo: comercial.resumen_ejecutivo || null,
      supuestos: comercial.supuestos || null,
      notas_internas: comercial.notas_internas || null,
      partidas: conConcepto.map((p, i) => ({
        posicion: i + 1,
        concepto: p.concepto,
        descripcion: p.descripcion || null,
        cantidad: Math.max(1, num(p.cantidad)),
        unidad: p.unidad || "pza",
        precio_unitario: num(p.precio_unitario),
        material: p.material || null,
        proceso: p.proceso || null,
        tolerancia: p.tolerancia || null,
        acabado: p.acabado || null,
      })),
    })

    if (!res.ok) {
      setEnviando(false)
      setError(res.mensaje)
      return
    }

    // La cotización ya existe y ya consumió folio: llevar al detalle, que es
    // desde donde se envía al cliente.
    router.push(`/${locale}/taller/cotizaciones/${res.datos.cotizacion.id}`)
  }

  return (
    <form onSubmit={enviar} className="mt-8 flex flex-col gap-10 max-w-[980px]">
      <section>
        <h2 className="text-[18px] font-bold text-[#1B1B18]">Cliente</h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          <Campo etiqueta="Nombre" requerido>
            <input className={CLASE} value={cliente.cliente_nombre} onChange={(e) => setCliente((p) => ({ ...p, cliente_nombre: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Empresa">
            <input className={CLASE} value={cliente.cliente_empresa} onChange={(e) => setCliente((p) => ({ ...p, cliente_empresa: e.target.value }))} />
          </Campo>
          <Campo etiqueta="WhatsApp o teléfono" nota="Con esto se arma el mensaje de envío.">
            <input className={CLASE} value={cliente.cliente_telefono} onChange={(e) => setCliente((p) => ({ ...p, cliente_telefono: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Correo">
            <input className={CLASE} type="email" value={cliente.cliente_correo} onChange={(e) => setCliente((p) => ({ ...p, cliente_correo: e.target.value }))} />
          </Campo>
          <Campo etiqueta="RFC">
            <input className={CLASE} value={cliente.cliente_rfc} onChange={(e) => setCliente((p) => ({ ...p, cliente_rfc: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Referencia del proyecto">
            <input className={CLASE} value={cliente.proyecto_referencia} onChange={(e) => setCliente((p) => ({ ...p, proyecto_referencia: e.target.value }))} placeholder="Herraje para prensa" />
          </Campo>
          <Campo etiqueta="Dirección" ancho>
            <input className={CLASE} value={cliente.cliente_direccion} onChange={(e) => setCliente((p) => ({ ...p, cliente_direccion: e.target.value }))} />
          </Campo>
        </div>
      </section>

      <section>
        <h2 className="text-[18px] font-bold text-[#1B1B18]">Partidas</h2>
        <p className="mt-1.5 text-[14px] text-[#6B6A63]">
          Una por cada pieza o servicio. Material, proceso, tolerancia y acabado son la
          parte técnica que el cliente compara.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {partidas.map((p, i) => (
            <div key={i} className="rounded-[12px] border border-[#E7E4DC] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-bold text-[#6B6A63]">Partida {i + 1}</span>
                {partidas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => quitarPartida(i)}
                    className="text-[13px] font-semibold text-[#9B3225] hover:underline"
                  >
                    Quitar
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-6 gap-x-4 gap-y-3">
                <div className="sm:col-span-6">
                  <Campo etiqueta="Concepto" requerido>
                    <input className={CLASE} value={p.concepto} onChange={(e) => setPartida(i, "concepto", e.target.value)} placeholder="Placa base maquinada en 3 ejes" />
                  </Campo>
                </div>
                <div className="sm:col-span-6">
                  <Campo etiqueta="Descripción">
                    <textarea className={CLASE} rows={2} value={p.descripcion} onChange={(e) => setPartida(i, "descripcion", e.target.value)} />
                  </Campo>
                </div>
                <div className="sm:col-span-1">
                  <Campo etiqueta="Cantidad">
                    <input className={CLASE} inputMode="numeric" value={p.cantidad} onChange={(e) => setPartida(i, "cantidad", e.target.value)} />
                  </Campo>
                </div>
                <div className="sm:col-span-1">
                  <Campo etiqueta="Unidad">
                    <input className={CLASE} value={p.unidad} onChange={(e) => setPartida(i, "unidad", e.target.value)} />
                  </Campo>
                </div>
                <div className="sm:col-span-2">
                  <Campo etiqueta="Precio unitario">
                    <input className={CLASE} inputMode="decimal" value={p.precio_unitario} onChange={(e) => setPartida(i, "precio_unitario", e.target.value)} />
                  </Campo>
                </div>
                <div className="sm:col-span-2 flex items-end pb-1">
                  <p className="text-[14px] text-[#6B6A63]">
                    Subtotal{" "}
                    <span className="font-bold text-[#1B1B18] tabular-nums">
                      {dinero(num(p.cantidad) * num(p.precio_unitario), moneda)}
                    </span>
                  </p>
                </div>

                <div className="sm:col-span-3">
                  <Campo etiqueta="Material">
                    <input className={CLASE} value={p.material} onChange={(e) => setPartida(i, "material", e.target.value)} placeholder="Aluminio 6061-T6" />
                  </Campo>
                </div>
                <div className="sm:col-span-3">
                  <Campo etiqueta="Proceso">
                    <input className={CLASE} value={p.proceso} onChange={(e) => setPartida(i, "proceso", e.target.value)} placeholder="Fresado 3 ejes" />
                  </Campo>
                </div>
                <div className="sm:col-span-3">
                  <Campo etiqueta="Tolerancia">
                    <input className={CLASE} value={p.tolerancia} onChange={(e) => setPartida(i, "tolerancia", e.target.value)} placeholder="±0.05 mm" />
                  </Campo>
                </div>
                <div className="sm:col-span-3">
                  <Campo etiqueta="Acabado">
                    <input className={CLASE} value={p.acabado} onChange={(e) => setPartida(i, "acabado", e.target.value)} placeholder="Anodizado natural" />
                  </Campo>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={agregarPartida}
          className="mt-4 border border-[#E7E4DC] hover:border-[#C2560A] text-[#1B1B18] font-semibold px-4 py-2.5 rounded-[10px] text-[14px]"
        >
          + Agregar partida
        </button>
      </section>

      <section>
        <h2 className="text-[18px] font-bold text-[#1B1B18]">Condiciones y totales</h2>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <Campo etiqueta="Descuento">
              <input className={CLASE} inputMode="decimal" value={comercial.descuento} onChange={(e) => setComercial((p) => ({ ...p, descuento: e.target.value }))} />
            </Campo>
            <Campo etiqueta="Envío">
              <input className={CLASE} inputMode="decimal" value={comercial.envio} onChange={(e) => setComercial((p) => ({ ...p, envio: e.target.value }))} />
            </Campo>
            <Campo etiqueta="Condiciones de pago">
              <input className={CLASE} value={comercial.condiciones_pago} onChange={(e) => setComercial((p) => ({ ...p, condiciones_pago: e.target.value }))} />
            </Campo>
            <Campo etiqueta="Días de entrega">
              <input className={CLASE} inputMode="numeric" value={comercial.dias_entrega} onChange={(e) => setComercial((p) => ({ ...p, dias_entrega: e.target.value }))} />
            </Campo>
            <Campo etiqueta="Resumen ejecutivo" ancho nota="Las dos líneas que lee quien decide.">
              <textarea className={CLASE} rows={3} value={comercial.resumen_ejecutivo} onChange={(e) => setComercial((p) => ({ ...p, resumen_ejecutivo: e.target.value }))} />
            </Campo>
            <Campo etiqueta="Supuestos" ancho nota="De qué depende este precio. Es lo que te protege si cambia el alcance.">
              <textarea className={CLASE} rows={3} value={comercial.supuestos} onChange={(e) => setComercial((p) => ({ ...p, supuestos: e.target.value }))} />
            </Campo>
            <Campo etiqueta="Notas internas" ancho nota="No salen en el documento del cliente.">
              <textarea className={CLASE} rows={2} value={comercial.notas_internas} onChange={(e) => setComercial((p) => ({ ...p, notas_internas: e.target.value }))} />
            </Campo>
          </div>

          <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-5 lg:sticky lg:top-6">
            <dl className="flex flex-col gap-2 text-[14px]">
              <Fila termino="Subtotal" valor={dinero(totales.subtotal, moneda)} />
              {totales.descuento > 0 && <Fila termino="Descuento" valor={`− ${dinero(totales.descuento, moneda)}`} />}
              <label className="flex items-center gap-2.5 py-1 text-[14px] text-[#1B1B18]">
                <input
                  type="checkbox"
                  checked={comercial.aplicar_iva}
                  onChange={(e) => setComercial((p) => ({ ...p, aplicar_iva: e.target.checked }))}
                  className="w-4 h-4 accent-[#C2560A]"
                />
                Aplicar IVA ({ivaPct}%)
              </label>
              {comercial.aplicar_iva && <Fila termino="IVA" valor={dinero(totales.iva, moneda)} />}
              {totales.envio > 0 && <Fila termino="Envío" valor={dinero(totales.envio, moneda)} />}
            </dl>
            <div className="mt-3 pt-3 border-t border-[#E7E4DC] flex justify-between items-baseline">
              <span className="text-[14px] font-semibold text-[#4A4943]">Total</span>
              <span className="text-[22px] font-bold text-[#1B1B18] tabular-nums">
                {dinero(totales.total, moneda)}
              </span>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="mt-5 w-full bg-[#C2560A] hover:bg-[#A84A08] disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
            >
              {enviando ? "Emitiendo…" : "Emitir cotización"}
            </button>
            <p className="mt-2.5 text-[12px] text-[#6B6A63] leading-snug">
              Al emitirla se consume un folio y cuenta para tu cupo del mes. Todavía no se
              manda al cliente: eso se hace desde el detalle.
            </p>
            {error && <p role="alert" className="mt-3 text-[13px] font-medium text-[#9B3225]">{error}</p>}
          </div>
        </div>
      </section>
    </form>
  )
}

const CLASE =
  "w-full rounded-[10px] border border-[#E7E4DC] bg-white px-3.5 py-2.5 text-[15px] text-[#1B1B18] outline-none focus:border-[#C2560A]"

const Fila = ({ termino, valor }: { termino: string; valor: string }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-[#6B6A63]">{termino}</dt>
    <dd className="tabular-nums text-[#1B1B18]">{valor}</dd>
  </div>
)

const Campo = ({
  etiqueta,
  nota,
  requerido,
  ancho,
  children,
}: {
  etiqueta: string
  nota?: string
  requerido?: boolean
  ancho?: boolean
  children: React.ReactNode
}) => (
  <label className={`flex flex-col gap-1.5 ${ancho ? "sm:col-span-2" : ""}`}>
    <span className="text-[13px] font-semibold text-[#4A4943]">
      {etiqueta}
      {requerido && <span className="text-[#C2560A]"> *</span>}
    </span>
    {children}
    {nota && <span className="text-[12px] text-[#6B6A63] leading-snug">{nota}</span>}
  </label>
)
