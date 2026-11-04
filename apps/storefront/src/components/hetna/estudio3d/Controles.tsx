"use client"

// Controles oscuros de los estudios (3D Studio y 2D Studio): campos, botones
// de opción, tarjetas y acciones. Los usan Cajas, Llaveros, Vectorizador y
// las demás herramientas que viven dentro de Estudio3D, para que todas se vean
// y se manejen igual.
import * as THREE from "three"

export const numero = (s: string) => parseFloat((s || "").replace(",", "."))
export const r1 = (x: number) => Math.round(x * 10) / 10

export function descargar(nombre: string, contenido: string | ArrayBuffer | Blob, tipo: string) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Pasa un grupo de three.js (con sus transformaciones) a triángulos sueltos. */
export function grupoATris(grupo: THREE.Object3D): number[] {
  const tris: number[] = []
  grupo.updateMatrixWorld(true)
  const v = new THREE.Vector3()
  grupo.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.geometry) return
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry
    const pos = g.getAttribute("position")
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
      tris.push(v.x, v.y, v.z)
    }
  })
  return tris
}

export const Etiqueta = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[12px] font-bold uppercase tracking-wide text-[#8A97AB]">{children}</span>
)

export const Seccion = ({ titulo, children, nota }: { titulo: string; children: React.ReactNode; nota?: string }) => (
  <div className="flex flex-col gap-1.5">
    <Etiqueta>{titulo}</Etiqueta>
    {children}
    {nota && <span className="text-[11.5px] leading-snug text-[#8A97AB]">{nota}</span>}
  </div>
)

export const CampoNum = ({
  etiqueta,
  valor,
  cambiar,
  sufijo = "mm",
}: {
  etiqueta: string
  valor: string
  cambiar: (v: string) => void
  sufijo?: string
}) => (
  <label className="flex min-w-0 flex-col gap-1">
    {etiqueta && <span className="text-[12.5px] text-[#C9D2E0]">{etiqueta}</span>}
    <span className="flex items-center rounded-[8px] bg-[#1C2431] focus-within:ring-1 focus-within:ring-[#C2560A]">
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        className="w-full min-w-0 bg-transparent px-2.5 py-2 text-[14px] text-white outline-none"
      />
      {sufijo && <span className="pr-2.5 text-[12px] text-[#8A97AB]">{sufijo}</span>}
    </span>
  </label>
)

export const CampoTexto = ({
  valor,
  cambiar,
  max = 40,
  grande = false,
  placeholder,
}: {
  valor: string
  cambiar: (v: string) => void
  max?: number
  grande?: boolean
  placeholder?: string
}) => (
  <input
    value={valor}
    maxLength={max}
    placeholder={placeholder}
    onChange={(e) => cambiar(e.target.value)}
    className={`w-full rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-white outline-none placeholder:text-[#5B6880] focus:ring-1 focus:ring-[#C2560A] ${
      grande ? "text-[16px] font-semibold" : "text-[14px]"
    }`}
  />
)

export function Opciones<T extends string>({
  opciones,
  valor,
  cambiar,
  columnas,
}: {
  opciones: { id: T; nombre: React.ReactNode }[]
  valor: T
  cambiar: (v: T) => void
  columnas?: number
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columnas || opciones.length}, minmax(0, 1fr))` }}>
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => cambiar(o.id)}
          aria-pressed={valor === o.id}
          className={`rounded-[8px] px-1.5 py-2 text-[12px] font-semibold leading-tight transition ${
            valor === o.id ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"
          }`}
        >
          {o.nombre}
        </button>
      ))}
    </div>
  )
}

export const Chips = ({ items, onClick }: { items: { id: string; nombre: string }[]; onClick: (id: string) => void }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.map((i) => (
      <button
        key={i.id}
        type="button"
        onClick={() => onClick(i.id)}
        className="rounded-full bg-[#1C2431] px-2.5 py-1 text-[11.5px] font-semibold text-[#C9D2E0] hover:bg-[#243045] hover:text-white"
      >
        {i.nombre}
      </button>
    ))}
  </div>
)

export const Interruptor = ({ etiqueta, activo, cambiar }: { etiqueta: string; activo: boolean; cambiar: (v: boolean) => void }) => (
  <button type="button" onClick={() => cambiar(!activo)} aria-pressed={activo} className="flex items-center justify-between gap-3 text-left">
    <span className="text-[13.5px] text-[#E6EBF2]">{etiqueta}</span>
    <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${activo ? "bg-[#C2560A]" : "bg-[#2B3648]"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${activo ? "left-[18px]" : "left-0.5"}`} />
    </span>
  </button>
)

export const Destacado = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2 rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-3">
    <span className="text-[13px] font-bold text-white">{titulo}</span>
    {children}
  </div>
)

export const Datos = ({ filas }: { filas: [string, string][] }) => (
  <dl className="m-0 grid grid-cols-2 gap-2">
    {filas.map(([t, v]) => (
      <div key={t} className="rounded-[10px] bg-[#1C2431] px-3 py-2">
        <dt className="text-[11px] text-[#8A97AB]">{t}</dt>
        <dd className="m-0 text-[13px] font-semibold text-white">{v}</dd>
      </div>
    ))}
  </dl>
)

export const Aviso = ({ tipo = "info", children }: { tipo?: "info" | "error" | "ok"; children: React.ReactNode }) => (
  <div
    className={`rounded-[10px] px-3 py-2 text-[12.5px] leading-snug ${
      tipo === "error"
        ? "bg-[#3A1C1C] text-[#F6B8AE]"
        : tipo === "ok"
          ? "bg-[#12301F] text-[#9BE3B8]"
          : "bg-[#2E2717] text-[#F2D29B]"
    }`}
  >
    {children}
  </div>
)

export const TarjetaExport = ({
  titulo,
  nota,
  children,
}: {
  titulo: string
  nota?: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-2 rounded-[12px] border border-[#2B3648] bg-[#1C2431] p-4">
    <span className="text-[15px] font-bold text-white">{titulo}</span>
    {nota && <span className="text-[12.5px] text-[#8A97AB]">{nota}</span>}
    {children}
  </div>
)

export const Boton = ({
  onClick,
  children,
  tipo = "secundario",
  href,
}: {
  onClick?: () => void
  children: React.ReactNode
  tipo?: "primario" | "secundario" | "verde"
  href?: string
}) => {
  const clase = `flex-1 rounded-[8px] px-4 py-2 text-center text-[13px] font-semibold text-white ${
    tipo === "primario"
      ? "bg-[#C2560A] hover:bg-[#A84A08]"
      : tipo === "verde"
        ? "bg-[#16794F] hover:bg-[#12623F]"
        : "bg-[#2B3648] hover:bg-[#344158]"
  }`
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={clase}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={clase}>
      {children}
    </button>
  )
}

/** SVG claro de las herramientas viejas → colores del estudio oscuro. */
export const svgOscuro = (svg: string) =>
  svg
    .replace(/fill="#(?:fff|FFF|ffffff|FFFFFF|FAF9F6|F4F1EA|F7F3EE)"/g, 'fill="#151C27"')
    .replace(/stroke="#(?:000|000000|142033|1B1B18)"/g, 'stroke="#FF7A2E"')
