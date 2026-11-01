// Iconos de línea de "Mi cuenta" (mismo trazo que el resto del sitio).
const TRAZOS = {
  resumen: "M3 12l9-8 9 8M5 10v10h14V10",
  pedidos: "M6 7h12l1 13H5L6 7zm3 0a3 3 0 0 1 6 0",
  envios: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0 .01M17 18.5a1.5 1.5 0 1 0 0 .01",
  descargas: "M12 4v11M7 10l5 5 5-5M5 20h14",
  favoritos: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  devoluciones: "M9 14l-4-4 4-4M5 10h10a4 4 0 0 1 0 8h-3",
  cam: "M4 20h16M6 16l4-10 4 6 2-3 2 7",
  creditos: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v10M9 9.5c0-1 1.3-1.8 3-1.8s3 .8 3 1.8-1.3 1.6-3 2-3 1-3 2 1.3 1.8 3 1.8 3-.8 3-1.8",
  taller: "M3 21V9l9-6 9 6v12M9 21v-6h6v6",
  tienda: "M3 9l1.5-5h15L21 9M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9zM9 20v-6h6v6",
  cotizador: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01",
  escaneos: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M12 8l4 2v4l-4 2-4-2v-4l4-2z",
  mensajes: "M4 5h16v11H8l-4 4V5z",
  siguiendo: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6",
  foro: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8M8 13h5",
  perfil: "M4 5h16v14H4zM8 11a2 2 0 1 0 0-.01M6 16c.5-1.5 1.5-2 2-2s1.5.5 2 2M13 9h5M13 13h5",
  seguridad: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  direcciones: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12a2 2 0 1 0 0-.01",
  comunicaciones: "M4 6h16v12H4zM4 7l8 6 8-6",
  privacidad: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z",
  ayuda: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.01",
  salir: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  regalo: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1-3-5-3-5 0 0 1 2 1 5 0M12 7c1-3 5-3 5 0 0 1-2 1-5 0",
} as const

export type NombreIcono = keyof typeof TRAZOS

export const IconoCuenta = ({ n, size = 22 }: { n: NombreIcono; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={TRAZOS[n]} />
  </svg>
)
