"use client"

import { T } from "@/components/hetna/i18n/Idioma"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { crearSolicitudEscanear, type NuevaSolicitud } from "@/lib/escanear/acciones"

const campo = "w-full rounded-[10px] border border-[#D9D5CC] bg-white px-3 py-2.5 text-[15px] text-[#1B1B18] outline-none focus:border-[#C2560A]"
const etiqueta = "mb-1 block text-[13px] font-semibold text-[#1B1B18]"

// Formulario de Escanear: qué pieza es, qué le pasó, para qué se necesita y 2–3
// medidas tomadas a mano (con ellas se comprueba la escala del escaneo).
export function NuevaSolicitudEscanear({ locale }: { locale: string }) {
  const router = useRouter()
  const [d, setD] = useState<NuevaSolicitud>({ titulo: "", descripcion: "", uso: "precision", salida: "reposicion", material_original: "", material_deseado: "", medidas: [{ nombre: "", mm: 0 }, { nombre: "", mm: 0 }], zona: "" })
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const set = (k: keyof NuevaSolicitud, v: unknown) => setD((x) => ({ ...x, [k]: v }))
  const medida = (i: number, k: "nombre" | "mm", v: string) =>
    setD((x) => ({ ...x, medidas: x.medidas.map((m, j) => (j === i ? { ...m, [k]: k === "mm" ? Number(v.replace(",", ".")) || 0 : v } : m)) }))

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const medidas = d.medidas.filter((m) => m.nombre.trim() && m.mm > 0)
    if (medidas.length < 2) return setError("Pon al menos 2 medidas tomadas a mano (por ejemplo: largo total 182 mm, diámetro del barreno 8 mm).")
    setEnviando(true)
    const r = await crearSolicitudEscanear({ ...d, medidas })
    setEnviando(false)
    if (!r.ok) return setError(r.mensaje)
    router.push(`/${locale}/user/escanear/${r.datos.id}`)
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-[14px] border border-[#E7E4DC] bg-white p-5">
      <h2 className="m-0 text-[19px] font-bold text-[#0E2A5C]"><T>Nueva solicitud</T></h2>
      <div>
        <label className={etiqueta} htmlFor="esc-titulo"><T>¿Qué pieza es?</T></label>
        <input id="esc-titulo" className={campo} maxLength={120} required value={d.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ej. Engrane de la banda transportadora, pata de silla, tablero del buró" />
      </div>
      <div>
        <label className={etiqueta} htmlFor="esc-desc"><T>¿Qué le pasó y qué se necesita?</T></label>
        <textarea id="esc-desc" className={`${campo} min-h-[110px]`} maxLength={3000} required value={d.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Se quebró un diente; la máquina está parada. Hay una gemela sana del otro lado. Se usa a 60 °C." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={etiqueta} htmlFor="esc-uso"><T>Tipo de pieza</T></label>
          <select id="esc-uso" className={campo} value={d.uso} onChange={(e) => set("uso", e.target.value)}>
            <option value="precision">Precisión de ingeniería</option>
            <option value="mueble">Mueble o madera</option>
            <option value="repuesto">Repuesto común</option>
          </select>
        </div>
        <div>
          <label className={etiqueta} htmlFor="esc-salida"><T>Para qué se necesita</T></label>
          <select id="esc-salida" className={campo} value={d.salida} onChange={(e) => set("salida", e.target.value)}>
            <option value="reposicion">Reponer la pieza igual</option>
            <option value="adaptacion">Adaptarla o mejorarla</option>
            <option value="molde">Hacer un molde</option>
          </select>
        </div>
        <div>
          <label className={etiqueta} htmlFor="esc-mo"><T>Material original</T></label>
          <input id="esc-mo" className={campo} maxLength={120} value={d.material_original} onChange={(e) => set("material_original", e.target.value)} placeholder="Ej. nylon, aluminio, pino, MDF" />
        </div>
        <div>
          <label className={etiqueta} htmlFor="esc-md"><T>Material deseado</T></label>
          <input id="esc-md" className={campo} maxLength={120} value={d.material_deseado} onChange={(e) => set("material_deseado", e.target.value)} placeholder="Ej. el mismo, PETG, acero 1018" />
        </div>
      </div>
      <div>
        <span className={etiqueta}><T>Medidas tomadas a mano (mínimo 2)</T></span>
        <p className="m-0 mb-2 text-[13px] text-[#6B6A63]"><T>Con estas medidas se comprueba la escala y la precisión del escaneo. Usa vernier o flexómetro.</T></p>
        <div className="flex flex-col gap-2">
          {d.medidas.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label={`Medida ${i + 1}: qué se midió`} className={campo} maxLength={60} value={m.nombre} onChange={(e) => medida(i, "nombre", e.target.value)} placeholder={["Largo total", "Diámetro del barreno", "Espesor"][i] || "Qué se midió"} />
              <input aria-label={`Medida ${i + 1} en milímetros`} className={`${campo} max-w-[140px]`} inputMode="decimal" value={m.mm || ""} onChange={(e) => medida(i, "mm", e.target.value)} placeholder="mm" />
            </div>
          ))}
        </div>
        {d.medidas.length < 6 && (
          <button type="button" className="mt-2 text-[13px] font-semibold text-[#B34D07] underline" onClick={() => set("medidas", [...d.medidas, { nombre: "", mm: 0 }])}>
            <T>+ Agregar otra medida</T>
          </button>
        )}
      </div>
      <div>
        <label className={etiqueta} htmlFor="esc-zona"><T>Zona que importa (opcional)</T></label>
        <input id="esc-zona" className={campo} maxLength={500} value={d.zona} onChange={(e) => set("zona", e.target.value)} placeholder="Si escaneaste un conjunto: ej. solo el tablero superior del mueble" />
      </div>
      {error && <p className="m-0 rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[14px] text-[#9B1C1C]">{error}</p>}
      <button type="submit" disabled={enviando} className="self-start rounded-[12px] bg-[#C2560A] px-6 py-3 text-[16px] font-bold text-white hover:bg-[#A84A08] disabled:opacity-60">
        {enviando ? "Enviando…" : "Crear solicitud"}
      </button>
      <p className="m-0 text-[12.5px] text-[#6B6A63]"><T>Después de crearla subes el archivo del escaneo (STL, OBJ, PLY, 3MF o ZIP) y fotos de la pieza.</T></p>
    </form>
  )
}
