"use client"

// Paso "Privacidad" del formulario de solicitud (Licitaciones 3.0, Fase 1).
// El cliente decide modalidad y, elemento por elemento, qué ven los talleres.
// Manda sus valores en campos ocultos que lee FormSolicitudTaller.
import { useMemo, useState } from "react"

type Opcion = [valor: string, texto: string]
type Control = { clave: string; titulo: string; ayuda: string; opciones: Opcion[] }

const CONTROLES: Control[] = [
  { clave: "nombre", titulo: "Tu nombre", ayuda: "Cómo te ven los talleres", opciones: [["anonimo", "Anónimo"], ["empresa", "Sólo mi empresa"], ["publico", "Mi nombre"]] },
  { clave: "empresa", titulo: "Nombre de la empresa", ayuda: "Si escribiste una", opciones: [["confidencial", "Confidencial"], ["publico", "Público"]] },
  { clave: "presupuesto", titulo: "Presupuesto", ayuda: "Si lo escribiste", opciones: [["visible", "Visible"], ["confidencial", "Confidencial"]] },
  { clave: "descripcion", titulo: "Descripción", ayuda: "El texto completo de tu trabajo", opciones: [["publica", "Pública"], ["participantes", "Sólo talleres autorizados"]] },
  { clave: "archivos", titulo: "Planos y archivos", ayuda: "DXF, STL, PDF…", opciones: [["publicos", "Los ve cualquier taller"], ["autorizacion", "Sólo los que yo autorice"], ["privados", "Sólo el taller que elija"]] },
  { clave: "fotos", titulo: "Fotografías", ayuda: "Fotos de referencia", opciones: [["publicas", "Las ve cualquier taller"], ["privadas", "Sólo el taller que elija"]] },
  { clave: "ubicacion", titulo: "Ubicación", ayuda: "Lo que se muestra", opciones: [["ciudad", "Ciudad y estado"], ["estado", "Sólo el estado"], ["confidencial", "Confidencial"]] },
  { clave: "contacto", titulo: "Tu contacto", ayuda: "Correo, teléfono y WhatsApp", opciones: [["oculto", "Siempre oculto"], ["autorizacion", "Lo comparto al elegir taller"]] },
]

const INICIAL: Record<string, string> = {
  nombre: "anonimo",
  empresa: "confidencial",
  presupuesto: "visible",
  descripcion: "publica",
  archivos: "publicos",
  fotos: "publicas",
  ubicacion: "ciudad",
  contacto: "oculto",
}

const MODALIDADES: { valor: string; titulo: string; texto: string }[] = [
  { valor: "publica", titulo: "Pública", texto: "La ve cualquier taller compatible. Recibes más propuestas." },
  { valor: "restringida", titulo: "Restringida", texto: "Sale en el catálogo, pero tus planos sólo los ve quien tú autorices." },
  { valor: "privada", titulo: "Privada", texto: "Sólo la ven los talleres que tú invites." },
]

export function PrivacidadSolicitud({ dirigida, servicio, material, estado }: { dirigida: boolean; servicio?: string; material?: string; estado?: string }) {
  const [modalidad, setModalidad] = useState("publica")
  const [p, setP] = useState<Record<string, string>>(INICIAL)
  const [redes, setRedes] = useState(false)
  const [abierto, setAbierto] = useState(false)

  const privada = dirigida || modalidad === "privada"
  const resumen = useMemo(() => {
    const que = [servicio, material && `en ${material}`].filter(Boolean).join(" ")
    const donde = p.ubicacion === "confidencial" ? "" : estado || ""
    return `Un cliente busca talleres CNC${que ? ` para ${que.toLowerCase()}` : ""}.${donde ? ` Ubicación: ${donde}.` : ""} Proyecto disponible para cotización en HETNA CNC.`
  }, [servicio, material, estado, p.ubicacion])

  return (
    <div className="grid gap-4">
      <input type="hidden" name="modalidad" value={dirigida ? "privada" : modalidad} />
      <input type="hidden" name="privacidad" value={JSON.stringify(p)} />
      <input type="hidden" name="difundir_redes" value={redes && !privada ? "1" : ""} />

      {!dirigida && (
        <div className="grid gap-2 sm:grid-cols-3">
          {MODALIDADES.map((m) => (
            <label
              key={m.valor}
              className={`cursor-pointer rounded-xl border p-3 text-sm ${modalidad === m.valor ? "border-[#C2560A] bg-[#FFF6EE]" : "border-[#E7E4DC] bg-white hover:border-[#C2560A]"}`}
            >
              <input type="radio" name="_modalidad" value={m.valor} checked={modalidad === m.valor} onChange={() => setModalidad(m.valor)} className="sr-only" />
              <span className="block font-bold text-[#142033]">{m.titulo}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-[#6B675C]">{m.texto}</span>
            </label>
          ))}
        </div>
      )}
      {dirigida && <p className="text-sm text-[#40403A]">Tu solicitud va sólo al taller que elegiste (privada).</p>}

      {modalidad === "privada" && !dirigida && (
        <div>
          <label className="mb-1 block text-[13px] font-semibold text-[#142033]" htmlFor="invitados">
            Talleres que invitas
          </label>
          <input
            id="invitados"
            name="invitados"
            className="w-full rounded-xl border border-[#E7E4DC] px-3 py-2.5 text-sm outline-none focus:border-[#C2560A]"
            placeholder="Nombre de su tienda, separados por coma (ej. taller-lopez, cortes-mx)"
          />
          <span className="mt-1 block text-xs text-[#6B675C]">
            Es el final de la liga de su tienda: hetnacnc.com/mx/talleres/<b>nombre</b>. También puedes invitar más después, desde tu liga.
          </span>
        </div>
      )}

      <div className="rounded-xl border border-[#E7E4DC] bg-[#FAF9F6]">
        <button type="button" onClick={() => setAbierto((x) => !x)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[#142033]">
          <span>
            🔒 Qué ven los talleres <span className="font-normal text-[#6B675C]">(tu contacto siempre está protegido)</span>
          </span>
          <span className="text-[#C2560A]">{abierto ? "Ocultar" : "Personalizar"}</span>
        </button>
        {abierto && (
          <div className="grid gap-3 border-t border-[#E7E4DC] p-4 sm:grid-cols-2">
            {CONTROLES.map((c) => (
              <div key={c.clave}>
                <label className="mb-1 block text-[13px] font-semibold text-[#142033]" htmlFor={`priv-${c.clave}`}>
                  {c.titulo} <span className="font-normal text-[#8A867B]">· {c.ayuda}</span>
                </label>
                <select
                  id={`priv-${c.clave}`}
                  value={p[c.clave]}
                  onChange={(e) => setP((x) => ({ ...x, [c.clave]: e.target.value }))}
                  className="w-full rounded-xl border border-[#E7E4DC] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#C2560A]"
                >
                  {c.opciones.map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {!privada && (
        <label className="flex items-start gap-2 rounded-xl border border-[#E7E4DC] p-3 text-sm text-[#40403A]">
          <input type="checkbox" checked={redes} onChange={(e) => setRedes(e.target.checked)} className="mt-1 accent-[#C2560A]" />
          <span>
            <b>Autorizo difundir un resumen de mi proyecto en redes sociales</b> para que lo vean más talleres. Se publica sólo esto, sin planos,
            presupuesto confidencial ni contacto:
            <span className="mt-1.5 block rounded-lg bg-[#F3F1EA] px-3 py-2 text-[12.5px] italic text-[#142033]">“{resumen}”</span>
          </span>
        </label>
      )}
    </div>
  )
}
