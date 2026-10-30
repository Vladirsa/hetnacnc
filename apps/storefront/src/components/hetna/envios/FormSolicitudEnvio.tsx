"use client"

import { useState, useTransition } from "react"

import { solicitarEnvio, type ContactoEnvio, type CotizacionGuardada } from "@/lib/envios/cotizar"

// Mismo cálculo que el servidor (lib/envios.ts); el servidor es el que cobra
const costoProteccion = (p: NonNullable<CotizacionGuardada["proteccion"]>, valor: number) =>
  Math.round(Math.max(p.minimo, valor * p.tasa) * 100) / 100

const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const CAMPO = "h-11 w-full rounded-xl border border-[#E7E4DC] bg-white px-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
const ETIQUETA = "mb-1 block text-[13px] font-semibold text-[#142033]"

const vacio: ContactoEnvio = { nombre: "", telefono: "", email: "", calle: "", referencias: "", empresa: "" }

function Bloque({ titulo, lugar, v, set }: {
  titulo: string
  lugar: CotizacionGuardada["origen"]
  v: ContactoEnvio
  set: (c: ContactoEnvio) => void
}) {
  const campo = (k: keyof ContactoEnvio, label: string, extra: Record<string, unknown> = {}) => (
    <div>
      <label className={ETIQUETA} htmlFor={`${titulo}-${k}`}>{label}</label>
      <input id={`${titulo}-${k}`} value={v[k] || ""} onChange={(e) => set({ ...v, [k]: e.target.value })} className={CAMPO} {...extra} />
    </div>
  )
  return (
    <fieldset className="grid gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-4 sm:p-5">
      <legend className="px-1 text-base font-extrabold text-[#142033]">{titulo}</legend>
      <p className="rounded-xl bg-[#F3F1EA] px-3 py-2 text-sm text-[#40403A]">
        Col. {lugar.colonia}, {[lugar.municipio, lugar.estado].filter(Boolean).join(", ")} · C.P. {lugar.cp}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("nombre", "Nombre completo", { required: true, autoComplete: "name" })}
        {campo("empresa", "Empresa (opcional)")}
        {campo("telefono", "Teléfono (10 dígitos)", { required: true, inputMode: "tel", autoComplete: "tel" })}
        {campo("email", "Correo", { required: true, type: "email", autoComplete: "email" })}
      </div>
      {campo("calle", "Calle, número exterior e interior", { required: true, autoComplete: "street-address" })}
      {campo("referencias", "Referencias (opcional)", { placeholder: "Entre calles, color de fachada…" })}
    </fieldset>
  )
}

