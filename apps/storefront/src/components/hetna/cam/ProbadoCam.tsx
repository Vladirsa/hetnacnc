"use client"

// "Programas probados" en el CAM 2D y en el torno: cuántos talleres ya
// corrieron un programa de este control y cómo les fue, y el botón para que el
// cliente reporte el suyo después de descargarlo. Es el mismo registro que usa
// el laboratorio 3D (/api/cam/pruebas).
import { useEffect, useState } from "react"

type Resumen = { controlador: string; herramienta: string; bien: number; ajustes: number; mal: number; talleres: number }
type Props = {
  herramienta: "2d" | "torno"
  controlador: string
  nombreControl: string
  maquina?: string
  material?: string
  /** true cuando el cliente ya bajó el programa: se le invita a reportar */
  bajado: boolean
  oscuro?: boolean
}

const RESULTADOS = [
  ["bien", "Salió bien"],
  ["ajustes", "Con ajustes"],
  ["mal", "No sirvió"],
] as const

export function ProbadoCam({ herramienta, controlador, nombreControl, maquina, material, bajado, oscuro = false }: Props) {
  const [lista, setLista] = useState<Resumen[] | null>(null)
  const [version, setVersion] = useState(0)
  const [abierto, setAbierto] = useState(false)
  const [resultado, setResultado] = useState<string>("")
  const [notas, setNotas] = useState("")
  const [estado, setEstado] = useState("")
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch("/api/cam/pruebas", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => vivo && setLista(Array.isArray(d?.pruebas) ? d.pruebas : []))
      .catch(() => vivo && setLista([]))
    return () => {
      vivo = false
    }
  }, [version])

  const enviar = async () => {
    if (!resultado) return setEstado("Elige cómo te fue.")
    setEnviando(true)
    setEstado("Enviando…")
    const d = await fetch("/api/cam/pruebas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ herramienta, controlador, resultado, maquina, material, ejes: herramienta === "torno" ? 4 : 3, notas: notas.trim() || undefined }),
    })
      .then((r) => r.json())
      .catch(() => ({ mensaje: "No se pudo conectar." }))
    setEnviando(false)
    if (d.ok) {
      setEstado("Gracias: tu reporte ya cuenta.")
      setNotas("")
      setVersion((v) => v + 1)
    } else setEstado(d.mensaje || "No se pudo guardar tu reporte.")
  }

  const r = lista?.find((x) => x.controlador === controlador && x.herramienta === herramienta)
  const n = r ? r.bien + r.ajustes + r.mal : 0
  const c = oscuro
    ? { caja: "border-[#2B3648] bg-[#151C27] text-white", suave: "text-[#8A97AB]", campo: "bg-[#1C2431] text-white placeholder:text-[#8A97AB]", chip: "bg-[#2B3648] text-white", boton: "bg-[#2B3648] text-white hover:bg-[#3A475C]" }
    : { caja: "border-[#E7E4DC] bg-white text-[#1B1B18]", suave: "text-[#6B6A63]", campo: "border border-[#E7E4DC] bg-white text-[#1B1B18]", chip: "border border-[#C9C4B8] bg-white text-[#1B1B18]", boton: "border border-[#C9C4B8] bg-white text-[#1B1B18] hover:border-[#C2560A]" }

  return (
    <div className={`flex flex-col gap-2 rounded-[10px] border p-3 ${c.caja}`}>
      <b className="text-[13px]">Programas probados</b>
      <span className={`text-[12.5px] leading-snug ${c.suave}`}>
        {lista === null
          ? "Consultando los reportes de otros talleres…"
          : r
            ? `${nombreControl}: ${n} ${n === 1 ? "reporte" : "reportes"} de ${r.talleres} ${r.talleres === 1 ? "taller" : "talleres"}. ${r.bien} salieron bien, ${r.ajustes} con ajustes y ${r.mal} no sirvieron.`
            : `Todavía ningún taller ha reportado cómo le fue con ${nombreControl}. Si lo pruebas, sé el primero en decirlo: corre siempre en vacío antes de cortar.`}
      </span>
      {!abierto ? (
        <button type="button" onClick={() => setAbierto(true)} className={`self-start rounded-[8px] px-3 py-2 text-[13px] font-semibold ${bajado ? "bg-[#C2560A] text-white hover:bg-[#A84A08]" : c.boton}`}>
          {bajado ? "Ya lo corrí: reportar cómo salió" : "Probé un programa: reportar"}
        </button>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cómo te fue">
            {RESULTADOS.map(([id, texto]) => (
              <button key={id} type="button" role="radio" aria-checked={resultado === id} onClick={() => setResultado(id)} className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${resultado === id ? "bg-[#C2560A] text-white" : c.chip}`}>
                {texto}
              </button>
            ))}
          </div>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} rows={2} placeholder="Opcional: tu máquina y qué ajustaste" className={`rounded-[8px] px-2.5 py-2 text-[13px] outline-none ${c.campo}`} />
          <button type="button" disabled={enviando} onClick={enviar} className="self-start rounded-[8px] bg-[#C2560A] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-50">
            Enviar reporte
          </button>
        </>
      )}
      {estado && <span role="status" className={`text-[12.5px] leading-snug ${c.suave}`}>{estado}</span>}
    </div>
  )
}
