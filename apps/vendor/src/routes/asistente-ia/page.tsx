// @ts-nocheck
// Asistente de IA de fabricación (backend: /vendor/hetna-ia, lib/ia-fabricacion.ts).
// Sólo para talleres con plan de pago. La conversación se queda en este
// navegador (sessionStorage); el servidor no la guarda.
import { useEffect, useRef, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" />
    <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
  </svg>
)

export const config: RouteConfig = {
  label: "Asistente IA",
  icon: Icono,
}

const CLAVE = "hetna-ia-chat"
const EJEMPLOS = [
  "¿A qué RPM y avance corto MDF de 15 mm con fresa de 6 mm de 2 filos?",
  "¿Qué potencia y velocidad uso en láser CO2 de 80 W para acrílico de 5 mm?",
  "¿Cuánto cobra HETNA por cortar 20 piezas de 30x40 cm en MDF con láser?",
  "¿Qué trabajos abiertos hay de plasma en Jalisco?",
]

const S = {
  page: { maxWidth: 860, margin: "0 auto", padding: "24px 16px 40px", fontFamily: "inherit" },
  h1: { fontSize: 26, fontWeight: 800, margin: 0, color: "#142033", letterSpacing: "-0.02em" },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 16px" },
  caja: { background: "rgba(255,255,255,0.85)", border: "1px solid rgba(20,32,51,0.08)", borderRadius: 16, padding: 16, minHeight: 320 },
  yo: { background: "#142033", color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "10px 14px", margin: "8px 0 8px auto", maxWidth: "80%", whiteSpace: "pre-wrap", fontSize: 14 },
  ia: { background: "#FAF6EF", color: "#1B1B18", borderRadius: "14px 14px 14px 4px", padding: "10px 14px", margin: "8px auto 8px 0", maxWidth: "88%", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 },
  area: { flex: 1, minHeight: 48, border: "1px solid #D9D5C9", borderRadius: 12, padding: 10, fontSize: 14, fontFamily: "inherit", resize: "vertical" },
  btn: { background: "linear-gradient(180deg,#D9600B,#C2560A)", color: "#fff", border: 0, borderRadius: 12, padding: "0 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  chip: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer", textAlign: "left" },
  aviso: { background: "#FFF7ED", border: "1px solid #FED7AA", color: "#7C2D12", borderRadius: 12, padding: 14, fontSize: 14 },
  nota: { color: "#8A887F", fontSize: 12, marginTop: 10 },
}

// Ligas clicables dentro del texto
function Texto({ t }) {
  const partes = String(t).split(/(https?:\/\/[^\s)]+)/g)
  return partes.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: "#B34D07", fontWeight: 600, wordBreak: "break-all" }}>
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    )
  )
}

export default function AsistenteIA() {
  const [estado, setEstado] = useState(null)
  const [mensajes, setMensajes] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(CLAVE) || "[]")
    } catch {
      return []
    }
  })
  const [texto, setTexto] = useState("")
  const [pensando, setPensando] = useState(false)
  const [error, setError] = useState("")
  const fin = useRef(null)

  useEffect(() => {
    fetch("/vendor/hetna-ia", { credentials: "include" })
      .then((r) => r.json())
      .then(setEstado)
      .catch(() => setEstado({ permitido: false, message: "No se pudo cargar el asistente." }))
  }, [])

  useEffect(() => {
    sessionStorage.setItem(CLAVE, JSON.stringify(mensajes.slice(-30)))
    fin.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [mensajes, pensando])

  const enviar = async (pregunta) => {
    const q = String(pregunta ?? texto).trim()
    if (!q || pensando) return
    const lista = [...mensajes, { rol: "taller", texto: q }]
    setMensajes(lista)
    setTexto("")
    setError("")
    setPensando(true)
    try {
      const r = await fetch("/vendor/hetna-ia", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: lista.slice(-12) }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "El asistente no respondió.")
      setMensajes([...lista, { rol: "asistente", texto: d.texto }])
      setEstado((e) => (e ? { ...e, mensajes_hoy: (e.mensajes_hoy || 0) + 1 } : e))
    } catch (e) {
      setError(e.message)
    } finally {
      setPensando(false)
    }
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Asistente de fabricación</h1>
      <p style={S.sub}>
        Pregunta por velocidades, avances, potencia, tiempos, precios y trabajo disponible. Las cuentas las hacen las calculadoras de HETNA; la IA sólo
        elige cuál usar y te explica el resultado.
      </p>

      {!estado && <p style={S.sub}>Cargando…</p>}

      {estado && !estado.permitido && (
        <div style={S.aviso}>
          {estado.message}
          {estado.motivo === "sin_plan" && (
            <div style={{ marginTop: 8 }}>
              <a href="https://hetnacnc.com/mx/servicios/cotizador-cnc" target="_blank" rel="noreferrer" style={{ color: "#B34D07", fontWeight: 700 }}>
                Ver planes
              </a>
            </div>
          )}
        </div>
      )}

      {estado?.permitido && (
        <>
          {estado.pausada && <div style={{ ...S.aviso, marginBottom: 12 }}>El asistente llegó a su tope del mes y vuelve el día 1.</div>}
          <div style={S.caja}>
            {mensajes.length === 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 14, color: "#40403A", fontWeight: 600 }}>Prueba con:</p>
                {EJEMPLOS.map((e) => (
                  <button key={e} type="button" style={S.chip} onClick={() => enviar(e)}>
                    {e}
                  </button>
                ))}
              </div>
            )}
            {mensajes.map((m, i) => (
              <div key={i} style={m.rol === "taller" ? S.yo : S.ia}>
                <Texto t={m.texto} />
              </div>
            ))}
            {pensando && <div style={{ ...S.ia, color: "#8A887F" }}>Calculando…</div>}
            <div ref={fin} />
          </div>

          {error && <p style={{ color: "#B91C1C", fontSize: 14, margin: "10px 0 0" }}>{error}</p>}

          <form
            style={{ display: "flex", gap: 8, marginTop: 12 }}
            onSubmit={(e) => {
              e.preventDefault()
              enviar()
            }}
          >
            <textarea
              style={S.area}
              value={texto}
              maxLength={2000}
              placeholder="Escribe tu pregunta…"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  enviar()
                }
              }}
            />
            <button type="submit" style={{ ...S.btn, opacity: pensando || estado.pausada ? 0.6 : 1 }} disabled={pensando || estado.pausada}>
              Enviar
            </button>
          </form>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <p style={S.nota}>
              Los valores son puntos de partida: haz siempre un corte de prueba. Tus preguntas se procesan con Claude (Anthropic); no escribas datos
              personales de tus clientes.
            </p>
            <p style={S.nota}>
              {estado.mensajes_hoy || 0} de {estado.mensajes_dia} preguntas hoy
              {mensajes.length > 0 && (
                <>
                  {" · "}
                  <button type="button" onClick={() => setMensajes([])} style={{ background: "none", border: 0, color: "#B34D07", cursor: "pointer", fontSize: 12, padding: 0 }}>
                    Nueva conversación
                  </button>
                </>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
