// Iconos de linea para cada servicio de HETNA CNC
const TRAZOS: Record<string, React.ReactNode> = {
  generador: (
    <>
      <path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" />
      <path d="M13.5 6.5l3 3" />
      <path d="M15 3l1 1M20 8l1 1M19 3v2M22 5h-2" />
    </>
  ),
  caja: (
    <>
      <path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5l9 4.5 9-4.5M12 12v9" />
      <path d="M7 9.5v2l2 1v-2M15 12.5v2l2-1v-2" />
    </>
  ),
  empaque: (
    <>
      <path d="M5 9h14v11H5z" />
      <path d="M5 9l2-5h10l2 5M12 4v5" />
    </>
  ),
  llavero: (
    <>
      <circle cx="7" cy="7" r="3" />
      <path d="M9.5 9.5L20 20M14 14l-2 2M17 17l-2 2" />
    </>
  ),
  rompecabezas: (
    <>
      <path d="M5 8h3.8a2.2 2.2 0 1 1 4.4 0H17v5.3a2.2 2.2 0 1 1 0 4.4V21H5z" />
      <path d="M5 12.5a2 2 0 1 0 0 4" />
    </>
  ),
  extruir: (
    <>
      <path d="M4 15l8-4 8 4-8 4z" />
      <path d="M4 15v-4l8-4 8 4v4M12 11V7" />
    </>
  ),
  anidado: (
    <>
      <path d="M3 4h18v16H3z" />
      <path d="M6 7h5v5H6zM13 7h5v3h-5zM6 14h4v3H6zM12 12l3 5h3z" />
    </>
  ),
  convertir: (
    <>
      <path d="M4 7h13l-3-3M20 17H7l3 3" />
      <path d="M4 7v3M20 17v-3" />
    </>
  ),
  mueble: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M4 11h16M12 3v8M9 7h1M14 7h1M10.5 15h3" />
    </>
  ),
  vector: (
    <>
      <path d="M4 19c3-9 7-14 16-14" />
      <rect x="2.5" y="17.5" width="3" height="3" rx=".5" />
      <rect x="18.5" y="3.5" width="3" height="3" rx=".5" />
      <path d="M5.5 19H10M20 6.5V11" />
    </>
  ),
  letrero: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7.5 15l2.5-6 2.5 6M8.5 13h3M15 9v6h2.5" />
    </>
  ),
  grabado: (
    <>
      <path d="M9 3h6v5l-3 3-3-3z" />
      <path d="M12 11v5M8 20h8M9.5 17.5l-1.5 1M14.5 17.5l1.5 1" />
    </>
  ),
  relieve: (
    <>
      <path d="M3 19l5-8 3 4 3-6 7 10z" />
      <path d="M3 19v2h18v-2" />
    </>
  ),
  cam: (
    <>
      <path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />
      <path d="M7.5 14h9" />
    </>
  ),
  ejes: (
    <>
      <path d="M12 12V3M12 12l8 5M12 12l-8 5" />
      <path d="M9.5 5.5L12 3l2.5 2.5M18 14.5l2 2.5-3 .5M6 14.5L4 17l3 .5" />
    </>
  ),
  torno: (
    <>
      <rect x="3" y="8" width="4" height="8" rx="1" />
      <path d="M7 10h10v4H7M17 11h4v2h-4" />
      <path d="M11 10v4M14 10v4" />
    </>
  ),
  aprender: (
    <>
      <path d="M2 9l10-5 10 5-10 5L2 9z" />
      <path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6" />
    </>
  ),
  cotizador: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 13h7M9 17h4" />
    </>
  ),
  calculadora: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8v3H8zM8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01M16 17.5h.01" />
    </>
  ),
  tienda: (
    <>
      <path d="M4 7h16l-1 13H5L4 7z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>
  ),
  gcode: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M10 12l-2 2 2 2M14 12l2 2-2 2" />
    </>
  ),
  escaneo: (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M12 7l4.5 2.5v5L12 17l-4.5-2.5v-5z" />
    </>
  ),
  ia: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M9 10h.01M12 10h.01M15 10h.01" />
    </>
  ),
}

export const ServicioIcono = ({
  nombre,
  size = 24,
  className,
}: {
  nombre: string
  size?: number
  className?: string
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    {TRAZOS[nombre] || TRAZOS.cotizador}
  </svg>
)
