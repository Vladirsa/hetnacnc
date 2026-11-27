// /seller/entrar-red: aquí regresa la entrada con Google, Facebook o LinkedIn
// (la tienda hace el viaje: apps/storefront/src/app/api/auth/social/[red]/regreso).
// El token llega después del "#" (no llega a ningún servidor ni log): se borra de la
// dirección antes de cualquier otra cosa, se abre la sesión del panel con él (igual
// que al entrar con correo) y:
//   - taller que ya existe: a escoger tienda
//   - taller nuevo: al alta (el correo del miembro lo pone el servidor desde la
//     identidad, no este navegador; ver api/vendor/hetna-alta-cuenta)
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

// Sin "label": no sale en el menú. Objeto literal: el plugin de Vite lee "public" del código
export const config = { public: true }

const S = {
  caja: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "inherit" },
  tarjeta: { maxWidth: 420, textAlign: "center" as const, display: "flex", flexDirection: "column" as const, gap: 12 },
}

export default function EntrarConRed() {
  const navigate = useNavigate()
  const [error, setError] = useState("")

  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    // Fuera el token de la dirección y del historial
    window.history.replaceState(null, "", window.location.pathname)
    const token = h.get("t") || ""
    if (!token) {
      navigate("/login", { replace: true })
      return
    }
    ;(async () => {
      try {
        const r = await fetch("/auth/session", { method: "POST", credentials: "include", headers: { Authorization: `Bearer ${token}` } })
        if (!r.ok) throw new Error()
        const email = h.get("e") || ""
        if (h.get("n") === "1") {
          try {
            sessionStorage.setItem("mercur_onboarding_email", email)
            sessionStorage.setItem("mercur_register_draft", JSON.stringify({ first_name: h.get("fn") || "", last_name: h.get("ln") || "" }))
          } catch {
            // sin almacenamiento: el alta pide el correo con el estado de la navegación
          }
          navigate("/onboarding", { replace: true, state: { email } })
        } else {
          navigate("/store-select", { replace: true, state: { email } })
        }
      } catch {
        setError("No se pudo abrir tu sesión. Vuelve a intentarlo o entra con tu correo.")
      }
    })()
  }, [navigate])

  return (
    <div style={S.caja}>
      <div style={S.tarjeta}>
        {error ? (
          <>
            <p style={{ color: "#B91C1C", margin: 0 }}>{error}</p>
            <a href="/seller/login" style={{ color: "#C2560A", fontWeight: 600 }}>
              Volver a la entrada
            </a>
          </>
        ) : (
          <p style={{ margin: 0, color: "#52525B" }}>Abriendo tu panel…</p>
        )}
      </div>
    </div>
  )
}
