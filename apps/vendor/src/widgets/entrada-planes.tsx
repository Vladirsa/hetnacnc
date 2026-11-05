// @ts-nocheck
// Página de entrada del panel de vendedor: planes y comisiones de HETNA y la
// casilla para aceptar los Términos para vendedores. Sin la casilla marcada no
// se puede entrar. La aceptación se registra en el servidor (versión, fecha e
// IP) en cuanto entra al panel (lib/requisitos.tsx), y se vuelve a pedir sólo
// cuando cambia la versión de los términos.
import { useEffect, useRef, useState } from "react"
import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

import { LLAVE_TERMINOS } from "../lib/requisitos"

const TIENDA = "https://hetnacnc.com/mx"

function EntradaPlanes() {
  const [datos, setDatos] = useState(null)
  const [acepto, setAcepto] = useState(false)
  const [aviso, setAviso] = useState(false)
  const [abierto, setAbierto] = useState(true)
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
          He leído y acepto los{" "}
          <a href={`${TIENDA}/terminos-vendedores`} target="_blank" rel="noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}>
            Términos para vendedores
          </a>
          {datos?.terminos_version ? ` (versión ${datos.terminos_version})` : ""}, la lista de precios y comisiones y el{" "}
          <a href={`${TIENDA}/aviso-de-privacidad`} target="_blank" rel="noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}>
            Aviso de privacidad
          </a>
          .
          {aviso && <strong style={{ display: "block", color: "#B91C1C", marginTop: 4 }}>Marca la casilla para entrar.</strong>}
        </span>
      </label>

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
          <span>Planes y comisiones de HETNA</span>
          <span aria-hidden="true">{abierto ? "▲" : "▼"}</span>
        </button>
        {abierto && (
          <div style={{ padding: 12, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 12 }}>
            {!datos && <span>Cargando precios…</span>}
            {[planes, ventas, academia].filter(Boolean).map((g) => (
              <div key={g.id}>
                <strong style={{ display: "block", color: "#142033", marginBottom: 4 }}>{g.titulo}</strong>
                {g.texto && <span style={{ display: "block", color: "#6B675C", marginBottom: 4 }}>{g.texto}</span>}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {g.filas.map((f) => (
                      <tr key={f.concepto} style={{ borderTop: "1px solid #F0EEE7" }}>
                        <td style={{ padding: "4px 0", verticalAlign: "top" }}>
                          {f.concepto}
                          {f.nota && <span style={{ display: "block", color: "#9A978C", fontSize: 11.5 }}>{f.nota}</span>}
                        </td>
                        <td style={{ padding: "4px 0 4px 8px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>{f.precio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <span style={{ color: "#6B675C" }}>
              Para publicar o cotizar se verifica una tarjeta de débito o crédito con un cargo de ${datos?.monto_verificacion || 10} que se devuelve al
              momento (Mercado Pago o PayPal).{" "}
              <a href={`${TIENDA}/terminos-vendedores#tarifas`} target="_blank" rel="noreferrer" style={{ color: "#C2560A" }}>
                Ver lista completa
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
