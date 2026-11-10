// Piezas de interfaz del HETNA Panel (servidor; sin estado)
export const Tarjeta = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`rounded-2xl border border-[#E7E4DC] bg-white p-4 ${className}`}>{children}</section>
)
export const Titulo = ({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-[15px] font-extrabold text-[#142033]">{children}</h2>
    {extra}
  </div>
)
export const Kpi = ({ etiqueta, valor, antes, sufijo }: { etiqueta: string; valor: string; antes?: string; sufijo?: string }) => (
  <div className="rounded-xl bg-[#F8F7F2] p-3">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B675C]">{etiqueta}</p>
    <p className="mt-1 text-[22px] font-black leading-none text-[#142033]">{valor}{sufijo && <span className="text-sm font-semibold text-[#6B675C]"> {sufijo}</span>}</p>
    {antes && <p className="mt-1 text-[11px] text-[#6B675C]">{antes}</p>}
  </div>
)
export const Etiqueta = ({ color, children }: { color: "rojo" | "ambar" | "azul" | "verde" | "gris"; children: React.ReactNode }) => {
  const c = { rojo: "bg-[#FDECEA] text-[#B3261E]", ambar: "bg-[#FFF1E6] text-[#B54708]", azul: "bg-[#E8F0FB] text-[#1D4F8C]", verde: "bg-[#E6F4EC] text-[#0F7A4A]", gris: "bg-[#F3F1EA] text-[#6B675C]" }[color]
  return <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${c}`}>{children}</span>
}
export const Vacio = ({ children }: { children: React.ReactNode }) => <p className="rounded-xl bg-[#F8F7F2] px-4 py-6 text-center text-sm text-[#6B675C]">{children}</p>
export const Pestanas = ({ base, actual, opciones }: { base: string; actual: string; opciones: { clave: string; nombre: string; n?: number }[] }) => (
  <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
    {opciones.map((o) => (
      <a key={o.clave} href={`${base}?f=${o.clave}`} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold ${actual === o.clave ? "border-[#142033] bg-[#142033] text-white" : "border-[#E7E4DC] bg-white text-[#40403A]"}`}>
        {o.nombre}{typeof o.n === "number" ? ` · ${o.n}` : ""}
      </a>
    ))}
  </div>
)
