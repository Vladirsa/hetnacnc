// Vistas conceptuales del Laboratorio CAM: dibujos simples (SVG, sin peso) de
// lo que hace cada herramienta, para los ejemplos que no tienen captura real.
// Naranja = trayectoria de la fresa; café = material; gris = pestañas y bruto.

const MARCO = "h-auto w-full rounded-[12px] bg-[#F3F1EA]"

// Contorno 2.5D en MDF: pieza con dos barrenos, trayectoria por fuera y por
// dentro, compensada al radio de la fresa, con cuatro pestañas
export const VistaContornoMdf = () => (
  <svg viewBox="0 0 320 200" className={MARCO} role="img" aria-label="Trayectoria de contorno con pestañas sobre una pieza de MDF">
    <rect x="20" y="20" width="280" height="160" rx="4" fill="#E2D2B4" />
    <rect x="70" y="50" width="180" height="100" rx="18" fill="#C9A978" />
    <circle cx="110" cy="100" r="16" fill="#E2D2B4" />
    <circle cx="210" cy="100" r="16" fill="#E2D2B4" />
    <rect x="62" y="42" width="196" height="116" rx="26" fill="none" stroke="#C2560A" strokeWidth="2.5" strokeDasharray="10 5" />
    <circle cx="110" cy="100" r="10" fill="none" stroke="#C2560A" strokeWidth="2.5" />
    <circle cx="210" cy="100" r="10" fill="none" stroke="#C2560A" strokeWidth="2.5" />
    {[
      [156, 38, 8, 8],
      [156, 154, 8, 8],
      [58, 96, 8, 8],
      [254, 96, 8, 8],
    ].map(([x, y, w, h]) => (
      <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill="#6B6A63" />
    ))}
    <text x="24" y="194" fontSize="11" fill="#6B6A63" fontFamily="Arial">Contorno + barrenos · 4 pestañas</text>
  </svg>
)

// Placa de aluminio con barrenos: varias pasadas en profundidad
export const VistaPlacaAluminio = () => (
  <svg viewBox="0 0 320 200" className={MARCO} role="img" aria-label="Pasadas en profundidad sobre una placa de aluminio">
    <polygon points="40,70 200,40 290,80 130,110" fill="#D5DADF" />
    <polygon points="40,70 130,110 130,140 40,100" fill="#B4BCC4" />
    <polygon points="130,110 290,80 290,110 130,140" fill="#9AA4AE" />
    {[0, 9, 18].map((d) => (
      <polygon key={d} points={`58,${74 + d} 196,${48 + d} 270,${82 + d} 132,${108 + d}`} fill="none" stroke="#C2560A" strokeWidth="2" strokeDasharray={d ? "6 4" : undefined} opacity={1 - d / 40} />
    ))}
    {[
      [110, 72],
      [190, 62],
      [200, 88],
    ].map(([x, y]) => (
      <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="9" ry="5" fill="#6B7580" stroke="#C2560A" strokeWidth="1.5" />
    ))}
    <text x="24" y="190" fontSize="11" fill="#6B6A63" fontFamily="Arial">Aluminio 6061 · pasadas según el espesor</text>
  </svg>
)

// Columna en torno (eje rotativo): perfil por tramos y espiral de acabado
export const VistaColumnaTorno = () => (
  <svg viewBox="0 0 320 200" className={MARCO} role="img" aria-label="Columna salomónica en torno con eje rotativo">
    <rect x="16" y="78" width="22" height="44" rx="3" fill="#6B6A63" />
    <rect x="282" y="90" width="26" height="20" rx="3" fill="#6B6A63" />
    <path d="M38 80 H70 L80 70 H96 L104 84 H236 L244 70 H262 L270 80 H282 V120 H270 L262 130 H244 L236 116 H104 L96 130 H80 L70 120 H38 Z" fill="#D8B98A" />
    {Array.from({ length: 11 }, (_, i) => 104 + i * 12).map((x) => (
      <path key={x} d={`M${x} 84 C ${x + 10} 92, ${x - 2} 108, ${x + 8} 116`} fill="none" stroke="#C2560A" strokeWidth="2.2" />
    ))}
    <line x1="10" y1="100" x2="312" y2="100" stroke="#6B6A63" strokeWidth="1" strokeDasharray="4 4" />
    <path d="M160 40 a10 10 0 1 1 -1 0" fill="none" stroke="#142033" strokeWidth="1.5" />
    <text x="176" y="45" fontSize="11" fill="#142033" fontFamily="Arial">eje A</text>
    <text x="24" y="190" fontSize="11" fill="#6B6A63" fontFamily="Arial">Perfil por tramos + espiral salomónica</text>
  </svg>
)
