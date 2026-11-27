// @ts-nocheck
// Página de entrada del panel de vendedor: planes y comisiones de HETNA y la
// casilla para aceptar los Términos para vendedores. Sin la casilla marcada no
// se puede entrar. La aceptación se registra en el servidor (versión, fecha e
// IP) en cuanto entra al panel (lib/requisitos.tsx), y se vuelve a pedir sólo
// cuando cambia la versión de los términos.
import { T } from "../lib/idioma"
import { useEffect, useRef, useState } from "react"
import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

import { LLAVE_TERMINOS } from "../lib/requisitos"

const TIENDA = "https://hetnacnc.com/mx"
const NOMBRE_RED: Record<string, string> = { google: "Google", facebook: "Facebook", linkedin: "LinkedIn" }

function IconoRed({ red }: { red: string }) {
  if (red === "google")
    return (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    )
  if (red === "facebook")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
      </svg>
    )
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#0A66C2" d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM7.1 20.5H3.5V9h3.6v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z" />
    </svg>
  )
}

function EntradaPlanes() {
  const [datos, setDatos] = useState(null)
  const [acepto, setAcepto] = useState(false)
  const [aviso, setAviso] = useState(false)
  const [abierto, setAbierto] = useState(true)
  // Entrar con Google, Facebook o LinkedIn (sólo las redes con llaves en el servidor)
  const [redes, setRedes] = useState<string[]>([])
  const [errorRed] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("social") || ""
    } catch {
      return ""
    }
  })
  const caja = useRef<HTMLDivElement>(null)
  const aceptado = useRef(false)
  aceptado.current = acepto

  useEffect(() => {
    fetch("/api/hetna-planes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setDatos(d)
        try {
          // Ya los aceptó en este navegador (misma versión): queda marcada
          if (d?.terminos_version && localStorage.getItem(LLAVE_TERMINOS) === d.terminos_version) setAcepto(true)
        } catch {}
      })
      .catch(() => setDatos(null))
  }, [])

  useEffect(() => {
    fetch("/api/auth/social")
      .then((r) => (r.ok ? r.json() : { redes: [] }))
      .then((d) => setRedes(Array.isArray(d?.redes) ? d.redes : []))
      .catch(() => setRedes([]))
  }, [])

  // Sin la casilla no se manda el formulario de entrada (también con Enter)
  useEffect(() => {
    const alEnviar = (ev: Event) => {
      const form = ev.target as HTMLFormElement
      if (!form?.querySelector?.('input[type="password"]')) return
      if (aceptado.current) return
      ev.preventDefault()
      ev.stopImmediatePropagation()
      setAviso(true)
      caja.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
    window.addEventListener("submit", alEnviar, true)
    return () => window.removeEventListener("submit", alEnviar, true)
  }, [])

  const cambiar = (v: boolean) => {
    setAcepto(v)
    setAviso(false)
    try {
      if (v && datos?.terminos_version) localStorage.setItem(LLAVE_TERMINOS, datos.terminos_version)
      if (!v) localStorage.removeItem(LLAVE_TERMINOS)
    } catch {}
  }

  const planes = datos?.grupos?.find((g) => g.id === "cotizador")
  const ventas = datos?.grupos?.find((g) => g.id === "ventas")
  const academia = datos?.grupos?.find((g) => g.id === "academia")

  return (
    <div ref={caja} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <label
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: 12,
          borderRadius: 10,
          border: `1.5px solid ${aviso ? "#DC2626" : "#E4E4E7"}`,
          background: aviso ? "#FEF2F2" : "transparent",
          fontSize: 13,
          lineHeight: 1.45,
          cursor: "pointer",
        }}
      >
        <input type="checkbox" checked={acepto} onChange={(e) => cambiar(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, flex: "none" }} />
        <span>
          <T>He leído y acepto los</T><T>{" "}</T>
          <a href={`${TIENDA}/terminos-vendedores`} target="_blank" rel="noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}>
            <T>Términos para vendedores</T>
          </a>
          <T>{datos?.terminos_version ? ` (versión ${datos.terminos_version})` : ""}</T><T>, la lista de precios y comisiones y el</T><T>{" "}</T>
          <a href={`${TIENDA}/aviso-de-privacidad`} target="_blank" rel="noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}>
            <T>Aviso de privacidad</T>
          </a>
          .
          {aviso && <strong style={{ display: "block", color: "#B91C1C", marginTop: 4 }}><T>Marca la casilla para entrar.</T></strong>}
        </span>
      </label>

      {errorRed && (
        <div role="alert" style={{ padding: 10, borderRadius: 10, background: "#FEF2F2", color: "#B91C1C", fontSize: 13, lineHeight: 1.45 }}>
          {errorRed}
        </div>
      )}

      {redes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "#52525B", textAlign: "center" }}>O entra / crea tu taller con</span>
          {redes.map((red) => (
            <a
              key={red}
              href={`/api/auth/social/${red}?para=taller`}
              onClick={(e) => {
                // Misma regla que el formulario: sin la casilla no se entra
                if (aceptado.current) return
                e.preventDefault()
                setAviso(true)
                caja.current?.scrollIntoView({ behavior: "smooth", block: "center" })
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "9px 12px",
                borderRadius: 8,
                border: "1px solid #D4D4D8",
                background: "#FFFFFF",
                color: "#142033",
                fontSize: 13.5,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <IconoRed red={red} />
              {NOMBRE_RED[red] || red}
            </a>
          ))}
        </div>
      )}

      <div style={{ borderRadius: 10, border: "1px solid #E4E4E7", overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
            background: "#FAF8F3",
            border: 0,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            color: "#142033",
          }}
        >
          <span><T>Planes y comisiones de HETNA</T></span>
          <span aria-hidden="true"><T>{abierto ? "▲" : "▼"}</T></span>
        </button>
        {abierto && (
          <div style={{ padding: 12, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 12 }}>
            {!datos && <span><T>Cargando precios…</T></span>}
            {[planes, ventas, academia].filter(Boolean).map((g) => (
              <div key={g.id}>
                <strong style={{ display: "block", color: "#142033", marginBottom: 4 }}><T>{g.titulo}</T></strong>
                {g.texto && <span style={{ display: "block", color: "#6B675C", marginBottom: 4 }}><T>{g.texto}</T></span>}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {g.filas.map((f) => (
                      <tr key={f.concepto} style={{ borderTop: "1px solid #F0EEE7" }}>
                        <td style={{ padding: "4px 0", verticalAlign: "top" }}>
                          <T>{f.concepto}</T>
                          {f.nota && <span style={{ display: "block", color: "#9A978C", fontSize: 11.5 }}><T>{f.nota}</T></span>}
                        </td>
                        <td style={{ padding: "4px 0 4px 8px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>{f.precio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <span style={{ color: "#6B675C" }}>
              <T>Para publicar o cotizar se verifica una tarjeta de débito o crédito con un cargo de $</T>{datos?.monto_verificacion || 10} <T>que se devuelve al
              momento (Mercado Pago o PayPal).</T><T>{" "}</T>
              <a href={`${TIENDA}/terminos-vendedores#tarifas`} target="_blank" rel="noreferrer" style={{ color: "#C2560A" }}>
                <T>Ver lista completa</T>
              </a>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "login.after",
})

export default EntradaPlanes
