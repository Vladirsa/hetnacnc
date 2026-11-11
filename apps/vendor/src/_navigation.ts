// Ajustes al menú lateral del panel de vendedor (Mercur).
// El agrupado por secciones (Principal, Catálogo…) se hace con CSS en
// hetna-theme.css; aquí sólo se renombran opciones del paquete.
import { defineNavigationConfig } from "@mercurjs/dashboard-sdk"

export default defineNavigationConfig({
  items: [
    { id: "reviews", label: "Reseñas" },
  ],
})
