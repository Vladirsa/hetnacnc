"use client"
// Verificar el WhatsApp del cliente: escribe a HETNA con un mensaje ya listo
// (él escribe primero) y desde ahí le avisamos de sus cotizaciones y pedidos.
import { useCallback, useEffect, useState } from "react"

import { codigoWhatsapp, confirmarWhatsapp, estadoWhatsapp, iniciarWhatsapp } from "@/lib/cuenta/whatsapp"

export function WhatsappCuenta({ telefono }: { telefono?: string | null }) {
  const [e, setE] = useState<any>(null)
  const [num, setNum] = useState(String(telefono || "").replace(/\D/g, "").slice(-10))
  const [liga, setLiga] = useState<string | null>(null)
  const [codigo, setCodigo] = useState("")
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const cargar = useCallback(() => estadoWhatsapp().then(setE).catch(() => setE({ verificado: false })), [])
  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => {
    if (!liga || e?.verificado) return
    const t = setInterval(() => void cargar(), 5000)
    return () => clearInterval(t)
  }, [liga, e?.verificado, cargar])
  const hacer = async (fn: () => Promise<any>, ok?: string, abrir = false) => {
    setOcupado(true)
    setNota(null)
    const d = await fn().catch((er) => ({ error: (er as Error).message }))
    setOcupado(false)
    if (d?.error) return setNota({ ok: false, t: d.error })
    if (abrir && d.liga) {
      setLiga(d.liga)
      window.open(d.liga, "_blank", "noopener")
    }
    if (ok) setNota({ ok: true, t: ok })
    void cargar()
  }
  if (!e) return null
  const caja = "rounded-[16px] bg-white/80 shadow-[0_8px_24px_-12px_rgba(20,32,51,0.18)] ring-1 ring-[#142033]/5 p-5 sm:p-6"
  if (e.verificado)
    return (
      <section className={caja}>
        <h2 className="m-0 text-[19px] font-bold text-[#1E7B3A]">✓ WhatsApp verificado</h2>
        <p className="m-0 mt-1 text-[14px] text-[#40403A]">
          +{e.numero}. Te avisamos por ahí de tus cotizaciones y pedidos.{e.avisos === false ? " Tienes los avisos en pausa: escribe ALTA al WhatsApp de HETNA para reactivarlos." : " Escribe BAJA si ya no quieres avisos."}
        </p>
      </section>
    )
  return (
    <section className={caja}>
      <h2 className="m-0 text-[19px] font-bold text-[#142033]">💬 Avisos por WhatsApp</h2>
      <p className="m-0 mb-3 mt-1 text-[14px] text-[#6B6A63]">
        Verifica tu WhatsApp y te avisamos ahí cuando un taller te cotice o tu pedido avance. Toca el botón: se abre WhatsApp con un mensaje listo para HETNA, sólo dale Enviar.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={num} onChange={(x) => setNum(x.target.value)} inputMode="tel" placeholder="Celular a 10 dígitos" className="rounded-lg border border-[#E7E4DC] px-3 py-2 text-[14px]" />
        <button type="button" disabled={ocupado || num.replace(/\D/g, "").length < 10} onClick={() => void hacer(() => iniciarWhatsapp(num), undefined, true)} className="rounded-lg bg-[#C2560A] px-4 py-2 text-[14px] font-bold text-white disabled:opacity-60">
          Verificar mi WhatsApp
        </button>
      </div>
      {liga && (
        <div className="mt-3 text-[13px] text-[#40403A]">
          <p className="m-0">Dale <b>Enviar</b> en WhatsApp y esto se pone en verde solo. ¿No se abrió? <a href={liga} target="_blank" rel="noreferrer" className="font-bold text-[#C2560A]">Ábrelo aquí</a>.</p>
          <p className="m-0 mb-1 mt-2">¿Estás en la computadora? Te mandamos el código y lo escribes aquí:</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={ocupado} onClick={() => void hacer(() => codigoWhatsapp(num), "Te mandamos el código por WhatsApp.")} className="rounded-lg border border-[#142033] px-3 py-2 text-[13px] font-bold text-[#142033]">Mandarme el código</button>
            <input value={codigo} onChange={(x) => setCodigo(x.target.value)} inputMode="numeric" placeholder="Código de 6 dígitos" className="w-[150px] rounded-lg border border-[#E7E4DC] px-3 py-2 text-[14px]" />
            <button type="button" disabled={ocupado || codigo.length !== 6} onClick={() => void hacer(() => confirmarWhatsapp(num, codigo), "✓ WhatsApp verificado")} className="rounded-lg border border-[#142033] px-3 py-2 text-[13px] font-bold text-[#142033]">Confirmar</button>
          </div>
        </div>
      )}
      {nota && <p className={`m-0 mt-2 text-[13px] font-semibold ${nota.ok ? "text-[#1E7B3A]" : "text-[#B3261E]"}`}>{nota.t}</p>}
    </section>
  )
}
