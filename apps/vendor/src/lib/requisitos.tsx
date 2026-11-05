// @ts-nocheck
// Requisitos para publicar y cotizar en HETNA (términos vigentes + tarjeta
// verificada). Aviso reutilizable para el tablero y las listas del panel.
// Backend: /vendor/hetna-requisitos (packages/api/src/lib/requisitos-vendedor.ts)
import { useEffect, useState } from "react"

export const LLAVE_TERMINOS = "hetna_terminos_aceptados"

export async function leerRequisitos(extra = "") {
  const r = await fetch(`/vendor/hetna-requisitos${extra}`, { credentials: "include" })
  if (!r.ok) throw new Error("No se pudo leer el estado de tu cuenta.")
  return r.json()
}

export async function aceptarTerminos(version: string) {
  const r = await fetch("/vendor/hetna-requisitos/terminos", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.message || "No se guardó.")
}

/** Usa el estado de requisitos; si en la entrada marcó "acepto", lo registra solo. */
export function useRequisitos() {
  const [estado, setEstado] = useState(null)
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        let e = await leerRequisitos()
        // Aceptó los términos en la página de entrada (casilla): se deja constancia
        let marcado = ""
        try {
          marcado = localStorage.getItem(LLAVE_TERMINOS) || ""
        } catch {}
        if (!e.exento && !e.terminos.ok && marcado === e.terminos.version_vigente) {
          await aceptarTerminos(marcado).catch(() => {})
          e = await leerRequisitos()
        }
        if (vivo) setEstado(e)
      } catch {
        if (vivo) setEstado(null)
      }
    })()
    return () => {
      vivo = false
    }
  }, [])
  return estado
}

export function AvisoRequisitos() {
  const e = useRequisitos()
  if (!e || e.completo) return null
  const falta = [!e.terminos.ok && "aceptar los Términos para vendedores", !e.tarjeta.ok && "verificar tu tarjeta"].filter(Boolean)
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        borderRadius: 10,
        background: "#FFF4E8",
        border: "1px solid #F2C98F",
        color: "#5A3A12",
        margin: "0 0 12px",
      }}
    >
      <span style={{ fontSize: 14 }}>
        <strong>Activa tu cuenta:</strong> para publicar y cotizar falta {falta.join(" y ")}. Toma un minuto; el cargo de $
        {e.monto_verificacion || 10} se devuelve al momento.
      </span>
      <a
        href="/seller/requisitos"
        style={{ background: "#C2560A", color: "#fff", padding: "8px 14px", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none" }}
      >
        Activar ahora
      </a>
    </div>
  )
}
