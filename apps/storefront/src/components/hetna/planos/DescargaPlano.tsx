"use client"

import { useEffect, useState } from "react"

import { pedirPlanoCorreo } from "@/lib/planos/acciones"

const LLAVE = "hetna_planos_correo"

// Descarga del plano: primero el correo (con permiso), luego PDF (imprimir la
// lámina) y DXF para router CNC. El correo queda guardado en este navegador
// para no pedirlo otra vez en los demás planos.
export default function DescargaPlano({ slug, nombre, dxfs }: { slug: string; nombre: string; dxfs: { nombre: string; dxf: string }[] }) {
  const [listo, setListo] = useState(false)
  const [email, setEmail] = useState("")
  const [acepta, setAcepta] = useState(false)
  const [promos, setPromos] = useState(false)
  const [trampa, setTrampa] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(LLAVE)
      if (guardado) {
        setListo(true)
        // otro plano con el mismo correo: se registra sin volver a preguntar
        const d = JSON.parse(guardado) as { email: string; promos: boolean; planos?: string[] }
        if (!d.planos?.includes(slug)) {
          pedirPlanoCorreo({ email: d.email, plano: slug, acepta: true, promos: d.promos }).catch(() => {})
          localStorage.setItem(LLAVE, JSON.stringify({ ...d, planos: [...(d.planos || []), slug] }))
        }
      }
    } catch {}
  }, [slug])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setEnviando(true)
    const r = await pedirPlanoCorreo({ email, plano: slug, acepta, promos, sitio_web: trampa })
    setEnviando(false)
    if (!r.ok) return setError(r.mensaje)
    try { localStorage.setItem(LLAVE, JSON.stringify({ email, promos, planos: [slug] })) } catch {}
    setListo(true)
  }

  function bajar(d: { nombre: string; dxf: string }) {
    const url = URL.createObjectURL(new Blob([d.dxf], { type: "application/dxf" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `HETNA-${slug}-${d.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.dxf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const boton = "inline-flex items-center rounded-[12px] px-5 py-3 text-[15px] font-bold"

  if (listo) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-5 print:hidden">
        <p className="m-0 text-[15px] font-bold text-[#142033]">Tu plano: {nombre}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className={`${boton} bg-[#142033] text-white`}>Guardar en PDF</button>
          {dxfs.map((d) => (
            <button key={d.nombre} type="button" onClick={() => bajar(d)} className={`${boton} border border-[#142033] text-[#142033]`}>
              DXF · {d.nombre}
            </button>
          ))}
        </div>
        <p className="m-0 text-[13px] text-[#6B6A63]">El DXF trae las piezas ya acomodadas en hojas de 2440 × 1220 mm, una capa por letra de la lista de corte.</p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-5 print:hidden">
      <p className="m-0 text-[16px] font-bold text-[#142033]">Bájalo gratis: PDF y DXF para router CNC</p>
      <p className="m-0 text-[13px] text-[#6B6A63]">Te mandamos la liga a tu correo y aquí mismo se abren las descargas.</p>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className="rounded-[10px] border border-[#D9D5CA] px-4 py-3 text-[15px]" />
      <input type="text" tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} className="hidden" aria-hidden="true" />
      <label className="flex items-start gap-2 text-[13px] text-[#40403A]">
        <input type="checkbox" required checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5" />
        <span>Mándame este plano a mi correo. Leí el <a href="/mx/aviso-de-privacidad" className="text-[#B34D07] underline">aviso de privacidad</a>.</span>
      </label>
      <label className="flex items-start gap-2 text-[13px] text-[#40403A]">
        <input type="checkbox" checked={promos} onChange={(e) => setPromos(e.target.checked)} className="mt-0.5" />
        <span>También quiero recibir planos nuevos y novedades de HETNA (te das de baja cuando quieras).</span>
      </label>
      {error && <p className="m-0 text-[13px] font-semibold text-[#B42318]">{error}</p>}
      <button type="submit" disabled={enviando} className={`${boton} justify-center bg-[#FF6A1A] text-white disabled:opacity-60`}>
        {enviando ? "Enviando…" : "Bajar plano gratis"}
      </button>
    </form>
  )
}
