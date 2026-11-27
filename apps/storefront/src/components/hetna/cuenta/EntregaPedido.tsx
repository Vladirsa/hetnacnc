"use client"

// Caja de la compra cuando el pedido llega: "Todo bien, liberar pago" o
// "Tengo un problema" (con fotos o video). Si el cliente no hace nada, el pago
// al taller se libera solo unos días después de la entrega. Reemplaza al
// botón "Ya lo recibí". Ver packages/api/src/lib/reclamos-pedido.ts.
import { T } from "@/components/hetna/i18n/Idioma"
import { useRef, useState, useTransition } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { enviarReclamo, liberarPago, type EstadoEntrega, type ReclamoVista } from "@/lib/cuenta/reclamo"

const MAX_MB = 15
const MAX_ARCHIVOS = 8
const SIN_EVIDENCIA = "no_llego"
const CON_PLAZO_48H = ["danado", "incompleto", "distinto"]

const fecha = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }) : ""
const dinero = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const caja = "flex flex-col gap-3 rounded-[12px] border border-[#E7E4DC] bg-white px-4 py-4"
const btnPrincipal = "rounded-[10px] bg-[#C2560A] px-4 py-2 text-[14px] font-bold text-white disabled:opacity-60"
const btnSecundario = "rounded-[10px] border border-[#C9C5BA] bg-white px-4 py-2 text-[14px] font-semibold text-[#142033] disabled:opacity-60"

// Fotos grandes se reducen en el navegador (~1600 px, JPEG) antes de subirlas
async function reducir(f: File): Promise<Blob> {
  if (!f.type.startsWith("image/") || f.size < 1_200_000) return f
  try {
    const bmp = await createImageBitmap(f)
    const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = document.createElement("canvas")
    c.width = Math.round(bmp.width * escala)
    c.height = Math.round(bmp.height * escala)
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height)
    const b = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.85))
    return b || f
  } catch {
    return f
  }
}

