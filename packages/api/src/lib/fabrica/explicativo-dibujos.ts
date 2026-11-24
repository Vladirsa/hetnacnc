// Biblioteca de dibujos técnicos para los videos explicativos de HETNA.
// Estilo: línea blanca gruesa sobre azul marino, acentos naranjas, rojo para el
// error y verde para lo correcto. Todos miden 952 x 440 (el ancho de la tarjeta).
// La IA sólo elige el nombre del dibujo; nunca escribe SVG.

const B = "#FFFFFF"
const N = "#FF8A2B"
const R = "#FF5A4E"
const V = "#3EE07A"
const G = "rgba(255,255,255,.14)"

const svg = (cuerpo: string) => `<svg width="952" height="440" viewBox="0 0 952 440" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`

/** Chispas pequeñas alrededor de un punto. */
const chispas = (x: number, y: number, c = N) =>
  [[-60, -30], [-40, -60], [40, -55], [65, -25], [-75, 10], [78, 12]].map(([dx, dy]) => `<path d="M${x + dx * 0.35} ${y + dy * 0.35} L${x + dx} ${y + dy}" stroke="${c}" stroke-width="6"/>`).join("")

export const DIBUJOS: Record<string, { nombre: string; svg: string }> = {
  laser: {
    nombre: "Cabezal láser cortando una lámina",
    svg: svg(`
      <rect x="386" y="20" width="180" height="120" rx="18" stroke="${B}" stroke-width="8"/>
      <path d="M416 60 H536 M416 92 H500" stroke="${G}" stroke-width="8"/>
      <path d="M426 140 L526 140 L500 214 L452 214 Z" stroke="${B}" stroke-width="8"/>
      <path d="M476 214 L476 330" stroke="${N}" stroke-width="10"/>
      <path d="M476 214 L476 330" stroke="#FFD2A8" stroke-width="3"/>
      <path d="M150 330 H802 L770 380 H182 Z" stroke="${B}" stroke-width="8"/>
      <path d="M476 330 L476 380" stroke="${N}" stroke-width="5" stroke-dasharray="8 8"/>
      ${chispas(476, 330)}
      <path d="M200 355 H420" stroke="${G}" stroke-width="6" stroke-dasharray="18 14"/>`),
  },
  boquilla: {
    nombre: "Boquilla del láser y punto de foco",
    svg: svg(`
      <path d="M376 30 H576 V110 H376 Z" stroke="${B}" stroke-width="8"/>
      <path d="M396 110 L556 110 L506 250 L446 250 Z" stroke="${B}" stroke-width="8"/>
      <path d="M436 120 L476 300 L516 120" stroke="${N}" stroke-width="5" stroke-dasharray="10 8"/>
      <circle cx="476" cy="300" r="14" fill="${N}"/>
      <path d="M200 300 H752" stroke="${B}" stroke-width="8"/>
      <path d="M150 340 H802" stroke="${G}" stroke-width="8"/>
      <path d="M610 300 H720" stroke="${N}" stroke-width="5"/>
      <path d="M720 286 V314" stroke="${N}" stroke-width="5"/>
      <circle cx="476" cy="300" r="40" stroke="${N}" stroke-width="4" stroke-dasharray="6 8"/>`),
  },
  router: {
    nombre: "Router CNC: husillo y fresa cortando madera",
    svg: svg(`
      <rect x="406" y="10" width="140" height="150" rx="22" stroke="${B}" stroke-width="8"/>
      <path d="M426 50 H526 M426 80 H526 M426 110 H526" stroke="${G}" stroke-width="7"/>
      <path d="M436 160 H516 L506 200 H446 Z" stroke="${B}" stroke-width="8"/>
      <path d="M462 200 H490 V300 H462 Z" stroke="${N}" stroke-width="7"/>
      <path d="M462 222 L490 240 M462 248 L490 266 M462 274 L490 292" stroke="${N}" stroke-width="5"/>
      <path d="M140 300 H812 V380 H140 Z" stroke="${B}" stroke-width="8"/>
      <path d="M170 330 C 260 316, 330 344, 420 328 M540 336 C 620 320, 700 348, 790 332" stroke="${G}" stroke-width="5"/>
      <path d="M476 300 L476 318" stroke="${B}" stroke-width="6"/>
      <path d="M520 296 l20 -18 M540 304 l26 -8 M432 296 l-20 -18" stroke="#E8C79A" stroke-width="6"/>`),
  },
  fresa: {
    nombre: "Fresa (cortador) vista de cerca, con sus filos",
    svg: svg(`
      <rect x="270" y="170" width="280" height="100" rx="14" stroke="${B}" stroke-width="8"/>
      <path d="M550 180 L760 180 Q790 220 760 260 L550 260" stroke="${N}" stroke-width="8"/>
      <path d="M590 180 Q620 220 600 260 M640 180 Q670 220 650 260 M690 180 Q720 220 700 260" stroke="${N}" stroke-width="6"/>
      <path d="M300 200 H520 M300 240 H520" stroke="${G}" stroke-width="6"/>
      <path d="M790 220 H860" stroke="${N}" stroke-width="5" stroke-dasharray="8 8"/>
      <path d="M560 110 H760" stroke="${B}" stroke-width="4"/>
      <path d="M560 96 V124 M760 96 V124" stroke="${B}" stroke-width="4"/>
      <text x="660" y="86" fill="${B}" font-family="JBM" font-size="30" text-anchor="middle" stroke="none">FILOS</text>`),
  },
  plasma: {
    nombre: "Antorcha de plasma cortando acero",
    svg: svg(`
      <path d="M436 10 H516 V140 H436 Z" stroke="${B}" stroke-width="8"/>
      <path d="M426 140 H526 L506 220 H446 Z" stroke="${B}" stroke-width="8"/>
      <path d="M476 220 L466 260 L486 280 L470 320" stroke="#7FD4FF" stroke-width="10"/>
      <path d="M476 220 L466 260 L486 280 L470 320" stroke="${B}" stroke-width="3"/>
      <path d="M150 320 H802 V372 H150 Z" stroke="${B}" stroke-width="8"/>
      <path d="M470 372 C 460 400, 490 410, 476 436" stroke="${N}" stroke-width="7"/>
      ${chispas(470, 320, "#7FD4FF")}
      <path d="M180 346 H430" stroke="${G}" stroke-width="7" stroke-dasharray="20 14"/>`),
  },
  impresora3d: {
    nombre: "Impresora 3D imprimiendo una pieza",
    svg: svg(`
      <path d="M250 20 V420 M702 20 V420 M250 20 H702" stroke="${B}" stroke-width="8"/>
      <path d="M250 110 H702" stroke="${G}" stroke-width="8"/>
      <rect x="430" y="90" width="92" height="70" rx="10" stroke="${B}" stroke-width="7"/>
      <path d="M462 160 L476 190 L490 160" stroke="${N}" stroke-width="7"/>
      <path d="M300 380 H652" stroke="${B}" stroke-width="10"/>
      <path d="M390 380 V270 Q476 210 562 270 V380" stroke="${N}" stroke-width="7"/>
      <path d="M390 350 H562 M390 320 H562 M392 290 H560" stroke="${N}" stroke-width="3" opacity=".7"/>
      <path d="M476 190 V214" stroke="${N}" stroke-width="5" stroke-dasharray="6 6"/>`),
  },
  calibrador: {
    nombre: "Calibrador (vernier) midiendo una pieza",
    svg: svg(`
      <path d="M110 150 H842 V210 H110 Z" stroke="${B}" stroke-width="8"/>
      ${Array.from({ length: 30 }, (_, i) => `<path d="M${150 + i * 22} 150 V${i % 5 === 0 ? 182 : 168}" stroke="${B}" stroke-width="3"/>`).join("")}
      <path d="M150 210 V360 L210 360 L210 210" stroke="${B}" stroke-width="8"/>
      <path d="M520 120 H680 V250 H520 Z" stroke="${N}" stroke-width="8"/>
      <path d="M520 250 V360 L580 360 L580 250" stroke="${N}" stroke-width="8"/>
      <rect x="216" y="280" width="298" height="70" rx="10" stroke="${B}" stroke-width="6" fill="rgba(255,255,255,.06)"/>
      <path d="M232 400 H498" stroke="${N}" stroke-width="4"/>
      <path d="M232 386 V414 M498 386 V414" stroke="${N}" stroke-width="4"/>`),
  },
  lamina: {
    nombre: "Lámina con piezas acomodadas para cortar",
    svg: svg(`
      <path d="M140 40 H812 V400 H140 Z" stroke="${B}" stroke-width="8"/>
      <rect x="180" y="80" width="200" height="130" rx="16" stroke="${N}" stroke-width="6"/>
      <circle cx="500" cy="145" r="66" stroke="${N}" stroke-width="6"/>
      <path d="M620 80 L770 80 L770 210 Z" stroke="${N}" stroke-width="6"/>
      <rect x="180" y="250" width="130" height="110" rx="12" stroke="${N}" stroke-width="6"/>
      <path d="M350 250 H560 V360 H350 Z M410 290 h90 v30 h-90 z" stroke="${N}" stroke-width="6"/>
      <circle cx="680" cy="305" r="52" stroke="${N}" stroke-width="6"/><circle cx="680" cy="305" r="18" stroke="${N}" stroke-width="5"/>`),
  },
  mdf: {
    nombre: "Tablero de MDF con orilla quemada vs. limpia",
    svg: svg(`
      <path d="M150 120 L640 120 L802 200 L312 200 Z" stroke="${B}" stroke-width="8"/>
      <path d="M150 120 V220 L312 300 V200 M312 300 H802 V200" stroke="${B}" stroke-width="8"/>
      <path d="M150 220 L312 300" stroke="#8A5A2B" stroke-width="14" opacity=".9"/>
      <path d="M312 300 H560" stroke="#3A2414" stroke-width="16"/>
      <path d="M560 300 H802" stroke="#E8C79A" stroke-width="16"/>
      <path d="M200 160 H600 M260 180 H700" stroke="${G}" stroke-width="5"/>
      <circle cx="436" cy="350" r="16" fill="${R}"/><circle cx="680" cy="350" r="16" fill="${V}"/>`),
  },
  archivo: {
    nombre: "Archivo de diseño (DXF) con su contorno",
    svg: svg(`
      <path d="M326 10 H570 L626 66 V430 H326 Z" stroke="${B}" stroke-width="8" fill="#F3F1EA"/>
      <path d="M570 10 V66 H626" stroke="#C9C4B6" stroke-width="6"/>
      <path d="M366 60 H520 M366 92 H470" stroke="#C9C4B6" stroke-width="12"/>
      <path d="M382 150 H560 Q586 150 586 176 V300 Q586 326 560 326 H408 Q382 326 382 300 Z" stroke="#142033" stroke-width="7"/>
      <text x="476" y="396" fill="#142033" font-family="JBM" font-size="34" text-anchor="middle" stroke="none">pieza.dxf</text>`),
  },
  contorno_abierto: {
    nombre: "Contorno que no cierra (hueco marcado)",
    svg: svg(`
      <path d="M230 60 L690 60" stroke="${B}" stroke-width="8"/>
      <path d="M722 60 Q802 60 802 140 L802 330 Q802 410 722 410 L230 410 Q150 410 150 330 L150 140 Q150 60 230 60" stroke="${B}" stroke-width="8"/>
      <circle cx="706" cy="60" r="56" stroke="${R}" stroke-width="6" stroke-dasharray="14 10"/>`),
  },
  lineas_dobles: {
    nombre: "Líneas dibujadas dos veces (encimadas)",
    svg: svg(`
      <path d="M110 240 L840 240" stroke="${B}" stroke-width="10"/>
      <path d="M110 214 L840 214" stroke="${N}" stroke-width="10" stroke-dasharray="26 16"/>
      <rect x="690" y="80" width="150" height="84" rx="18" fill="${R}" stroke="none"/>
      <text x="765" y="138" fill="#fff" font-family="ArchivoN" font-size="48" text-anchor="middle" stroke="none">×2</text>`),
  },
  texto_curvas: {
    nombre: "Texto convertido a curvas (con nodos)",
    svg: svg(`
      <text x="300" y="320" font-family="Georgia, serif" font-weight="900" font-size="230" text-anchor="middle" fill="${B}" stroke="none">Aa</text>
      <path d="M470 220 H540 M520 196 L548 220 L520 244" stroke="${N}" stroke-width="8"/>
      <text x="720" y="320" font-family="Georgia, serif" font-weight="900" font-size="230" text-anchor="middle" stroke="${V}" stroke-width="5">Aa</text>
      <circle cx="606" cy="316" r="9" fill="${B}" stroke="none"/><circle cx="676" cy="140" r="9" fill="${B}" stroke="none"/><circle cx="740" cy="316" r="9" fill="${B}" stroke="none"/><circle cx="842" cy="214" r="9" fill="${B}" stroke="none"/>`),
  },
  engrane: {
    nombre: "Engrane (pieza mecánica)",
    svg: svg(`
      <g transform="translate(476 220)">
        ${Array.from({ length: 12 }, (_, i) => `<rect x="-22" y="-190" width="44" height="60" rx="8" transform="rotate(${i * 30})" stroke="${B}" stroke-width="7"/>`).join("")}
        <circle r="140" stroke="${B}" stroke-width="8" fill="#13203A"/>
        <circle r="54" stroke="${N}" stroke-width="8"/>
        <path d="M-12 -54 H12 V-74 H-12 Z" stroke="${N}" stroke-width="6"/>
      </g>`),
  },
  reloj: {
    nombre: "Reloj: tiempo de máquina",
    svg: svg(`
      <circle cx="476" cy="230" r="170" stroke="${B}" stroke-width="10"/>
      ${Array.from({ length: 12 }, (_, i) => `<path d="M476 ${74} V${i % 3 === 0 ? 104 : 92}" transform="rotate(${i * 30} 476 230)" stroke="${B}" stroke-width="6"/>`).join("")}
      <path d="M476 230 V130" stroke="${B}" stroke-width="10"/>
      <path d="M476 230 L560 270" stroke="${N}" stroke-width="10"/>
      <circle cx="476" cy="230" r="14" fill="${N}" stroke="none"/>
      <path d="M440 40 H512 M476 40 V58" stroke="${B}" stroke-width="10"/>`),
  },
  material_grosor: {
    nombre: "Placas de distinto grosor",
    svg: svg(`
      <path d="M170 110 H782 V136 H170 Z" stroke="${B}" stroke-width="7"/>
      <path d="M170 196 H782 V250 H170 Z" stroke="${B}" stroke-width="7"/>
      <path d="M170 310 H782 V400 H170 Z" stroke="${N}" stroke-width="8"/>
      <path d="M830 110 V136 M830 196 V250 M830 310 V400" stroke="${N}" stroke-width="6"/>
      <path d="M816 110 H844 M816 136 H844 M816 196 H844 M816 250 H844 M816 310 H844 M816 400 H844" stroke="${N}" stroke-width="4"/>`),
  },
}

export const IDS_DIBUJO = Object.keys(DIBUJOS)

// Íconos chicos (en lugar de emojis, que el servidor no siempre tiene)
export const ICONO = {
  ok: `<svg width="56" height="56" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#22B35E"/><path d="M28 52 L44 67 L73 36" stroke="#fff" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  mal: `<svg width="56" height="56" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#D9372B"/><path d="M33 33 L67 67 M67 33 L33 67" stroke="#fff" stroke-width="11" stroke-linecap="round"/></svg>`,
  punto: `<svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="11" fill="${N}"/></svg>`,
  guardar: `<svg width="64" height="64" viewBox="0 0 100 100"><path d="M26 12 H74 V90 L50 72 L26 90 Z" fill="#fff"/></svg>`,
}
