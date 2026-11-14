"use client"



import type { Propuesta } from "@/lib/cotizar/solicitud-taller"

// Comparación lado a lado: una columna por taller y una fila por dato. En cada fila
// con un "mejor" claro (precio, días, cumplimiento…) esa celda se marca en verde.

const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type Fila = {
  etiqueta: string
  ayuda?: string
  valor: (p: Propuesta) => string | React.JSX.Element
  /** Número para comparar; null = sin dato. Con `mejor` se marca la celda ganadora. */
  num?: (p: Propuesta) => number | null
  mejor?: "menor" | "mayor"
}

const FILAS: Fila[] = [
  { etiqueta: "Precio total", valor: (p) => <b>{pesos(p.precio)} <span className="text-xs font-normal text-[#6B675C]">{p.moneda || "MXN"}</span></b>, num: (p) => p.precio, mejor: "menor" },
  { etiqueta: "Entrega", valor: (p) => `${p.dias} ${p.dias === 1 ? "día" : "días"}`, num: (p) => p.dias, mejor: "menor" },
  { etiqueta: "Fecha de entrega", valor: (p) => (p.fecha_entrega ? new Date(`${p.fecha_entrega}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "—") },
  { etiqueta: "Envío", valor: (p) => (p.incluye_envio ? "Incluido" : "Aparte"), num: (p) => (p.incluye_envio ? 1 : 0), mejor: "mayor" },
  { etiqueta: "Pago", valor: (p) => (p.anticipo_pct ? `${p.anticipo_pct}% de anticipo` : "Pago completo") },
  { etiqueta: "Garantía", valor: (p) => p.garantia || "—" },
  {
    etiqueta: "Cumplimiento HETNA",
    ayuda: "Puntaje con datos reales: entregas a tiempo, calidad, trabajos terminados y reclamos resueltos (desde 3 trabajos).",
    valor: (p) => (p.taller.medido?.suficiente && p.taller.medido.puntaje != null ? `${p.taller.medido.puntaje}/100` : "Historial corto"),
    num: (p) => (p.taller.medido?.suficiente ? p.taller.medido.puntaje ?? null : null),
    mejor: "mayor",
  },
  {
    etiqueta: "Entregas a tiempo",
    valor: (p) => (p.taller.medido?.puntualidad_pct != null ? `${p.taller.medido.puntualidad_pct}%` : "—"),
    num: (p) => p.taller.medido?.puntualidad_pct ?? null,
    mejor: "mayor",
  },
  { etiqueta: "Trabajos terminados", valor: (p) => `${p.taller.medido?.terminados ?? 0}`, num: (p) => p.taller.medido?.terminados ?? 0, mejor: "mayor" },
  {
    etiqueta: "Reclamos",
    valor: (p) => (p.taller.medido?.reclamos ? `${p.taller.medido.reclamos_resueltos} de ${p.taller.medido.reclamos} resueltos` : "Sin reclamos"),
  },
  {
    etiqueta: "Calificación",
    valor: (p) => (p.taller.calificacion ? `★ ${Number(p.taller.calificacion).toFixed(1)} (${p.taller.resenas || 0})` : "Sin reseñas"),
    num: (p) => (p.taller.calificacion ? Number(p.taller.calificacion) : null),
    mejor: "mayor",
  },
  { etiqueta: "Verificado por HETNA", valor: (p) => (p.taller.verificado ? "✓ Sí" : "—"), num: (p) => (p.taller.verificado ? 1 : 0), mejor: "mayor" },
  {
    etiqueta: "Capacidad",
    ayuda: "Máquinas que el taller declaró en su perfil y su área de trabajo más grande.",
    valor: (p) =>
      p.taller.capacidad ? (
        <span>
          {p.taller.capacidad.resumen}
          {p.taller.capacidad.area_mayor && <span className="block text-xs text-[#6B675C]">Área mayor {p.taller.capacidad.area_mayor}</span>}
        </span>
      ) : (
        "No declarada"
      ),
  },
  { etiqueta: "Materiales", valor: (p) => <span className="line-clamp-3">{p.materiales || "—"}</span> },
  { etiqueta: "Proceso", valor: (p) => <span className="line-clamp-3">{p.operaciones || "—"}</span> },
  { etiqueta: "Archivos", valor: (p) => (p.adjuntos?.length ? `${p.adjuntos.length} adjunto${p.adjuntos.length === 1 ? "" : "s"}` : "—") },
]

export default function TablaPropuestas({
  propuestas,
  faltan,
  elegida,
  abierta,
  onElegir,
}: {
  propuestas: Propuesta[]
  /** Lo que le falta a cada propuesta (de la comparación del servidor) */
  faltan: Map<string, string[]>
  elegida?: string | null
  abierta: boolean
  onElegir: (p: Propuesta) => void
}) {
  // Celda ganadora de cada fila (si no empatan todos)
  const ganadores = FILAS.map((f) => {
    if (!f.num || !f.mejor) return new Set<string>()
    const vals = propuestas.map((p) => ({ id: p.id, v: f.num!(p) })).filter((x) => x.v != null) as { id: string; v: number }[]
    if (vals.length < 2) return new Set<string>()
    const mejor = f.mejor === "menor" ? Math.min(...vals.map((x) => x.v)) : Math.max(...vals.map((x) => x.v))
    const gan = vals.filter((x) => x.v === mejor)
    return gan.length === vals.length ? new Set<string>() : new Set(gan.map((x) => x.id))
  })

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-[#E7E4DC] bg-white">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-[#142033] text-left text-white">
            <th className="sticky left-0 z-10 w-40 bg-[#142033] p-3 font-semibold">Comparar</th>
            {propuestas.map((p) => (
              <th key={p.id} className="min-w-[170px] p-3 align-top font-semibold">
                <span className="block">{p.taller.nombre}</span>
                <span className="block text-xs font-normal text-white/70">{p.taller.estado || "México"}</span>
                {elegida === p.id && <span className="mt-1 inline-block rounded-full bg-[#E6F4EA] px-2 py-0.5 text-xs font-bold text-[#1E7B3A]">Elegida</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FILAS.map((f, i) => (
            <tr key={f.etiqueta} className={i % 2 ? "bg-[#FAF9F6]" : "bg-white"}>
              <th scope="row" className={`sticky left-0 z-10 p-3 text-left align-top font-semibold text-[#142033] ${i % 2 ? "bg-[#FAF9F6]" : "bg-white"}`} title={f.ayuda}>
                {f.etiqueta}
                {f.ayuda && <span className="ml-1 cursor-help text-xs text-[#8A867B]">ⓘ</span>}
              </th>
              {propuestas.map((p) => {
                const gana = ganadores[i].has(p.id)
                return (
                  <td key={p.id} className={`p-3 align-top text-[#40403A] ${gana ? "bg-[#E6F4EA] font-semibold text-[#1E7B3A]" : ""}`}>
                    {f.valor(p)}
                    {gana && <span className="ml-1 text-xs">✓ mejor</span>}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="bg-[#FFF8EE]">
            <th scope="row" className="sticky left-0 z-10 bg-[#FFF8EE] p-3 text-left align-top font-semibold text-[#8A5A00]">Pregúntale antes</th>
            {propuestas.map((p) => (
              <td key={p.id} className="p-3 align-top text-xs text-[#8A5A00]">
                {faltan.get(p.id)?.length ? faltan.get(p.id)!.join(" · ") : "Nada pendiente"}
              </td>
            ))}
          </tr>
          {abierta && (
            <tr>
              <th scope="row" className="sticky left-0 z-10 bg-white p-3" />
              {propuestas.map((p) => (
                <td key={p.id} className="p-3">
                  <button type="button" onClick={() => onElegir(p)} className="w-full rounded-xl bg-[#C2560A] px-3 py-2 font-semibold text-white hover:brightness-110">
                    Elegir
                  </button>
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
