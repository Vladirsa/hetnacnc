"use client"

import { useEffect, useState, useTransition } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { buscarCP, cotizarEnvio, type InfoCP, type OpcionEnvio } from "@/lib/envios/cotizar"

const CAMPO =
  "h-11 w-full rounded-xl border border-[#E7E4DC] bg-white px-3 text-sm text-[#142033] outline-none focus:border-[#C2560A] disabled:bg-[#F3F1EA]"
const ETIQUETA = "mb-1 block text-[13px] font-semibold text-[#142033]"
const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`

const EMPAQUES = ["Caja de cartón", "Sobre", "Tubo", "Bolsa o paquete blando", "Tarima o bulto"]
const MEDIDAS: { nombre: string; tipo: string; largo: string; ancho: string; alto: string; peso: string }[] = [
  { nombre: "Sobre", tipo: "Sobre", largo: "35", ancho: "25", alto: "2", peso: "0.5" },
  { nombre: "Caja chica", tipo: "Caja de cartón", largo: "25", ancho: "20", alto: "15", peso: "1" },
  { nombre: "Caja mediana", tipo: "Caja de cartón", largo: "40", ancho: "30", alto: "30", peso: "5" },
  { nombre: "Caja grande", tipo: "Caja de cartón", largo: "60", ancho: "40", alto: "40", peso: "10" },
]

// Código postal + colonia (las colonias salen del catálogo de Correos de México)
function CampoCP({ id, titulo, cp, setCp, colonia, setColonia, setInfo }: {
  id: string
  titulo: string
  cp: string
  setCp: (v: string) => void
  colonia: string
  setColonia: (v: string) => void
  setInfo: (v: InfoCP | null) => void
}) {
  const [info, setLocal] = useState<InfoCP | null>(null)
  const [error, setError] = useState("")
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    setLocal(null)
    setInfo(null)
    setColonia("")
    setError("")
    if (!/^\d{5}$/.test(cp)) return
    let vigente = true
    setBuscando(true)
    buscarCP(cp).then((r) => {
      if (!vigente) return
      setBuscando(false)
      if (!r.ok) return setError(r.mensaje)
      setLocal(r.info)
      setInfo(r.info)
      if (r.info.colonias.length === 1) setColonia(r.info.colonias[0].nombre)
    })
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp])

  return (
    <fieldset className="grid gap-3 rounded-2xl border border-[#E7E4DC] p-4">
      <legend className="px-1 text-sm font-extrabold text-[#142033]">{titulo}</legend>
      <div>
        <label className={ETIQUETA} htmlFor={`cp_${id}`}>Código postal</label>
        <input
          id={`cp_${id}`}
          value={cp}
          onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 5))}
          inputMode="numeric"
          required
          className={CAMPO}
          placeholder="Ej. 64000"
        />
        {buscando && <p className="mt-1 text-xs text-[#6B675C]">Buscando colonias…</p>}
        {error && <p className="mt-1 text-xs text-[#B3261E]">{error}</p>}
        {info && (
          <p className="mt-1 text-xs text-[#6B675C]">
            {[info.municipio, info.estado].filter(Boolean).join(", ")}
          </p>
        )}
      </div>
      {info && info.colonias.length > 0 && (
        <div>
          <label className={ETIQUETA} htmlFor={`col_${id}`}>Colonia</label>
          <select id={`col_${id}`} value={colonia} onChange={(e) => setColonia(e.target.value)} required className={CAMPO}>
            <option value="">Elige la colonia…</option>
            {info.colonias.map((c) => (
              <option key={c.nombre} value={c.nombre}>
                {c.nombre}
                {c.tipo && c.tipo !== "Colonia" ? ` (${c.tipo})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  )
}

const Dato = ({ ok, texto }: { ok: boolean; texto: string }) => (
  <span className={`inline-flex items-center gap-1.5 ${ok ? "text-[#142033]" : "text-[#9A968B] line-through"}`}>
    <span className={`h-2 w-2 rounded-full ${ok ? "bg-[#1E7B3A]" : "bg-[#C9C5BA]"}`} />
    {texto}
  </span>
)