function Evidencias({ orderId, lista }: { orderId: string; lista: ReclamoVista["evidencias"] }) {
  if (!lista.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {lista.map((e) => {
        const src = `/api/pedido-evidencia/${orderId}/${e.id}`
        return e.mime.startsWith("video/") ? (
          <video key={e.id} src={src} controls preload="metadata" className="h-28 w-40 rounded-[8px] bg-black object-contain" />
        ) : (
          <a key={e.id} href={src} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Evidencia" className="h-28 w-28 rounded-[8px] border border-[#E7E4DC] object-cover" />
          </a>
        )
      })}
    </div>
  )
}

function VerReclamo({ orderId, r }: { orderId: string; r: ReclamoVista }) {
  const tuyas = r.evidencias.filter((e) => e.autor === "cliente")
  const delTaller = r.evidencias.filter((e) => e.autor === "taller")
  const color = r.estado === "resuelto" ? "bg-[#E7F5EC] text-[#1E7B3A]" : "bg-[#FFF6DB] text-[#8A5A00]"
  return (
    <div className={caja}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[15px] font-bold text-[#142033]">
          <T>Tu reporte</T> {r.folio}: {r.motivo_nombre}
        </p>
        <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${color}`}>{r.estado_nombre}</span>
      </div>
      <p className="m-0 whitespace-pre-line text-[14px] text-[#40403A]"><T>{r.detalle}</T></p>
      <Evidencias orderId={orderId} lista={tuyas} />

      {r.estado === "abierto" && (
        <p className="m-0 text-[13px] text-[#6B6A63]">
          <T>El pago al taller está congelado. Le pedimos su versión</T>{r.responder_antes ? ` (tiene hasta el ${fecha(r.responder_antes)})` : ""}<T>; después HETNA
          revisa la evidencia de los dos y te avisa la decisión por correo.</T>
        </p>
      )}
      {r.respuesta_taller && (
        <div className="rounded-[10px] bg-[#F7F6F2] px-3 py-3">
          <p className="m-0 mb-1 text-[13px] font-bold text-[#142033]"><T>Respuesta del taller</T></p>
          <p className="m-0 whitespace-pre-line text-[14px] text-[#40403A]">{r.respuesta_taller}</p>
          <div className="mt-2">
            <Evidencias orderId={orderId} lista={delTaller} />
          </div>
        </div>
      )}
      {r.estado === "respondido" && <p className="m-0 text-[13px] text-[#6B6A63]"><T>HETNA está revisando el caso. Te avisamos por correo.</T></p>}
      {r.estado === "resuelto" && (
        <div className="rounded-[10px] border border-[#CFE8D7] bg-[#F3FAF5] px-3 py-3">
          <p className="m-0 text-[14px] font-bold text-[#1E7B3A]"><T>Decisión:</T> {r.decision_nombre}</p>
          {r.monto_reembolso ? (
            <p className="m-0 mt-1 text-[14px] text-[#142033]"><T>Monto a reembolsar:</T> {dinero(r.monto_reembolso)}<T>, por el mismo medio con el que pagaste.</T></p>
          ) : null}
          {r.decision && r.decision !== "liberar" && (
            <p className="m-0 mt-1 text-[13px] text-[#40403A]">
              {r.guia_paga === "taller" ? "La guía de regreso la paga el taller." : "La guía de regreso la pagas tú."}
            </p>
          )}
          {r.decision_nota && <p className="m-0 mt-2 whitespace-pre-line text-[14px] text-[#40403A]">{r.decision_nota}</p>}
        </div>
      )}
    </div>
  )
}

function Formulario({ estado, alEnviar, alCancelar }: { estado: EstadoEntrega; alEnviar: (e: EstadoEntrega) => void; alCancelar: () => void }) {
  const [motivo, setMotivo] = useState(estado.motivos.length === 1 ? estado.motivos[0].id : "")
  const [detalle, setDetalle] = useState("")
  const [archivos, setArchivos] = useState<{ id: string; nombre: string; video: boolean }[]>([])
  const [subiendo, setSubiendo] = useState("")
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()
  const input = useRef<HTMLInputElement>(null)
  const pideEvidencia = motivo !== SIN_EVIDENCIA

  async function subir(lista: FileList | null) {
    if (!lista?.length) return
    setError("")
    for (const f of Array.from(lista)) {
      if (archivos.length >= MAX_ARCHIVOS) {
        setError(`Puedes subir hasta ${MAX_ARCHIVOS} archivos.`)
        break
      }
      const video = f.type.startsWith("video/")
      if (!video && !f.type.startsWith("image/")) {
        setError("Sólo fotos o videos.")
        continue
      }
      const blob = await reducir(f)
      if (blob.size > MAX_MB * 1024 * 1024) {
        setError(`«${f.name}» pesa más de ${MAX_MB} MB. Graba un video más corto o baja su calidad.`)
        continue
      }
      setSubiendo(f.name)
      const fd = new FormData()
      fd.append("archivo", blob, video ? f.name : f.name.replace(/\.\w+$/, "") + ".jpg")
      try {
        const r = await fetch(`/api/pedido-evidencia/${estado.order_id}`, { method: "POST", body: fd })
        const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string }
        if (r.ok && j.id) setArchivos((a) => [...a, { id: j.id!, nombre: f.name, video }])
        else setError(j.message || `No se pudo subir «${f.name}».`)
      } catch {
        setError(`No se pudo subir «${f.name}». Revisa tu conexión.`)
      }
    }
    setSubiendo("")
    if (input.current) input.current.value = ""
  }

  function enviar() {
    setError("")
    if (!motivo) return setError("Elige qué pasó.")
    if (detalle.trim().length < 15) return setError("Explica qué pasó (al menos una frase completa).")
    if (pideEvidencia && !archivos.length) return setError("Sube al menos una foto o video que muestre el problema.")
    iniciar(async () => {
      const r = await enviarReclamo(estado.order_id, { motivo, detalle, evidencias: archivos.map((a) => a.id) })
      if (r.ok) alEnviar(r.estado)
      else setError(r.mensaje)
    })
  }

  return (
    <div className={caja}>
      <p className="m-0 text-[16px] font-bold text-[#142033]"><T>Cuéntanos qué pasó</T></p>
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1 text-[13px] font-semibold text-[#40403A]"><T>Motivo</T></legend>
        {estado.motivos.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-center gap-2 text-[14px] text-[#142033]">
            <input type="radio" name={`motivo-${estado.order_id}`} value={m.id} checked={motivo === m.id} onChange={() => setMotivo(m.id)} />
            {m.nombre}
          </label>
        ))}
      </fieldset>
      {CON_PLAZO_48H.includes(motivo) && (
        <p className="m-0 rounded-[8px] bg-[#FFF6DB] px-3 py-2 text-[13px] text-[#8A5A00]">
          <T>Daños, faltantes o algo distinto se deben reportar en las primeras 48 horas después de la entrega. Incluye fotos del producto, de la caja y de la guía.</T>
        </p>
      )}
      {motivo === "arrepentimiento" && (
        <p className="m-0 rounded-[8px] bg-[#F7F6F2] px-3 py-2 text-[13px] text-[#40403A]">
          <T>Debe estar sin uso, completo y en su empaque original. La guía de regreso la pagas tú. No aplica a piezas a la medida, personalizadas, consumibles abiertos ni productos de importación.</T>
        </p>
      )}
      <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#40403A]">
        <T>Explica el problema</T>
        <textarea
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Qué llegó, qué está mal, qué esperabas recibir…"
          className="rounded-[10px] border border-[#C9C5BA] px-3 py-2 text-[14px] font-normal text-[#142033]"
        />
      </label>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[13px] font-semibold text-[#40403A]">
          <T>Fotos o video</T> {pideEvidencia ? "(obligatorio)" : "(opcional)"} <T>· hasta</T> {MAX_ARCHIVOS}<T>, máx.</T> {MAX_MB} <T>MB cada uno</T>
        </p>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
          onChange={(e) => subir(e.target.files)}
          disabled={Boolean(subiendo) || pendiente}
          className="text-[13px]"
        />
        {subiendo && <p className="m-0 text-[13px] text-[#6B6A63]"><T>Subiendo «</T>{subiendo}»…</p>}
        {archivos.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {archivos.map((a) => (
              <li key={a.id} className="flex items-center gap-1 rounded-full bg-[#EEF1F6] px-3 py-1 text-[12px] text-[#142033]">
                {a.video ? "🎬" : "📷"} {a.nombre}
                <button
                  type="button"
                  aria-label={`Quitar ${a.nombre}`}
                  onClick={() => setArchivos((x) => x.filter((y) => y.id !== a.id))}
                  className="ml-1 font-bold text-[#B3261E]"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="m-0 text-[13px] text-[#B3261E]">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={enviar} disabled={pendiente || Boolean(subiendo)} className={btnPrincipal}>
          {pendiente ? "Enviando…" : "Enviar reporte"}
        </button>
        <button type="button" onClick={alCancelar} disabled={pendiente} className={btnSecundario}>
          <T>Cancelar</T>
        </button>
      </div>
      <p className="m-0 text-[12px] text-[#6B6A63]">
        <T>Congelamos el pago al taller, le pedimos su versión y HETNA decide con la evidencia de los dos. Ver</T>{" "}
        <LocalizedClientLink href="/devoluciones" className="underline">
          <T>devoluciones</T>
        </LocalizedClientLink>
        .
      </p>
    </div>
  )
}

export function EntregaPedido({ estadoInicial, taller }: { estadoInicial: EstadoEntrega; taller: string }) {
  const [estado, setEstado] = useState(estadoInicial)
  const [vista, setVista] = useState<"inicio" | "confirmar" | "problema">("inicio")
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  if (estado.reclamo) return <VerReclamo orderId={estado.order_id} r={estado.reclamo} />
  if (vista === "problema") return <Formulario estado={estado} alEnviar={setEstado} alCancelar={() => setVista("inicio")} />
  if (mensaje) return <p className="m-0 rounded-[10px] bg-[#E7F5EC] px-3 py-2 text-[14px] text-[#1E7B3A]"><T>{mensaje}</T></p>

  const garantia = estado.motivos.length === 1 && estado.motivos[0].id === "defecto"
  const linkProblema =
    estado.motivos.length > 0 ? (
      <button type="button" onClick={() => setVista("problema")} className={btnSecundario}>
        {garantia ? "Reportar una falla (garantía)" : "Tengo un problema"}
      </button>
    ) : null

  if (estado.aceptado_en) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#E7E4DC] bg-white px-4 py-3">
        <p className="m-0 text-[14px] text-[#142033]">
          <T>Liberaste el pago a</T> <strong>{taller}</strong> <T>el</T> {fecha(estado.aceptado_en)}<T>. ¡Gracias!</T>
        </p>
        {linkProblema}
      </div>
    )
  }

  if (vista === "confirmar") {
    return (
      <div className={caja}>
        <p className="m-0 text-[15px] font-bold text-[#142033]"><T>¿Liberar el pago a</T> {taller}?</p>
        <p className="m-0 text-[14px] text-[#40403A]">
          <T>Al liberarlo confirmas que tu pedido llegó completo y en buen estado. Después ya no podrás reportar daños ni faltantes, sólo fallas de
          garantía. Si todavía lo vas a revisar o piensas devolverlo, no lo liberes: se libera solo</T>
          {estado.se_libera_en ? ` el ${fecha(estado.se_libera_en)}` : ` ${estado.dias_liberacion} días después de la entrega`}.
        </p>
        {error && <p className="m-0 text-[13px] text-[#B3261E]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pendiente}
            className={btnPrincipal}
            onClick={() =>
              iniciar(async () => {
                setError("")
                const r = await liberarPago(estado.order_id)
                if (r.ok) setMensaje(r.mensaje)
                else setError(r.mensaje)
              })
            }
          >
            {pendiente ? "Liberando…" : "Sí, todo llegó bien"}
          </button>
          <button type="button" disabled={pendiente} onClick={() => setVista("inicio")} className={btnSecundario}>
            <T>Volver</T>
          </button>
        </div>
      </div>
    )
  }

  if (estado.puede_liberar) {
    return (
      <div className={caja}>
        <p className="m-0 text-[15px] font-bold text-[#142033]"><T>¿Te llegó bien tu pedido de</T> {taller}?</p>
        <p className="m-0 text-[13px] text-[#6B6A63]">
          <T>Tu pago está protegido: el taller no lo recibe hasta que confirmes.</T>
          {estado.se_libera_en
            ? ` Si no nos dices nada, se libera solo el ${fecha(estado.se_libera_en)}.`
            : ` Si no nos dices nada, se libera solo ${estado.dias_liberacion} días después de la entrega.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setVista("confirmar")} className={btnPrincipal}>
            <T>Todo bien, liberar pago</T>
          </button>
          {linkProblema}
        </div>
      </div>
    )
  }

  if (!linkProblema) return null
  const texto = garantia
    ? "Si tu producto deja de funcionar, puedes reportarlo como garantía."
    : estado.saldo_estado === "disponible" || estado.saldo_estado === "pagado"
      ? `El pago ya se liberó al taller, pero todavía puedes reportar un problema${estado.devolucion_hasta ? ` hasta el ${fecha(estado.devolucion_hasta)}` : ""}.`
      : "¿Algo salió mal con este pedido?"
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#E7E4DC] bg-white px-4 py-3">
      <p className="m-0 text-[14px] text-[#142033]"><T>{texto}</T></p>
      {linkProblema}
    </div>
  )
}
