// Iconos del foro con tema CNC (sólidos y gruesos). Usan el color del texto (currentColor),
// así cambian solos entre claro, oscuro y botón activo.

type P = { size?: number; className?: string }

// ÚTIL: engrane (pieza de máquina) con palomita calada
export function IconoUtil({ size = 18, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <mask id="hcnc-util">
        <rect width="24" height="24" fill="white" />
        <path d="M7.6 12.4l3 3 5.8-6.2" fill="none" stroke="black" strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter" />
      </mask>
      <g fill="currentColor" mask="url(#hcnc-util)">
        <circle cx="12" cy="12" r="7.6" />
        <rect x="9.6" y="1.2" width="4.8" height="5" rx="0.8" />
        <rect x="9.6" y="17.8" width="4.8" height="5" rx="0.8" />
        <rect x="1.2" y="9.6" width="5" height="4.8" rx="0.8" />
        <rect x="17.8" y="9.6" width="5" height="4.8" rx="0.8" />
        <rect x="9.6" y="1.2" width="4.8" height="5" rx="0.8" transform="rotate(45 12 12)" />
        <rect x="9.6" y="17.8" width="4.8" height="5" rx="0.8" transform="rotate(45 12 12)" />
        <rect x="1.2" y="9.6" width="5" height="4.8" rx="0.8" transform="rotate(45 12 12)" />
        <rect x="17.8" y="9.6" width="5" height="4.8" rx="0.8" transform="rotate(45 12 12)" />
      </g>
    </svg>
  )
}

// NO ÚTIL: tuerca hexagonal con una X calada
export function IconoNoUtil({ size = 18, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <mask id="hcnc-noutil">
        <rect width="24" height="24" fill="white" />
        <path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" stroke="black" strokeWidth="2.8" strokeLinecap="square" />
      </mask>
      <polygon points="12,1.8 21,6.9 21,17.1 12,22.2 3,17.1 3,6.9" fill="currentColor" mask="url(#hcnc-noutil)" />
    </svg>
  )
}

// COMPARTIR: flecha de trayectoria de herramienta (sale de la pieza y gira)
export function IconoCompartir({ size = 18, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M2.5 21v-5.5a8 8 0 0 1 8-8H15V2.5l7.5 7.6L15 17.7v-5.2h-4.5a3.2 3.2 0 0 0-3.2 3.2V21z" />
    </svg>
  )
}

// RESPONDER: burbuja de mensaje con tres huecos cuadrados (como barrenos)
export function IconoResponder({ size = 18, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <mask id="hcnc-resp">
        <rect width="24" height="24" fill="white" />
        <rect x="5.4" y="8.4" width="3.2" height="3.2" fill="black" />
        <rect x="10.4" y="8.4" width="3.2" height="3.2" fill="black" />
        <rect x="15.4" y="8.4" width="3.2" height="3.2" fill="black" />
      </mask>
      <path fill="currentColor" mask="url(#hcnc-resp)" d="M3 2.5h18a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-8.2L7 22v-4.5H3A1.5 1.5 0 0 1 1.5 16V4A1.5 1.5 0 0 1 3 2.5z" />
    </svg>
  )
}
