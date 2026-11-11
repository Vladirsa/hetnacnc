// Ajustes al menú lateral del panel de vendedor (Mercur).
// El agrupado por secciones (Principal, Catálogo…) se hace con CSS en
// hetna-theme.css; aquí sólo se renombran opciones del paquete.
import { defineNavigationConfig } from "@mercurjs/dashboard-sdk"

export default defineNavigationConfig({
  items: [
    { id: "reviews", label: "Reseñas" },
    // La pantalla de Clientes de Mercur enseña correo y teléfono: se oculta y
    // la reemplaza "Mis clientes" (sin datos de contacto, con chat de HETNA).
    { id: "customers", hidden: true },
  ],
})