export default function FormSolicitudEnvio({ cot, cliente, volver }: {
  cot: CotizacionGuardada
  cliente: { nombre: string; email: string; telefono: string }
  volver: string
}) {
  const [origen, setOrigen] = useState<ContactoEnvio>({ ...vacio, nombre: cliente.nombre, email: cliente.email, telefono: cliente.telefono })
  const [destino, setDestino] = useState<ContactoEnvio>(vacio)
  const [contenido, setContenido] = useState("")
  const [acepta, setAcepta] = useState(false)
  const [aceptaEvidencia, setAceptaEvidencia] = useState(false)
  const [estado, setEstado] = useState<"nuevo" | "usado" | "">("")
  const [proteger, setProteger] = useState(false)
  const [aceptaProteccion, setAceptaProteccion] = useState(false)
  const [valor, setValor] = useState("")
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  // Protección: el costo se calcula aquí para mostrarlo; el servidor lo vuelve a calcular al cobrar
  const p = cot.proteccion
  const valorNum = Number(valor.replace(/[^\d.]/g, "")) || 0
  const valorOk = Boolean(p && valorNum >= p.valorMinimo && valorNum <= p.valorMaximo)
  const protegido = proteger && estado !== "usado"
  const costo = protegido && p && valorOk ? costoProteccion(p, valorNum) : 0
  const total = Math.round((cot.opcion.precio + costo) * 100) / 100

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!estado) return setError("Indica si lo que envías es nuevo o usado.")
    if (protegido && !valorOk && p)
      return setError(`El valor a proteger debe ser entre ${pesos(p.valorMinimo)} y ${pesos(p.valorMaximo)} MXN.`)
    if (protegido && !aceptaProteccion) return setError("Acepta las condiciones de la protección o desmárcala.")
    iniciar(async () => {
      setError("")
      const r = await solicitarEnvio({
        cotizacion_id: cot.cotizacion_id,
        tarifa_id: cot.opcion.tarifa_id,
        origen,
        destino,
        contenido,
        acepta,
        acepta_evidencia: aceptaEvidencia,
        contenido_estado: estado,
        proteccion_valor: protegido ? valorNum : undefined,
      })
      if (r.ok) {
        window.location.href = r.pago_url
        return
      }
      if (r.login) {
        window.location.href = `${volver.split("/servicios")[0]}/login?volver=${encodeURIComponent(volver)}`
        return
      }
      setError(r.mensaje)
    })
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      <Bloque titulo="Remitente (origen)" lugar={cot.origen} v={origen} set={setOrigen} />
      <Bloque titulo="Destinatario" lugar={cot.destino} v={destino} set={setDestino} />
      <div className="rounded-2xl border border-[#E7E4DC] bg-white p-4 sm:p-5">
        <label className={ETIQUETA} htmlFor="contenido">¿Qué contiene el paquete?</label>
        <input
          id="contenido"
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          required
          maxLength={200}
          className={CAMPO}
          placeholder="Ej. Piezas de MDF cortadas, fresas para router…"
        />
        <fieldset className="mt-4">
          <legend className={ETIQUETA}>Lo que envías es…</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["nuevo", "Nuevo"],
                ["usado", "Usado o seminuevo"],
              ] as const
            ).map(([v, t]) => (
              <label
                key={v}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                  estado === v ? "border-[#C2560A] bg-[#FFF1E6] text-[#142033]" : "border-[#E7E4DC] text-[#40403A]"
                }`}
              >
                <input type="radio" name="estado" checked={estado === v} onChange={() => setEstado(v)} required className="accent-[#C2560A]" />
                {t}
              </label>
            ))}
          </div>
          {estado === "usado" && (
            <p className="mt-2 text-xs text-[#6B675C]">Los artículos usados o seminuevos se pueden enviar, pero no se pueden proteger.</p>
          )}
        </fieldset>
        <div className="mt-4 rounded-xl border border-[#F2C98F] bg-[#FFF8EE] p-3 text-sm text-[#5A3A12]">
          <strong>Aviso de cobros extra:</strong> la paquetería vuelve a pesar y medir el paquete. Si encuentra más peso o medidas que las
          cotizadas ({cot.paquete.largo}×{cot.paquete.ancho}×{cot.paquete.alto} cm, {cot.paquete.peso} kg), cobra la diferencia y esa diferencia
          la pagas tú.
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm text-[#40403A]">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1" required />
          <span>
            Confirmo que las medidas y el peso son los del paquete ya embalado y que no contiene artículos prohibidos por la paquetería. Acepto
            pagar los cobros extra (sobrepeso) si el paquete no coincide con lo cotizado.
          </span>
        </label>
        <label className="mt-3 flex items-start gap-2 text-sm text-[#40403A]">
          <input type="checkbox" checked={aceptaEvidencia} onChange={(e) => setAceptaEvidencia(e.target.checked)} className="mt-1" required />
          <span>
            Tengo evidencia fotográfica de las medidas (alto, largo y ancho con cinta métrica) y del peso en báscula, y la subiré en{" "}
            <strong>Mis envíos</strong> con la guía visible antes de entregar el paquete. Sin esa evidencia no se puede disputar un sobrepeso
            ni reclamar la protección.{" "}
            <a href="/mx/servicios/envios-hetna/condiciones" target="_blank" className="font-semibold text-[#C2560A] underline">
              Condiciones de Envíos HETNA
            </a>
          </span>
        </label>
      </div>
      {p && (
        <div className={`rounded-2xl border p-4 sm:p-5 ${protegido ? "border-[#1E7B3A] bg-[#F3FAF5]" : "border-[#E7E4DC] bg-white"} ${estado === "usado" ? "opacity-60" : ""}`}>
          <label className={`flex items-start gap-3 ${estado === "usado" ? "cursor-not-allowed" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={protegido}
              disabled={estado === "usado"}
              onChange={(e) => setProteger(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#1E7B3A]"
            />
            <span>
              <strong className="block text-[15px] text-[#142033]">Proteger mi envío</strong>
              <span className="text-sm text-[#40403A]">
                Para piezas nuevas frágiles o de valor. Cubre daño, faltante, extravío o robo durante el traslado hasta el valor que declares
                (máximo {pesos(p.valorMaximo)}). Cuesta alrededor de {(p.tasa * 100).toLocaleString("es-MX", { maximumFractionDigits: 2 })}% del
                valor declarado. No es un seguro: es la SOS Protección de Skydropx y aplica según sus condiciones.{" "}
                <a href="https://www.skydropx.com/legal/proteccion-sos/" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1E7B3A] underline">
                  Ver condiciones
                </a>
              </span>
            </span>
          </label>
          {estado === "usado" && <p className="mt-2 text-sm font-semibold text-[#8A1C14]">No disponible para artículos usados o seminuevos.</p>}
          {protegido && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className={ETIQUETA} htmlFor="valor">Valor de lo que envías (MXN)</label>
                <input
                  id="valor"
                  value={valor}
                  onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, "").replace(/,/g, ""))}
                  inputMode="decimal"
                  required
                  className={CAMPO}
                  placeholder={`Entre ${pesos(p.valorMinimo)} y ${pesos(p.valorMaximo)}`}
                />
                <p className="mt-1 text-xs text-[#6B675C]">
                  Declara el valor real, sin IVA, que puedas comprobar con factura: el reembolso es por lo menor entre lo declarado y la
                  factura.
                </p>
              </div>
              <p className="text-right text-sm text-[#40403A]">
                Protección
                <strong className="block text-xl text-[#142033]">{valorOk ? pesos(costo) : "—"}</strong>
              </p>
              <ul className="m-0 grid gap-1 rounded-xl bg-white/70 p-3 text-xs text-[#40403A] sm:col-span-2">
                <li>
                  <strong>No cubre:</strong> artículos usados o de segunda mano; celulares, tablets, laptops y computadoras; equipo médico o
                  científico; artículos prohibidos por la paquetería; paquetes con embalaje insuficiente (caja débil, sin relleno, mal sellada).
                </li>
                <li>
                  <strong>Si llega dañado o incompleto:</strong> si el empaque viene alterado, recházalo con la paquetería; toma fotos y video del
                  paquete con la guía visible y del contenido, y escríbenos con tu folio y la factura dentro de las 48 horas hábiles después de
                  recibirlo. Nosotros hacemos el reclamo.
                </li>
                <li>
                  <strong>Reembolso:</strong> según la resolución de Skydropx (daño leve 25%, moderado 50%, irreparable o extravío 100% de lo
                  comprobado, sin IVA ni costo de guía). Te lo regresamos en cuanto Skydropx lo acredita.
                </li>
              </ul>
              <label className="flex items-start gap-2 text-sm text-[#40403A] sm:col-span-2">
                <input type="checkbox" checked={aceptaProteccion} onChange={(e) => setAceptaProteccion(e.target.checked)} className="mt-1" />
                <span>Entiendo que no es un seguro y acepto las condiciones de la protección.</span>
              </label>
            </div>
          )}
        </div>
      )}
      {error && <p className="rounded-xl bg-[#FDECEA] p-3 text-sm text-[#B3261E]">{error}</p>}
      <button
        type="submit"
        disabled={pendiente || cot.vencida}
        className="h-12 rounded-xl bg-[#C2560A] px-6 font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {pendiente ? "Preparando tu pago…" : `Pagar ${pesos(total)} MXN con Mercado Pago`}
      </button>
    </form>
  )
}
