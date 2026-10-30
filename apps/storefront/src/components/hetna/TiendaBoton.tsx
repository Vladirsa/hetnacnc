// Entrada al panel del vendedor.
//
// Es un <a> normal y no LocalizedClientLink a propósito: /seller lo sirve el
// backend de Mercur, fuera del enrutado por idioma de Next. Con el enlace
// localizado quedaría /mx/seller, que no existe.
//
// Se enseña a todos, no sólo a quien ya vende: para el que vende es su panel y
// para el que no, es la puerta para empezar. Quién puede entrar lo decide el
// propio panel, no esta barra.
export const TiendaBoton = ({ isLoggedIn }: { isLoggedIn: boolean }) => (
  <a
    href="/seller"
    aria-label="Administrador de tienda"
    title={isLoggedIn ? "Administrador de tienda" : "Vender en HETNA CNC"}
    className="flex items-center gap-1.5 p-2 -m-2 text-[#1B1B18] hover:text-[#B34D07]"
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" />
      <path d="M3 9a2.5 2.5 0 0 0 4.5 1.5A2.5 2.5 0 0 0 12 10.5a2.5 2.5 0 0 0 4.5 0A2.5 2.5 0 0 0 21 9" />
    </svg>
    <span className="hidden lg:inline text-[13px] font-medium">Mi tienda</span>
  </a>
)

// Botón del encabezado que abre la app de cotizar para talleres
// (hetnacnc.com/cotizador/). Tomó el lugar de "Mi tienda", que ahora vive en
// el menú de la cuenta (/user). Es un <a> normal por la misma razón que
// arriba: /cotizador/ lo sirve nginx, no Next. La app pide su propio inicio
// de sesión: sin cuenta no se entra.
export const CotizadorBoton = () => (
  <a
    href="/cotizador/"
    aria-label="Cotizador para talleres"
    title="Cotizador para talleres"
    className="flex items-center gap-1.5 p-2 -m-2 text-[#1B1B18] hover:text-[#B34D07]"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="3" width="12" height="18" rx="1.5" />
      <path d="M9 7h6M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01" />
    </svg>
    <span className="hidden lg:inline text-[13px] font-medium">Cotizador</span>
  </a>
)
