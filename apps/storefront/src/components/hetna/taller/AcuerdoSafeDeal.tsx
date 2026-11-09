"use client"

// Licitaciones 3.0 — Fase 4: conversación privada con el taller elegido,
// HETNA SafeDeal (acuerdo opcional, recomendado) y HETNA Sign (firma con
// código por correo). La lógica vive en packages/api/src/lib/safedeal.ts.
import { useCallback, useEffect, useRef, useState } from "react"

import { accionAcuerdo, mandarMensaje, verAcuerdo, verMensajes, type MensajeSol } from "@/lib/cotizar/solicitud-taller"

const fecha = (s?: string | null) =>
  s ? new Date(s).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""

const caja = "mt-6 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6"
const btn = "rounded-xl bg-[#C2560A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#A84A08] disabled:opacity-50"
const btn2 = "rounded-xl border border-[#142033] px-4 py-2 text-sm font-semibold text-[#142033] hover:bg-[#F3F1EA] disabled:opacity-50"
const input = "w-full rounded-xl border border-[#E7E4DC] px-3 py-2.5 text-sm outline-none focus:border-[#C2560A]"

function Conversacion({ token, taller, oculto }: { token: string; taller: string; oculto: boolean }) {
  const [lista, setLista] = useState<MensajeSol[]>([])
  const [texto, setTexto] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const fin = useRef<HTMLDivElement>(null)
  const cargar = useCallback(() => verMensajes(token).then(setLista).catch(() => {}), [token])
  useEffect(() => {
    void cargar()
    const t = setInterval(() => document.visibilityState === "visible" && void cargar(), 20_000)
    return () => clearInterval(t)
  }, [cargar])
  useEffect(() => fin.current?.scrollIntoView({ block: "nearest" }), [lista.length])
  const enviar = async () => {
    if (!texto.trim()) return
    setEnviando(true)
    setError("")
    const r = await mandarMensaje(token, texto)
    setEnviando(false)
    if (!r.ok) return setError(r.mensaje)
    setTexto("")
    void cargar()
  }
  return (
    <section className={caja}>
      <h2 className="text-lg font-extrabold text-[#142033]">Conversación con {taller}</h2>
      <p className="mt-1 text-sm text-[#6B675C]">
        Aclaren detalles, ajusten condiciones y den seguimiento aquí. {oculto && "Por tu seguridad, correos, teléfonos y ligas se ocultan hasta que compartas tu contacto o firmen el acuerdo."}
      </p>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-xl bg-[#FAF9F6] p-3">
        {lista.length === 0 && <p className="text-sm text-[#8A867B]">Todavía no hay mensajes. Salúdalo y confirma los detalles de tu trabajo.</p>}
        {lista.map((m) => (
          <div key={m.id} className={`flex ${m.mio ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mio ? "bg-[#142033] text-white" : "border border-[#E7E4DC] bg-white text-[#142033]"}`}>
              <p className="whitespace-pre-wrap">{m.texto}</p>
              <p className={`mt-1 text-[11px] ${m.mio ? "text-white/60" : "text-[#8A867B]"}`}>{fecha(m.fecha)}</p>
            </div>
          </div>
        ))}
        <div ref={fin} />
      </div>
      <div className="mt-3 flex gap-2">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={2000} className={input} placeholder="Escribe tu mensaje…" />
        <button type="button" onClick={enviar} disabled={enviando || !texto.trim()} className={btn}>
          {enviando ? "…" : "Enviar"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-[#B3261E]">{error}</p>}
    </section>
  )
}

export default function AcuerdoSafeDeal({ token }: { token: string }) {
  const [a, setA] = useState<any>(null)
  const [cond, setCond] = useState<Record<string, string>>({})
  const [editando, setEditando] = useState(false)
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [firma, setFirma] = useState({ nombre: "", representacion: "", codigo: "", acepto: false })
  const [codigoEnviado, setCodigoEnviado] = useState("")

  const cargar = useCallback(async () => {
    const d = await verAcuerdo(token)
    setA(d)
    if (d?.contrato) setCond(d.contrato.condiciones || {})
    else if (d?.sugerencia) setCond(d.sugerencia)
  }, [token])
  useEffect(() => {
    void cargar()
  }, [cargar])

  if (!a?.disponible) return null
  const k = a.contrato
  const firmado = k?.estado === "firmado"
  const hacer = async (cuerpo: Record<string, unknown>, ok?: string) => {
    setOcupado(true)
    setNota(null)
    const r = await accionAcuerdo(token, cuerpo)
    setOcupado(false)
    if (!r.ok) {
      setNota({ ok: false, t: r.mensaje })
      void cargar()
      return null
    }
    if (ok) setNota({ ok: true, t: ok })
    await cargar()
    return r.body
  }
  const guardar = async () => {
    if (await hacer({ accion: "guardar", condiciones: cond }, "Guardado. El taller debe revisar y aprobar de nuevo.")) setEditando(false)
  }
  const pdf = (tipo: string, version?: number) => `/api/contrato/${token}?tipo=${tipo}${version ? `&version=${version}` : ""}`

  return (
    <>
      <Conversacion token={token} taller={a.taller} oculto={!a.contactos_liberados} />

      <section className={caja}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-extrabold text-[#142033]">🤝 Acuerdo HETNA SafeDeal</h2>
          <span className="rounded-full bg-[#F3F1EA] px-2.5 py-0.5 text-xs font-semibold text-[#6B675C]">Opcional</span>
          {firmado && <span className="rounded-full bg-[#E6F4EA] px-2.5 py-0.5 text-xs font-bold text-[#1E7B3A]">Firmado por ambos</span>}
        </div>

        {!firmado && (
          <div className="mt-3 rounded-xl border border-[#F2C98F] bg-[#FFF8EE] p-3 text-sm text-[#40403A]">
            <b>⚠️ Recomendado para el bienestar de los dos.</b> Un acuerdo por escrito protege tus pagos y tus planos, y al taller le da certeza sobre lo que
            debe entregar: precio, fechas, calidad, garantía y confidencialidad. Se firma aquí mismo con un código que llega a tu correo, sin imprimir nada.
          </div>
        )}
        {a.leyenda && <p className="mt-2 text-xs font-semibold text-[#C2560A]">{a.leyenda}</p>}

        {a.contactos_liberados && a.contacto_otro && (
          <div className="mt-3 rounded-xl bg-[#EEF6F0] p-3 text-sm text-[#142033]">
            <b>Contacto del taller:</b>{" "}
            {[a.contacto_otro.nombre, a.contacto_otro.email, a.contacto_otro.telefono && `Tel. ${a.contacto_otro.telefono}`, a.contacto_otro.whatsapp && `WhatsApp ${a.contacto_otro.whatsapp}`]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}

        {/* Sin acuerdo o editando el borrador */}
        {(!k || (k.estado === "borrador" && editando)) && (
          <div className="mt-4 grid gap-3">
            {!k && !editando ? (
              <button type="button" className={btn + " justify-self-start"} onClick={() => setEditando(true)}>
                Preparar el acuerdo
              </button>
            ) : (
              <>
                <p className="text-sm text-[#6B675C]">Lo llenamos con los datos de la propuesta. Ajusta lo que haga falta; el taller lo revisa y lo aprueba.</p>
                {a.apartados.map((ap: { clave: string; titulo: string }, i: number) => (
                  <label key={ap.clave} className="text-sm">
                    <span className="mb-1 block font-semibold text-[#142033]">
                      {i + 1}. {ap.titulo}
                    </span>
                    <textarea rows={3} className={input} value={cond[ap.clave] || ""} onChange={(e) => setCond((c) => ({ ...c, [ap.clave]: e.target.value }))} maxLength={3000} />
                  </label>
                ))}
                <details className="text-xs text-[#6B675C]">
                  <summary className="cursor-pointer font-semibold">Cláusula fija: papel de HETNA</summary>
                  <p className="mt-1">{a.clausula_hetna}</p>
                </details>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btn} disabled={ocupado} onClick={guardar}>
                    {k ? "Guardar cambios" : "Proponer al taller"}
                  </button>
                  <button type="button" className={btn2} onClick={() => { setEditando(false); setCond(k?.condiciones || a.sugerencia || {}) }}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Borrador: revisar y aprobar */}
        {k?.estado === "borrador" && !editando && (
          <div className="mt-4 grid gap-3">
            <p className="text-sm text-[#40403A]">
              Versión {k.version} · Cliente: {k.aprobo_cliente ? "✓ aprobó" : "pendiente"} · Taller: {k.aprobo_taller ? "✓ aprobó" : "pendiente"}
              {k.editado_por && <span className="text-[#8A867B]"> · último cambio: {k.editado_por === "cliente" ? "tú" : "el taller"}</span>}
            </p>
            <dl className="grid gap-2 rounded-xl bg-[#FAF9F6] p-3 text-sm">
              {a.apartados.map((ap: { clave: string; titulo: string }, i: number) => (
                <div key={ap.clave}>
                  <dt className="font-semibold text-[#142033]">
                    {i + 1}. {ap.titulo}
                  </dt>
                  <dd className="whitespace-pre-wrap text-[#40403A]">{k.condiciones?.[ap.clave] || "—"}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              {!k.yo_aprobe && (
                <button type="button" className={btn} disabled={ocupado} onClick={() => hacer({ accion: "aprobar", huella: k.huella }, "Aprobaste las condiciones.")}>
                  ✓ Apruebo estas condiciones
                </button>
              )}
              <button type="button" className={btn2} onClick={() => setEditando(true)}>
                Proponer cambios
              </button>
            </div>
          </div>
        )}

        {/* Listo: firmar */}
        {k?.estado === "listo" && (
          <div className="mt-4 grid gap-3">
            <p className="text-sm text-[#40403A]">
              Las dos partes aprobaron la versión {k.version}. El contrato quedó bloqueado:{" "}
              <a className="font-semibold text-[#C2560A] underline" href={pdf("contrato")}>
                descarga y revisa el PDF
              </a>
              .
            </p>
            <p className="break-all text-xs text-[#8A867B]">Huella SHA-256: {k.sha256}</p>
            <p className="text-sm text-[#40403A]">Firmas: {k.firmas.length ? k.firmas.map((f: any) => `${f.parte === "cliente" ? "Cliente" : "Taller"} (${f.nombre})`).join(", ") : "ninguna todavía"}</p>
            {!k.yo_firme ? (
              <div className="grid gap-2 rounded-xl border border-[#E7E4DC] p-3 sm:grid-cols-2">
                <input className={input} placeholder="Tu nombre completo" value={firma.nombre} onChange={(e) => setFirma({ ...firma, nombre: e.target.value })} />
                <input className={input} placeholder="Empresa que representas (opcional)" value={firma.representacion} onChange={(e) => setFirma({ ...firma, representacion: e.target.value })} />
                <label className="flex items-start gap-2 text-sm text-[#40403A] sm:col-span-2">
                  <input type="checkbox" className="mt-1 accent-[#C2560A]" checked={firma.acepto} onChange={(e) => setFirma({ ...firma, acepto: e.target.checked })} />
                  Leí el contrato (versión {k.version}) y acepto firmarlo electrónicamente.
                </label>
                {!codigoEnviado ? (
                  <button
                    type="button"
                    className={btn + " sm:col-span-2 justify-self-start"}
                    disabled={ocupado || !firma.acepto || firma.nombre.trim().length < 5}
                    onClick={async () => {
                      const r = await hacer({ accion: "codigo" })
                      if (r) setCodigoEnviado(r.correo || "tu correo")
                    }}
                  >
                    Enviarme el código para firmar
                  </button>
                ) : (
                  <>
                    <input className={input} inputMode="numeric" maxLength={6} placeholder={`Código enviado a ${codigoEnviado}`} value={firma.codigo} onChange={(e) => setFirma({ ...firma, codigo: e.target.value.replace(/\D/g, "") })} />
                    <button
                      type="button"
                      className={btn}
                      disabled={ocupado || firma.codigo.length !== 6 || !firma.acepto}
                      onClick={() => hacer({ accion: "firmar", ...firma, sha256: k.sha256 }, "¡Firmaste! Te avisamos cuando firme el taller.")}
                    >
                      Firmar contrato
                    </button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm font-semibold text-[#1E7B3A]">✓ Ya firmaste. Falta la firma del taller.</p>
            )}
            <button
              type="button"
              className={btn2 + " justify-self-start"}
              disabled={ocupado}
              onClick={() => hacer({ accion: "guardar", condiciones: k.condiciones }, "Se creó una versión nueva: haz tus cambios y ambos vuelven a aprobar y firmar.")}
            >
              Cambiar condiciones (crea una versión nueva)
            </button>
          </div>
        )}

        {/* Firmado */}
        {firmado && (
          <div className="mt-4 grid gap-2 text-sm text-[#40403A]">
            <p>
              Firmado el {fecha(k.firmado_en)} por {k.firmas.map((f: any) => f.nombre).join(" y ")}. Ninguna parte, ni HETNA, puede modificar esta versión.
            </p>
            <p className="break-all text-xs text-[#8A867B]">Huella SHA-256: {k.sha256}</p>
            <div className="flex flex-wrap gap-2">
              <a className={btn} href={pdf("contrato", k.version)}>
                Descargar contrato
              </a>
              <a className={btn2} href={pdf("constancia", k.version)}>
                Constancia de firmas
              </a>
              <button type="button" className={btn2} disabled={ocupado} onClick={() => hacer({ accion: "guardar", condiciones: k.condiciones }, "Se creó una versión nueva para modificar.")}>
                Modificar (versión nueva)
              </button>
            </div>
          </div>
        )}

        {a.firmados?.length > 1 && (
          <p className="mt-3 text-xs text-[#6B675C]">
            Versiones firmadas:{" "}
            {a.firmados.map((f: any) => (
              <a key={f.id} className="mr-2 underline" href={pdf("contrato", f.version)}>
                v{f.version}
              </a>
            ))}
          </p>
        )}
        {nota && <p className={`mt-3 text-sm ${nota.ok ? "text-[#1E7B3A]" : "text-[#B3261E]"}`}>{nota.t}</p>}
      </section>
    </>
  )
}
