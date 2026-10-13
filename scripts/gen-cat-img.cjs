// Genera las imágenes de categorías (navy/naranja HETNA) con sharp.
// Uso: cd apps/storefront && node ../../scripts/gen-cat-img.cjs
const sharp = require("sharp")
const path = require("path")
const OUT = path.join(process.cwd(), "public/images/categories")
const N = "#142033", O = "#C2560A", L = "#F2A25F", C = "#F3F1EA"
const grid = Array.from({ length: 16 }, (_, i) =>
  `<line x1="${i * 25}" y1="0" x2="${i * 25}" y2="400" stroke="#1C2B42"/><line x1="0" y1="${i * 25}" x2="400" y2="${i * 25}" stroke="#1C2B42"/>`).join("")
const label = (t) => {
  const w = t.length * 21 + 36
  return `<rect x="${200 - w / 2}" y="322" width="${w}" height="46" rx="12" fill="${O}"/><text x="200" y="356" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="28" fill="#fff" text-anchor="middle">${t}</text>`
}
const gear = () => {
  const pts = []
  for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? 92 : 115; pts.push(`${200 + r * Math.cos(a)},${175 + r * Math.sin(a)}`) }
  return `<polygon points="${pts.join(" ")}" fill="${C}"/><circle cx="200" cy="175" r="45" fill="${N}"/><circle cx="200" cy="175" r="20" fill="${O}"/>`
}
const mill = () => {
  let s = `<rect x="175" y="50" width="50" height="100" fill="${C}"/><rect x="165" y="40" width="70" height="15" fill="${O}"/>`
  for (let i = 0; i < 6; i++) { const y = 150 + i * 25; s += `<polygon points="175,${y} 225,${y + 12} 225,${y + 25} 175,${y + 13}" fill="${L}"/>` }
  return s + `<polygon points="175,300 225,300 200,310" fill="${L}"/>`
}
const file = () => `<polygon points="130,50 240,50 280,90 280,300 130,300" fill="${C}"/><polygon points="240,50 240,90 280,90" fill="${L}"/>
<text x="150" y="150" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="44" fill="${N}">DXF</text>
<circle cx="205" cy="235" r="45" fill="none" stroke="${O}" stroke-width="6"/><line x1="150" y1="235" x2="260" y2="235" stroke="${O}" stroke-width="4"/><line x1="205" y1="180" x2="205" y2="290" stroke="${O}" stroke-width="4"/>`
const shop = () => {
  let s = `<rect x="110" y="150" width="180" height="140" fill="${C}"/>`
  for (let i = 0; i < 6; i++) s += `<rect x="${90 + i * 37}" y="90" width="37" height="60" fill="${i % 2 ? L : O}"/>`
  return s + `<rect x="175" y="210" width="50" height="80" fill="${N}"/>`
}
const IMGS = { tienda: [mill, "TIENDA"], digital: [file, "DIGITAL"], servicios: [gear, "SERVICIOS"], marketplace: [shop, "MARKETPLACE"] }
;(async () => {
  for (const [h, [draw, t]] of Object.entries(IMGS)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${N}"/>${grid}${draw()}${label(t)}</svg>`
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${h}.png`))
    console.log("ok", h)
  }
})().catch((e) => { console.error("ERROR", e.message); process.exit(1) })