export default function CotizadorEnvio() {
  const [cpO, setCpO] = useState("")
  const [colO, setColO] = useState("")
  const [infoO, setInfoO] = useState<InfoCP | null>(null)
  const [cpD, setCpD] = useState("")
  const [colD, setColD] = useState("")
  const [infoD, setInfoD] = useState<InfoCP | null>(null)
  const [tipo, setTipo] = useState(EMPAQUES[0])
  const [m, setM] = useState({ largo: "", ancho: "", alto: "", peso: "" })

  const [cotizacion, setCotizacion] = useState("")
  const [opciones, setOpciones] = useState<OpcionEnvio[] | null>(null)
  const [info, setInfo] = useState("")
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  const faltaColonia = (i: InfoCP | null, c: string) => Boolean(i && i.colonias.length > 0 && !c)

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!infoO || !infoD) return setError("Revisa los códigos postales de origen y destino.")
    if (faltaColonia(infoO, colO) || faltaColonia(infoD, colD)) return setError("Elige la colonia de origen y de destino.")
    iniciar(async () => {
      setError("")
      setOpciones(null)
      const r = await cotizarEnvio({ cp_origen: cpO, colonia_origen: colO, cp_destino: cpD, colonia_destino: colD, tipo, ...m })
      if (!r.ok) return setError(r.mensaje)
      setCotizacion(r.cotizacion_id || "")
      setOpciones(r.opciones)
      setInfo(
        r.aviso ||
          (r.peso_cobrado && r.peso_cobrado > Number(m.peso)
            ? `Por el tamaño del paquete, las paqueterías cobran ${r.peso_cobrado} kg (peso volumétrico).`
            : "")
      )
    })
  }

  return (
    <section id="cotizar-envio" className="mt-8 scroll-mt-28 rounded-3xl border border-[#E7E4DC] bg-white p-5 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#C2560A]">Cotiza al momento</p>
      <h2 className="mt-1 text-2xl font-extrabold text-[#142033]">¿Cuánto cuesta tu envío?</h2>
      <p className="mt-1 text-sm text-[#6B675C]">Compara paqueterías con precio final, días de entrega y forma de recolección.</p>

      <form onSubmit={enviar} className="mt-5 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <CampoCP id="o" titulo="Origen" cp={cpO} setCp={setCpO} colonia={colO} setColonia={setColO} setInfo={setInfoO} />
          <CampoCP id="d" titulo="Destino" cp={cpD} setCp={setCpD} colonia={colD} setColonia={setColD} setInfo={setInfoD} />
        </div>

        <fieldset className="grid gap-3 rounded-2xl border border-[#E7E4DC] p-4">
          <legend className="px-1 text-sm font-extrabold text-[#142033]">Paquete</legend>
          <div className="flex flex-wrap gap-2">
            {MEDIDAS.map((x) => (
              <button
                key={x.nombre}
                type="button"
                onClick={() => {
                  setTipo(x.tipo)
                  setM({ largo: x.largo, ancho: x.ancho, alto: x.alto, peso: x.peso })
                }}
                className="rounded-full border border-[#E7E4DC] px-3 py-1.5 text-xs font-semibold text-[#142033] hover:border-[#C2560A] hover:text-[#C2560A]"
              >
                {x.nombre} · {x.largo}×{x.ancho}×{x.alto}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="sm:col-span-5 md:col-span-1">
              <label className={ETIQUETA} htmlFor="tipo">Tipo</label>
              <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO}>
                {EMPAQUES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            {(
              [
                ["largo", "Largo (cm)", "30"],
                ["ancho", "Ancho (cm)", "30"],
                ["alto", "Alto (cm)", "20"],
                ["peso", "Peso (kg)", "2"],
              ] as const
            ).map(([k, label, ph]) => (
              <div key={k}>
                <label className={ETIQUETA} htmlFor={k}>{label}</label>
                <input
                  id={k}
                  value={m[k]}
                  onChange={(e) => setM({ ...m, [k]: e.target.value.replace(/[^\d.,]/g, "") })}
                  inputMode="decimal"
                  required
                  className={CAMPO}
                  placeholder={ph}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-[#6B675C]">Mide y pesa el paquete ya embalado para evitar cargos extra por sobrepeso.</p>
        </fieldset>

        <button
          type="submit"
          disabled={pendiente}
          className="h-12 w-full rounded-xl bg-[#C2560A] px-4 font-semibold text-white hover:brightness-110 disabled:opacity-60 sm:w-auto sm:justify-self-end sm:px-10"
        >
          {pendiente ? "Cotizando…" : "Cotizar envío"}
        </button>
      </form>

      {pendiente && <p className="mt-4 text-sm text-[#6B675C]">Consultando paqueterías, tarda unos segundos…</p>}
      {error && <p className="mt-4 rounded-xl bg-[#FDECEA] p-3 text-sm text-[#B3261E]">{error}</p>}

      {opciones && (
        <div className="mt-6">
          {info && <p className="mb-3 rounded-xl bg-[#F3F1EA] p-3 text-sm text-[#40403A]">{info}</p>}
          {opciones.length === 0 ? (
            <p className="rounded-xl bg-[#F3F1EA] p-4 text-sm text-[#40403A]">No encontramos paqueterías para esa ruta. Escríbenos y lo resolvemos.</p>
          ) : (
            <ul className="grid gap-3">
              {opciones.map((o, i) => (
                <li
                  key={o.tarifa_id}
                  className={`grid gap-4 rounded-2xl border p-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center ${i === 0 ? "border-[#1E7B3A] bg-[#F3FAF5]" : "border-[#E7E4DC]"}`}
                >
                  <div>
                    <p className="text-lg font-extrabold text-[#142033]">
                      {o.paqueteria} <span className="text-sm font-normal text-[#6B675C]">· {o.servicio}</span>
                      {i === 0 && <span className="ml-2 rounded-full bg-[#1E7B3A] px-2 py-0.5 align-middle text-[11px] font-bold text-white">Más barato</span>}
                    </p>
                    <div className="mt-2 grid gap-1 text-[13px] sm:grid-cols-2">
                      <div>
                        <p className="font-semibold text-[#6B675C]">Recepción</p>
                        <div className="flex flex-wrap gap-x-3">
                          <Dato ok={o.recoleccion} texto="Con recolección" />
                          {o.llevar_sucursal && <Dato ok texto="Llevar a sucursal" />}
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-[#6B675C]">Entrega</p>
                        <div className="flex flex-wrap gap-x-3">
                          <Dato ok={o.entrega_domicilio} texto="Domicilio" />
                          {o.entrega_sucursal && <Dato ok texto="Sucursal (Ocurre)" />}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-[#40403A]">
                    <p className="font-semibold text-[#6B675C]">Tiempo estimado</p>
                    <p className="font-bold text-[#142033]">{o.dias ? `${o.dias} ${o.dias === 1 ? "día hábil" : "días hábiles"}` : "Según la paquetería"}</p>
                  </div>
                  <div className="grid gap-2 sm:text-right">
                    <p className="text-2xl font-extrabold text-[#142033]">
                      {pesos(o.precio)} <span className="text-xs font-semibold text-[#6B675C]">MXN</span>
                    </p>
                    <p className="-mt-2 text-[11px] text-[#6B675C]">IVA incluido</p>
                    {cotizacion && (
                      <LocalizedClientLink
                        href={`/servicios/envios-hetna/solicitar?c=${encodeURIComponent(cotizacion)}&t=${encodeURIComponent(o.tarifa_id)}`}
                        className="rounded-xl bg-[#142033] px-4 py-2.5 text-center text-sm font-semibold text-white hover:brightness-125"
                      >
                        Solicitar este servicio
                      </LocalizedClientLink>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-[#6B675C]">
            Precios con IVA incluido. Si el paquete real pesa o mide distinto, la paquetería puede cobrar la diferencia. Para solicitar necesitas iniciar sesión.
          </p>
        </div>
      )}
    </section>
  )
}
