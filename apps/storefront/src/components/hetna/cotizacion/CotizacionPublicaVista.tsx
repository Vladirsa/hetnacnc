"use client"

import { useEffect, useState } from "react"

import type { CotizacionPublica } from "@/lib/cotizador/liga"

// Lo que ve el cliente del taller en hetnacnc.com/c/<token>: la cotización,
// el botón de aceptar y el de pagar el anticipo (Mercado Pago del taller).
type Props = { token: string; inicial: CotizacionPublica; pago: string }

const caja = "rounded-[18px] border border-[#E7E4DC] bg-white p-5 md:p-7"
const boton =
  "inline-flex items-center justify-center rounded-[10px] bg-[#C2560A] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-60"
const botonClaro =
  "inline-flex items-center justify-center rounded-[10px] border border-[#E7E4DC] bg-white px-5 py-3 text-[15px] font-semibold text-[#1B1B18] hover:border-[#C2560A] disabled:opacity-60"
const campo =
  "w-full rounded-[10px] border border-[#E7E4DC] bg-[#FAF9F6] px-4 py-3 text-[15px] text-[#1B1B18] focus:border-[#C2560A] focus:outline-none"

let monedaPagina: "MXN" | "USD" = "MXN"
const mxn = (n: number) =>
  `$${n.toLocaleString(monedaPagina === "USD" ? "en-US" : "es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fecha = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : ""
const vence = (c: CotizacionPublica) => {
  const d = new Date(c.creada)
  d.setDate(d.getDate() + Number(c.vigencia_dias || 7))
  return d
}

async function llamar<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const res = await fetch(ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo || {}),
  })
  const d = (await res.json().catch(() => ({}))) as any
  if (!res.ok) throw new Error(d.error || "No se pudo. Intenta de nuevo.")
  return d as T
}

async function recargar(token: string): Promise<CotizacionPublica | null> {
  try {
    const r = await fetch(`/api/cotizacion-liga/${token}`, { cache: "no-store" })
    return r.ok ? ((await r.json()) as CotizacionPublica) : null
  } catch {
    return null
  }
}

export function CotizacionPublicaVista({ token, inicial, pago }: Props) {
  const [c, setC] = useState(inicial)
  const [nombre, setNombre] = useState(inicial.cliente?.nombre || "")
  const [trabajando, setTrabajando] = useState<"" | "aceptar" | "pagar" | "paypal">("")
  monedaPagina = c.moneda === "USD" ? "USD" : "MXN"
  const [error, setError] = useState("")

  // Al volver de Mercado Pago, el aviso puede tardar unos segundos: se vuelve a leer.
  useEffect(() => {
    if (pago !== "ok" && pago !== "pendiente") return
    let intentos = 0
    const t = setInterval(async () => {
      intentos += 1
      const n = await recargar(token)
      if (n) setC(n)
      if (intentos >= 6 || (n && n.anticipo.estado === "pagado")) clearInterval(t)
    }, 3000)
    return () => clearInterval(t)
  }, [pago, token])

  const aceptar = async () => {
    setError("")
    setTrabajando("aceptar")
    try {
      await llamar(`/api/cotizacion-liga/${token}/aceptar`, { nombre })
      const n = await recargar(token)
      if (n) setC(n)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setTrabajando("")
    }
  }

  const pagar = async (con: "pagar" | "paypal" = "pagar") => {
    setError("")
    setTrabajando(con)
    try {
      const r = await llamar<{ url: string }>(`/api/cotizacion-liga/${token}/${con}`)
      window.location.href = r.url
    } catch (e) {
      setError((e as Error).message)
      setTrabajando("")
    }
  }

  // Páginas viejas (sin `metodos`) sólo tenían Mercado Pago
  const metodos = c.anticipo.metodos || { mercadopago: c.anticipo.se_puede_pagar, paypal: false }
  const moneda = c.moneda === "USD" ? "USD" : "MXN"
  const resta = Math.max(0, c.anticipo.monto - c.anticipo.pagado)
  const aceptada = Boolean(c.aceptada) || c.estado === "Aprobada" || c.estado === "Pedido"
  const rechazada = c.estado === "Rechazada"
  const tel = (c.taller.telefono || "").replace(/\D/g, "")
  const wa = tel ? `https://wa.me/${tel.length === 10 ? "52" + tel : tel}?text=${encodeURIComponent(`Hola, sobre la cotización ${c.folio}`)}` : ""

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Encabezado del taller */}
      <section className={caja}>
        <div className="flex flex-wrap items-center gap-4">
          {c.taller.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.taller.logo} alt={c.taller.nombre} className="h-16 w-16 rounded-[12px] object-contain" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] uppercase tracking-wide text-[#7A776E]">Cotización {c.folio}</p>
            <h1 className="m-0 text-[24px] font-bold leading-tight text-[#142033]">{c.taller.nombre}</h1>
            <p className="m-0 mt-1 text-[14px] text-[#40403A]">
              {fecha(c.creada)} · vigente hasta el {fecha(vence(c).toISOString())}
            </p>
          </div>
          <Estado c={c} aceptada={aceptada} rechazada={rechazada} />
        </div>
        {c.cliente ? (
          <p className="m-0 mt-4 text-[15px] text-[#40403A]">
            Para: <b className="text-[#1B1B18]">{c.cliente.nombre}</b>
            {c.cliente.empresa ? ` · ${c.cliente.empresa}` : ""}
          </p>
        ) : null}
      </section>

      {/* Aviso al volver de Mercado Pago */}
      {pago === "ok" && c.anticipo.estado !== "pagado" ? (
        <Aviso tono="info">Recibimos tu pago. En unos segundos aparece aquí confirmado.</Aviso>
      ) : null}
      {pago === "pendiente" ? <Aviso tono="info">Tu pago quedó pendiente (por ejemplo, pago en efectivo). Cuando se acredite, aparecerá aquí.</Aviso> : null}
      {pago === "error" ? <Aviso tono="error">El pago no se completó. Puedes intentarlo de nuevo.</Aviso> : null}

      {/* Seguimiento del pedido */}
      {c.pedido ? <Seguimiento p={c.pedido} /> : null}

      {/* Partidas */}
      <section className={caja}>
        <h2 className="m-0 text-[17px] font-bold text-[#142033]">Lo cotizado</h2>
        <div className="mt-3 divide-y divide-[#EFEDE7]">
          {c.items.map((i, k) => (
            <div key={k} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[15px] font-semibold text-[#1B1B18]">{i.nombre}</p>
                <p className="m-0 text-[13px] text-[#7A776E]">
                  {i.cantidad} × {mxn(i.precio)}
                  {i.descuento_pct ? ` · ${i.descuento_pct}% desc.` : ""}
                  {i.sku ? ` · ${i.sku}` : ""}
                </p>
                {i.notas ? <p className="m-0 mt-1 whitespace-pre-line text-[13px] text-[#40403A]">{i.notas}</p> : null}
              </div>
              <p className="m-0 text-[15px] font-semibold text-[#1B1B18]">{mxn(i.subtotal)}</p>
            </div>
          ))}
        </div>
        <dl className="mt-3 space-y-1 border-t border-[#EFEDE7] pt-3 text-[14px] text-[#40403A]">
          <Fila k="Subtotal" v={mxn(c.subtotal)} />
          {c.descuento_pct ? <Fila k={`Descuento ${c.descuento_pct}%`} v={`− ${mxn((c.subtotal * c.descuento_pct) / 100)}`} /> : null}
          {c.descuento_fijo ? <Fila k="Descuento" v={`− ${mxn(c.descuento_fijo)}`} /> : null}
          {c.envio ? <Fila k="Envío" v={mxn(c.envio)} /> : null}
          {c.iva ? <Fila k={`IVA ${c.iva_pct}%`} v={mxn(c.iva)} /> : null}
          <div className="flex justify-between pt-1 text-[18px] font-bold text-[#142033]">
            <dt>Total</dt>
            <dd className="m-0">{mxn(c.total)} {moneda}</dd>
          </div>
        </dl>
      </section>

      {/* Condiciones */}
      {c.metodo_pago || c.condicion_entrega || c.fecha_entrega || c.dias_habiles || c.notas ? (
        <section className={caja}>
          <h2 className="m-0 text-[17px] font-bold text-[#142033]">Condiciones</h2>
          <dl className="mt-3 grid gap-2 text-[14px] text-[#40403A] sm:grid-cols-2">
            {c.metodo_pago ? <Dato k="Forma de pago" v={c.metodo_pago} /> : null}
            {c.condicion_entrega ? <Dato k="Entrega" v={c.condicion_entrega} /> : null}
            {c.fecha_entrega ? <Dato k="Fecha estimada" v={fecha(c.fecha_entrega)} /> : null}
            {c.dias_habiles ? <Dato k="Tiempo de fabricación" v={`${c.dias_habiles} días hábiles`} /> : null}
          </dl>
          {c.notas ? <p className="m-0 mt-3 whitespace-pre-line text-[14px] text-[#40403A]">{c.notas}</p> : null}
        </section>
      ) : null}

      {/* Aceptar / pagar */}
      <section className={caja}>
        {rechazada ? (
          <p className="m-0 text-[15px] text-[#40403A]">Esta cotización fue marcada como rechazada. Si quieres retomarla, escríbele al taller.</p>
        ) : c.vencida && !aceptada ? (
          <p className="m-0 text-[15px] text-[#40403A]">Esta cotización venció el {fecha(vence(c).toISOString())}. Pide al taller que la renueve.</p>
        ) : (
          <>
            {!aceptada ? (
              <>
                <h2 className="m-0 text-[17px] font-bold text-[#142033]">¿Aceptas esta cotización?</h2>
                <p className="m-0 mt-1 text-[14px] text-[#40403A]">Escribe tu nombre y acepta. El taller recibe el aviso al momento.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" maxLength={120} />
                  <button type="button" className={boton} disabled={trabajando !== "" || !nombre.trim()} onClick={aceptar}>
                    {trabajando === "aceptar" ? "Un momento…" : "Aceptar cotización"}
                  </button>
                </div>
              </>
            ) : (
              <p className="m-0 text-[15px] text-[#1B1B18]">
                ✅ Aceptada{c.aceptada?.por ? ` por ${c.aceptada.por}` : ""}{c.aceptada?.en ? ` el ${fecha(c.aceptada.en)}` : ""}.
              </p>
            )}

            {c.anticipo.estado !== "sin_anticipo" ? (
              <div className="mt-5 rounded-[12px] bg-[#FAF9F6] p-4">
                <p className="m-0 text-[13px] uppercase tracking-wide text-[#7A776E]">Anticipo</p>
                {c.anticipo.estado === "pagado" ? (
                  <p className="m-0 mt-1 text-[16px] font-semibold text-[#1B1B18]">✅ Anticipo pagado: {mxn(c.anticipo.pagado)}</p>
                ) : (
                  <>
                    <p className="m-0 mt-1 text-[22px] font-bold text-[#142033]">{mxn(resta)} {moneda}</p>
                    {c.anticipo.pagado > 0 ? <p className="m-0 text-[13px] text-[#7A776E]">Ya pagaste {mxn(c.anticipo.pagado)} de {mxn(c.anticipo.monto)}.</p> : null}
                    {metodos.mercadopago || metodos.paypal ? (
                      <>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          {metodos.mercadopago ? (
                            <button type="button" className={boton} disabled={trabajando !== ""} onClick={() => pagar("pagar")}>
                              {trabajando === "pagar" ? "Abriendo Mercado Pago…" : "Pagar con Mercado Pago"}
                            </button>
                          ) : null}
                          {metodos.paypal ? (
                            <button
                              type="button"
                              className="inline-flex items-center justify-center rounded-[10px] bg-[#FFC439] px-5 py-3 text-[15px] font-semibold text-[#111] hover:bg-[#F2B830] disabled:opacity-60"
                              disabled={trabajando !== ""}
                              onClick={() => pagar("paypal")}
                            >
                              {trabajando === "paypal" ? "Abriendo PayPal…" : "Pagar con PayPal"}
                            </button>
                          ) : null}
                        </div>
                        <p className="m-0 mt-2 text-[12px] text-[#7A776E]">
                          {metodos.mercadopago ? "Mercado Pago: tarjeta, transferencia, efectivo o saldo. " : ""}
                          {metodos.paypal ? "PayPal: tu cuenta PayPal o tarjeta. " : ""}
                          El pago llega directo a {c.taller.nombre}.
                          {!aceptada ? " Al pagar, la cotización queda aceptada." : ""}
                        </p>
                      </>
                    ) : (
                      <p className="m-0 mt-2 text-[13px] text-[#40403A]">Ponte de acuerdo con el taller para el pago del anticipo.</p>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </>
        )}
        {error ? <p className="m-0 mt-3 text-[14px] text-[#B42318]">{error}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {c.pdf ? (
            <a href={c.pdf} target="_blank" rel="noopener" className={botonClaro}>
              Descargar PDF
            </a>
          ) : null}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener" className={botonClaro}>
              Escribir por WhatsApp
            </a>
          ) : null}
          {c.taller.correo ? (
            <a href={`mailto:${c.taller.correo}?subject=${encodeURIComponent(`Cotización ${c.folio}`)}`} className={botonClaro}>
              Mandar correo
            </a>
          ) : null}
        </div>
      </section>

      <p className="m-0 text-center text-[12px] text-[#7A776E]">
        Cotización hecha con el Cotizador de{" "}
        <a href="/cotizador" className="underline">
          HETNA CNC
        </a>
        .
      </p>
    </div>
  )
}

function Estado({ c, aceptada, rechazada }: { c: CotizacionPublica; aceptada: boolean; rechazada: boolean }) {
  const [texto, color] = rechazada
    ? ["Rechazada", "bg-[#FDECEC] text-[#B42318]"]
    : c.anticipo.estado === "pagado"
      ? ["Anticipo pagado", "bg-[#E6F4EA] text-[#1E7B3A]"]
      : aceptada
        ? ["Aceptada", "bg-[#E6F4EA] text-[#1E7B3A]"]
        : c.vencida
          ? ["Vencida", "bg-[#F3F2EE] text-[#7A776E]"]
          : ["Por aceptar", "bg-[#FFF4EA] text-[#C2560A]"]
  return <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${color}`}>{texto}</span>
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt>{k}</dt>
      <dd className="m-0">{v}</dd>
    </div>
  )
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-wide text-[#7A776E]">{k}</dt>
      <dd className="m-0 text-[15px] text-[#1B1B18]">{v}</dd>
    </div>
  )
}

function Aviso({ tono, children }: { tono: "info" | "error"; children: React.ReactNode }) {
  const color = tono === "error" ? "border-[#F5C2C0] bg-[#FDECEC] text-[#B42318]" : "border-[#F3D9C2] bg-[#FFF4EA] text-[#8A3D06]"
  return <p className={`m-0 rounded-[12px] border px-4 py-3 text-[14px] ${color}`}>{children}</p>
}

// Etapas que usa la app del taller (pantalla Avances)
const ETAPAS = ["Pedido", "Pago50", "Produccion", "Pruebas", "PagoCompleto", "Entrega", "Entregado"] as const
const NOMBRE_ETAPA: Record<string, string> = {
  Pedido: "Pedido recibido",
  Pago: "Anticipo recibido",
  Pago50: "Anticipo recibido",
  Produccion: "En producción",
  Pruebas: "Control de calidad",
  PagoCompleto: "Pago completo",
  Entrega: "Listo para entrega",
  Entregado: "Entregado",
  Cancelado: "Cancelado",
}
const etapa = (e: string) => NOMBRE_ETAPA[e] || e

function Seguimiento({ p }: { p: NonNullable<CotizacionPublica["pedido"]> }) {
  const cancelado = p.estado === "Cancelado"
  const actual = Math.max(0, ETAPAS.indexOf((p.estado === "Pago" ? "Pago50" : p.estado) as (typeof ETAPAS)[number]))
  const [copiada, setCopiada] = useState(false)
  return (
    <section className={caja}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[17px] font-bold text-[#142033]">Tu pedido {p.folio}</h2>
        {p.entregado ? (
          <span className="text-[13px] text-[#1E7B3A]">Entregado el {fecha(p.entregado)}</span>
        ) : p.fecha_estimada && !cancelado ? (
          <span className="text-[13px] text-[#7A776E]">Entrega estimada: {fecha(p.fecha_estimada)}</span>
        ) : null}
      </div>

      {cancelado ? (
        <p className="m-0 mt-3 text-[15px] text-[#B42318]">Este pedido fue cancelado. Si tienes dudas, escríbele al taller.</p>
      ) : (
        <ol className="m-0 mt-4 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-7 sm:gap-1">
          {ETAPAS.map((e, i) => {
            const hecho = i < actual || p.estado === "Entregado"
            const ahora = i === actual && p.estado !== "Entregado"
            return (
              <li key={e} className="flex items-center gap-2 sm:flex-col sm:items-center sm:text-center">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                    hecho ? "bg-[#1E7B3A] text-white" : ahora ? "bg-[#C2560A] text-white" : "bg-[#F3F2EE] text-[#7A776E]"
                  }`}
                >
                  {hecho ? "✓" : i + 1}
                </span>
                <span className={`text-[13px] leading-tight ${ahora ? "font-semibold text-[#1B1B18]" : "text-[#40403A]"}`}>{etapa(e)}</span>
              </li>
            )
          })}
        </ol>
      )}

      {p.envio ? (
        <div className="mt-5 rounded-[12px] bg-[#FAF9F6] p-4">
          <p className="m-0 text-[13px] uppercase tracking-wide text-[#7A776E]">Envío</p>
          <p className="m-0 mt-1 text-[15px] text-[#1B1B18]">
            {p.envio.paqueteria ? <b>{p.envio.paqueteria} · </b> : null}
            Guía <span className="font-mono">{p.envio.guia}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.envio.rastreo ? (
              <a href={p.envio.rastreo} target="_blank" rel="noopener" className={boton}>
                Rastrear envío
              </a>
            ) : null}
            <button
              type="button"
              className={botonClaro}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(p.envio!.guia)
                  setCopiada(true)
                } catch {
                  // sin portapapeles: el número ya está a la vista
                }
              }}
            >
              {copiada ? "Guía copiada" : "Copiar número de guía"}
            </button>
          </div>
        </div>
      ) : null}

      {p.fotos.length ? (
        <div className="mt-5">
          <p className="m-0 text-[13px] uppercase tracking-wide text-[#7A776E]">Fotos del avance</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {p.fotos.map((f, k) => (
              <a key={k} href={f.url} target="_blank" rel="noopener" className="block overflow-hidden rounded-[10px] border border-[#E7E4DC]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.etapa ? etapa(f.etapa) : "Avance"} loading="lazy" className="aspect-square w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {p.avances.length ? (
        <div className="mt-5">
          <p className="m-0 text-[13px] uppercase tracking-wide text-[#7A776E]">Historial</p>
          <ul className="m-0 mt-2 list-none space-y-2 p-0">
            {[...p.avances].reverse().map((a, k) => (
              <li key={k} className="text-[14px] text-[#40403A]">
                <b className="text-[#1B1B18]">{etapa(a.etapa)}</b> · {fecha(a.fecha)}
                {a.nota ? <span className="block text-[13px] text-[#7A776E]">{a.nota}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
