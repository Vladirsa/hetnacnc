"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"

import { mandarACotizador, mandarAFabricar } from "@/lib/generador/aCotizador"
import {
  ESPESOR_FONDO,
  Frente,
  OPCIONES_INICIO,
  OpcionesMueble,
  acomodar,
  acomodoDXF,
  despiece,
  despieceCSV,
  hojaSVG,
} from "@/lib/generador/muebles"

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
const HOJAS = [
  { etiqueta: "Melamina 1.83 × 2.44", ancho: 1830, alto: 2440 },
  { etiqueta: "MDF 1.22 × 2.44", ancho: 1220, alto: 2440 },
  { etiqueta: "Triplay 1.22 × 2.44", ancho: 1220, alto: 2440 },
]
const FRENTES: { id: Frente; nombre: string }[] = [
  { id: "abierto", nombre: "Abierto" },
  { id: "puertas", nombre: "Puertas" },
  { id: "cajones", nombre: "Cajones" },
  { id: "mixto", nombre: "Cajones y puertas" },
]
const numero = (s: string) => parseFloat((s || "").replace(",", "."))
const r1 = (x: number) => Math.round(x * 10) / 10

function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const Opcion = ({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-2 rounded-[8px] text-[13px] font-semibold border ${
      activa ? "bg-[#142033] text-white border-[#142033]" : "bg-white text-[#1B1B18] border-[#E7E4DC] hover:border-[#C2560A]"
    }`}
  >
    {children}
  </button>
)

const Campo = ({ etiqueta, valor, cambiar, sufijo = "mm" }: { etiqueta: string; valor: string; cambiar: (v: string) => void; sufijo?: string }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[13px] font-semibold text-[#1B1B18]">{etiqueta}</span>
    <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none"
      />
      {sufijo && <span className="pr-3 text-[13px] text-[#9A978C]">{sufijo}</span>}
    </span>
  </label>
)

type Texto = Record<"ancho" | "alto" | "fondo" | "espesor" | "zoclo" | "repisas" | "cajones" | "altoZonaCajones" | "modulos" | "holguraFrente" | "retranqueoRepisa" | "holguraCorredera", string>
const aTexto = (o: OpcionesMueble): Texto => ({
  ancho: String(o.ancho), alto: String(o.alto), fondo: String(o.fondo), espesor: String(o.espesor), zoclo: String(o.zoclo),
  repisas: String(o.repisas), cajones: String(o.cajones), altoZonaCajones: String(o.altoZonaCajones), modulos: String(o.modulos),
  holguraFrente: String(o.holguraFrente), retranqueoRepisa: String(o.retranqueoRepisa), holguraCorredera: String(o.holguraCorredera),
})

// Vista de frente del módulo
function Boceto({ o }: { o: OpcionesMueble }) {
  const { ancho: A, alto: H, zoclo: z, espesor: e } = o
  if (!(A > 0 && H > 0)) return null
  const hF = o.holguraFrente
  const frente = H - z
  const cajones = o.frente === "cajones" || o.frente === "mixto" ? Math.max(0, Math.round(o.cajones)) : 0
  const zonaCaj = o.frente === "cajones" ? frente : o.frente === "mixto" ? o.altoZonaCajones : 0
  const zonaP = o.frente === "puertas" ? frente : o.frente === "mixto" ? frente - zonaCaj : 0
  const y = (v: number) => H - v // SVG hacia abajo
  const el: React.ReactNode[] = []
  // cuerpo
  el.push(<rect key="c" x={0} y={0} width={A} height={H} fill="#F4F1EA" stroke="#142033" strokeWidth={2} vectorEffect="non-scaling-stroke" />)
  if (z > 0) el.push(<rect key="z" x={e} y={y(z)} width={A - 2 * e} height={z} fill="#E7E4DC" stroke="#142033" strokeWidth={1} vectorEffect="non-scaling-stroke" />)
  if (o.frente === "abierto") {
    const n = Math.max(0, Math.round(o.repisas))
    for (let i = 1; i <= n; i++) {
      const yy = z + (frente * i) / (n + 1)
      el.push(<line key={`r${i}`} x1={e} x2={A - e} y1={y(yy)} y2={y(yy)} stroke="#6B6A63" strokeWidth={3} vectorEffect="non-scaling-stroke" />)
    }
  }
  if (cajones) {
    const hc = (zonaCaj - cajones * hF) / cajones
    for (let i = 0; i < cajones; i++) {
      const y0 = z + hF / 2 + i * (hc + hF)
      el.push(<rect key={`d${i}`} x={hF / 2} y={y(y0 + hc)} width={A - hF} height={hc} fill="#FDEEE1" stroke="#C2560A" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)
      el.push(<line key={`dj${i}`} x1={A / 2 - 50} x2={A / 2 + 50} y1={y(y0 + hc / 2)} y2={y(y0 + hc / 2)} stroke="#142033" strokeWidth={3} vectorEffect="non-scaling-stroke" />)
    }
  }
  if (zonaP > 0) {
    const y0 = z + zonaCaj + hF / 2
    const hp = zonaP - hF
    const n = o.puertas
    const wp = n === 1 ? A - hF : (A - 2 * hF) / 2
    for (let i = 0; i < n; i++) {
      const x0 = hF / 2 + i * (wp + hF)
      el.push(<rect key={`p${i}`} x={x0} y={y(y0 + hp)} width={wp} height={hp} fill="#FDEEE1" stroke="#C2560A" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)
      const xj = n === 1 ? x0 + wp - 40 : i === 0 ? x0 + wp - 40 : x0 + 40
      el.push(<line key={`pj${i}`} x1={xj} x2={xj} y1={y(y0 + hp - 60)} y2={y(y0 + hp - 180)} stroke="#142033" strokeWidth={3} vectorEffect="non-scaling-stroke" />)
    }
  }
  return (
    <svg viewBox={`-20 -20 ${A + 40} ${H + 40}`} className="w-full h-auto max-h-[320px]" role="img" aria-label="Vista de frente del mueble">
      {el}
    </svg>
  )
}

export function GeneradorMueble() {
  const { locale } = useParams<{ locale: string }>()
  const [t, setT] = useState<Texto>(aTexto(OPCIONES_INICIO))
  const [frente, setFrente] = useState<Frente>(OPCIONES_INICIO.frente)
  const [puertas, setPuertas] = useState<1 | 2>(OPCIONES_INICIO.puertas)
  const [conFondo, setConFondo] = useState(true)
  const [moviles, setMoviles] = useState(true)
  const [hojaIdx, setHojaIdx] = useState(0)
  const [separacion, setSeparacion] = useState("8")
  const [veta, setVeta] = useState(false)
  const [aviso, setAviso] = useState("")

  const cambiar = (k: keyof Texto) => (v: string) => setT((x) => ({ ...x, [k]: v }))
  const o: OpcionesMueble = {
    ancho: numero(t.ancho), alto: numero(t.alto), fondo: numero(t.fondo), espesor: numero(t.espesor), zoclo: numero(t.zoclo) || 0,
    conFondo, repisas: numero(t.repisas) || 0, repisasMoviles: moviles, frente, puertas, cajones: numero(t.cajones) || 0,
    altoZonaCajones: numero(t.altoZonaCajones) || 0, modulos: numero(t.modulos) || 1,
    holguraFrente: numero(t.holguraFrente) || 0, retranqueoRepisa: numero(t.retranqueoRepisa) || 0, holguraCorredera: numero(t.holguraCorredera) || 0,
  }
  const clave = JSON.stringify(o)
  const d = useMemo(() => despiece(o), [clave]) // eslint-disable-line react-hooks/exhaustive-deps
  const hoja = HOJAS[hojaIdx]
  const sep = Math.max(0, numero(separacion) || 0)
  const tablero = useMemo(() => d.piezas.filter((p) => p.espesor !== ESPESOR_FONDO), [d])
  const fondos = useMemo(() => d.piezas.filter((p) => p.espesor === ESPESOR_FONDO), [d])
  const acomodo = useMemo(() => acomodar(tablero, hoja, { separacion: sep, margen: 10, respetarVeta: veta }), [tablero, hoja, sep, veta])
  const acomodoF = useMemo(() => acomodar(fondos, { ancho: 1220, alto: 2440 }, { separacion: sep, margen: 10, respetarVeta: false }), [fondos, sep])

  // números de pieza por renglón (como salen en las hojas)
  const rangos = useMemo(() => {
    let n = 0
    let nf = 0
    return d.piezas.map((p) => {
      if (p.espesor === ESPESOR_FONDO) { const a = nf + 1; nf += p.cantidad; return `F${a}${p.cantidad > 1 ? `–F${nf}` : ""}` }
      const a = n + 1
      n += p.cantidad
      return `${a}${p.cantidad > 1 ? `–${n}` : ""}`
    })
  }, [d])

  const nombre = `mueble-hetna-${r1(o.ancho)}x${r1(o.alto)}x${r1(o.fondo)}-e${r1(o.espesor)}${o.modulos > 1 ? `-x${o.modulos}` : ""}`
  const totalPiezas = d.piezas.reduce((s, p) => s + p.cantidad, 0)
  const listo = d.piezas.length > 0
  const mensaje =
    `Hola HETNA CNC, quiero cotizar la maquila de ${o.modulos > 1 ? `${o.modulos} módulos` : "un mueble"}:\n` +
    `- Medidas: ${r1(o.ancho)} × ${r1(o.alto)} × ${r1(o.fondo)} mm, tablero de ${r1(o.espesor)} mm\n` +
    `- Frente: ${FRENTES.find((x) => x.id === frente)?.nombre}\n` +
    `- ${totalPiezas} piezas, ${acomodo.hojas.length} hojas de ${hoja.etiqueta}${acomodoF.hojas.length ? ` + ${acomodoF.hojas.length} de fondo 3 mm` : ""}\n` +
    `- Canto: ${d.resumen.metrosCanto.toFixed(1)} m`

  const imprimir = () => {
    const w = window.open("", "_blank")
    if (!w) return
    const filas = d.piezas
      .map((p, i) => `<tr><td>${rangos[i]}</td><td>${p.nombre}</td><td>${p.cantidad}</td><td>${p.largo} × ${p.ancho}</td><td>${p.espesor}</td><td>${p.canto.l} largo, ${p.canto.a} corto</td></tr>`)
      .join("")
    const her = d.herrajes.map((h) => `<li>${h.cantidad} × ${h.nombre}</li>`).join("")
    w.document.write(
      `<!doctype html><meta charset="utf-8"><title>${nombre}</title><style>body{font:13px sans-serif;margin:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 6px;text-align:left}</style>` +
        `<h2>Despiece ${r1(o.ancho)} × ${r1(o.alto)} × ${r1(o.fondo)} mm</h2><table><tr><th>N.º</th><th>Pieza</th><th>Cant.</th><th>Largo × ancho (mm)</th><th>Esp.</th><th>Canto</th></tr>${filas}</table>` +
        `<h3>Herrajes</h3><ul>${her}</ul><p>Canto: ${d.resumen.metrosCanto.toFixed(1)} m · Hojas: ${acomodo.hojas.length} (${hoja.etiqueta})</p>`
    )
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  return (
    <div className="w-full bg-[#FAF9F6]">
      <section className="px-4 lg:px-8 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">Gratis</span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">Despiece de muebles para CNC</h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[720px]">
          Gabinetes, libreros, closets y módulos de cocina: escribe las medidas y obtén la lista de piezas, el acomodo en hojas, el canto y los herrajes, listo para maquilar.
        </p>
      </section>

      <div className="px-4 lg:px-8 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <Campo etiqueta="Ancho" valor={t.ancho} cambiar={cambiar("ancho")} />
            <Campo etiqueta="Alto" valor={t.alto} cambiar={cambiar("alto")} />
            <Campo etiqueta="Fondo" valor={t.fondo} cambiar={cambiar("fondo")} />
          </div>
          <div className="flex flex-col gap-2">
            <Campo etiqueta="Espesor del tablero" valor={t.espesor} cambiar={cambiar("espesor")} />
            <div className="flex flex-wrap gap-1.5">
              {[15, 16, 18, 19].map((x) => (
                <button key={x} type="button" onClick={() => cambiar("espesor")(String(x))} className="text-[12px] font-semibold bg-[#FAF9F6] border border-[#E7E4DC] hover:border-[#C2560A] px-2.5 py-1 rounded-full text-[#1B1B18]">
                  {x} mm
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Zoclo (0 = sin zoclo)" valor={t.zoclo} cambiar={cambiar("zoclo")} />
            <Campo etiqueta="Módulos iguales" valor={t.modulos} cambiar={cambiar("modulos")} sufijo="" />
          </div>
          <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
            <input type="checkbox" checked={conFondo} onChange={(e) => setConFondo(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
            Fondo trasero de 3 mm
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Frente</span>
            <div className="flex flex-wrap gap-2">
              {FRENTES.map((x) => <Opcion key={x.id} activa={frente === x.id} onClick={() => setFrente(x.id)}>{x.nombre}</Opcion>)}
            </div>
          </div>
          {(frente === "puertas" || frente === "mixto") && (
            <div className="flex gap-2 items-center">
              <span className="text-[13px] font-semibold text-[#1B1B18]">Puertas:</span>
              <Opcion activa={puertas === 1} onClick={() => setPuertas(1)}>1</Opcion>
              <Opcion activa={puertas === 2} onClick={() => setPuertas(2)}>2</Opcion>
            </div>
          )}
          {(frente === "cajones" || frente === "mixto") && (
            <div className="grid grid-cols-2 gap-2">
              <Campo etiqueta="Cajones" valor={t.cajones} cambiar={cambiar("cajones")} sufijo="" />
              {frente === "mixto" && <Campo etiqueta="Alto zona de cajones" valor={t.altoZonaCajones} cambiar={cambiar("altoZonaCajones")} />}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 items-end">
            <Campo etiqueta="Repisas" valor={t.repisas} cambiar={cambiar("repisas")} sufijo="" />
            <label className="flex items-center gap-2 text-[14px] text-[#1B1B18] pb-3">
              <input type="checkbox" checked={moviles} onChange={(e) => setMoviles(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
              Móviles
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Hoja</span>
            <div className="flex flex-wrap gap-2">
              {HOJAS.map((h, i) => <Opcion key={h.etiqueta} activa={hojaIdx === i} onClick={() => setHojaIdx(i)}>{h.etiqueta}</Opcion>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 items-end">
            <Campo etiqueta="Separación (fresa)" valor={separacion} cambiar={setSeparacion} />
            <label className="flex items-center gap-2 text-[14px] text-[#1B1B18] pb-3">
              <input type="checkbox" checked={veta} onChange={(e) => setVeta(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
              Respetar veta
            </label>
          </div>

          <details className="border-t border-[#E7E4DC] pt-3">
            <summary className="text-[13px] font-semibold text-[#1B1B18] cursor-pointer">Reglas del taller</summary>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Campo etiqueta="Luz entre frentes" valor={t.holguraFrente} cambiar={cambiar("holguraFrente")} />
              <Campo etiqueta="Repisa hacia adentro" valor={t.retranqueoRepisa} cambiar={cambiar("retranqueoRepisa")} />
              <Campo etiqueta="Holgura corredera (por lado)" valor={t.holguraCorredera} cambiar={cambiar("holguraCorredera")} />
            </div>
            <p className="m-0 mt-2 text-[12px] text-[#6B6A63]">
              Construcción: laterales completos, techo y base entre laterales, puertas y frentes sobrepuestos, fondo de 3 mm clavado por detrás y cajones con correderas telescópicas.
            </p>
          </details>
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {d.errores.length > 0 && (
            <div className="bg-[#FDECEC] border border-[#F2B8B5] text-[#8A1C1C] rounded-[12px] px-4 py-3 text-[14px]">
              {d.errores.map((x) => <p key={x} className="m-0">{x}</p>)}
            </div>
          )}

          {listo && (
            <>
              <div className="grid sm:grid-cols-[220px_1fr] gap-4">
                <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-3 flex items-center justify-center">
                  <Boceto o={o} />
                </div>
                <dl className="grid grid-cols-2 gap-2 m-0 content-start">
                  {[
                    ["Piezas", String(totalPiezas)],
                    ["Hojas", `${acomodo.hojas.length} de ${hoja.etiqueta}`],
                    ["Aprovechamiento", `${Math.round(acomodo.aprovechamiento * 100)}%`],
                    ["Tablero", `${d.resumen.m2Tablero.toFixed(2)} m²`],
                    ["Canto", `${d.resumen.metrosCanto.toFixed(1)} m`],
                    ["Fondo 3 mm", fondos.length ? `${acomodoF.hojas.length} hoja(s) de 1.22 × 2.44` : "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                      <dt className="text-[12px] text-[#6B6A63]">{k}</dt>
                      <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {(d.avisos.length > 0 || acomodo.noCaben.length > 0) && (
                <ul className="m-0 pl-5 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] py-3 pr-4">
                  {d.avisos.map((a) => <li key={a}>{a}</li>)}
                  {acomodo.noCaben.map((a) => <li key={a}>No cabe en la hoja: {a}</li>)}
                </ul>
              )}

              <div className="bg-white border border-[#E7E4DC] rounded-[14px] overflow-x-auto">
                <table className="w-full text-[13.5px] text-[#1B1B18]">
                  <thead className="bg-[#FAF9F6] text-[12px] text-[#6B6A63]">
                    <tr>
                      <th className="text-left px-3 py-2">N.º</th>
                      <th className="text-left px-3 py-2">Pieza</th>
                      <th className="text-right px-3 py-2">Cant.</th>
                      <th className="text-right px-3 py-2">Largo × ancho (mm)</th>
                      <th className="text-right px-3 py-2">Esp.</th>
                      <th className="text-left px-3 py-2">Canto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.piezas.map((p, i) => (
                      <tr key={p.nombre} className="border-t border-[#E7E4DC]">
                        <td className="px-3 py-2 text-[#6B6A63] whitespace-nowrap">{rangos[i]}</td>
                        <td className="px-3 py-2">{p.nombre}{p.nota && <span className="block text-[11.5px] text-[#9A978C]">{p.nota}</span>}</td>
                        <td className="px-3 py-2 text-right">{p.cantidad}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{p.largo} × {p.ancho}</td>
                        <td className="px-3 py-2 text-right">{p.espesor}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{p.canto.l || p.canto.a ? `${p.canto.l} largo${p.canto.l === 1 ? "" : "s"}, ${p.canto.a} corto${p.canto.a === 1 ? "" : "s"}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4">
                <h2 className="m-0 text-[15px] font-bold text-[#1B1B18]">Herrajes</h2>
                <ul className="m-0 mt-2 p-0 list-none grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[13.5px] text-[#1B1B18]">
                  {d.herrajes.map((h) => (
                    <li key={h.nombre}><strong>{h.cantidad}</strong> × {h.nombre}{h.nota && <span className="text-[#9A978C]"> ({h.nota})</span>}</li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="m-0 text-[15px] font-bold text-[#1B1B18]">Acomodo en hojas</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {acomodo.hojas.map((h, k) => (
                    <figure key={k} className="m-0 bg-white border border-[#E7E4DC] rounded-[12px] p-2">
                      <div className="[&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: hojaSVG(h, hoja) }} />
                      <figcaption className="text-[12px] text-[#6B6A63] mt-1 text-center">Hoja {k + 1} · {h.length} piezas</figcaption>
                    </figure>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => { if (!mandarACotizador(`${nombre}.dxf`, acomodoDXF(acomodo), locale)) setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                Ver precio al instante en el Cotizador
              </button>
              <button
                type="button"
                onClick={() => { if (!mandarAFabricar(`${nombre}.dxf`, acomodoDXF(acomodo), locale, { pieza: "Despiece de mueble", proceso: "Corte láser" })) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.") }}
                className="w-full bg-[#FF6A1A] hover:bg-[#E65C12] text-white font-extrabold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>
                Fabrícamelo: que un taller la corte
              </button>
              {aviso && <p className="m-0 text-[13px] text-[#8A1C1C]">{aviso}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button type="button" onClick={() => descargar(`${nombre}.dxf`, acomodoDXF(acomodo), "application/dxf")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                  DXF de las hojas
                </button>
                <button type="button" onClick={() => descargar(`${nombre}.csv`, despieceCSV(d.piezas), "text/csv")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                  Lista de corte (Excel)
                </button>
                <button type="button" onClick={imprimir} className="bg-white border border-[#142033] text-[#142033] font-semibold py-3 rounded-[10px] text-[14px]">
                  Imprimir despiece
                </button>
                <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center">
                  Pedir por WhatsApp
                </a>
              </div>
              {fondos.length > 0 && (
                <button type="button" onClick={() => descargar(`${nombre}-fondos-3mm.dxf`, acomodoDXF(acomodoF), "application/dxf")} className="self-start text-[13.5px] font-semibold text-[#B34D07] underline underline-offset-4">
                  DXF de los fondos de 3 mm
                </button>
              )}
              <p className="m-0 text-[12.5px] text-[#6B6A63]">
                En el DXF: capa CORTE con las piezas, capa HOJA con el contorno de cada hoja y capa ETIQUETAS con el número de cada pieza. Las perforaciones de bisagras y correderas se hacen aparte.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
