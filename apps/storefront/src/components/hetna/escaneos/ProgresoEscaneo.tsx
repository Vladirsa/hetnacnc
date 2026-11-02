"use client"

// Barra de progreso del escaneo 3D. La GPU no reporta un porcentaje, así que
// se estima con el tiempo que tarda cada tipo de escaneo y nunca pasa de 95%
// hasta que de verdad termina. La página se actualiza sola cada pocos segundos
// y, al quedar listo, aparecen las descargas sin recargar.
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const DURACION_S: Record<string, number> = { preview: 120, scan: 20 * 60 }

const ETAPAS = [
  { hasta: 15, texto: "Preparando tus fotos" },
  { hasta: 45, texto: "Analizando la forma de la pieza" },
  { hasta: 80, texto: "Construyendo la malla 3D" },
  { hasta: 101, texto: "Revisando y guardando el archivo" },
]

export function ProgresoEscaneo({ modo, desde }: { modo: string; desde: string }) {
  const router = useRouter()
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000)
    const refresco = setInterval(() => router.refresh(), 6000)
    return () => {
      clearInterval(reloj)
      clearInterval(refresco)
    }
  }, [router])

  const total = DURACION_S[modo] ?? DURACION_S.scan
  const transcurrido = Math.max(0, (ahora - new Date(desde).getTime()) / 1000)
  // Avanza rápido al principio y se frena al acercarse al final
  const pct = Math.min(95, Math.round(100 * (1 - Math.exp((-2.2 * transcurrido) / total))))
  const etapa = ETAPAS.find((e) => pct < e.hasta)?.texto ?? ETAPAS[ETAPAS.length - 1].texto
  const demora = transcurrido > total * 1.5

  return (
    <div className="mt-6 rounded-[12px] border border-[#CBD8EA] bg-[#EEF3FA] px-4 py-4">
      <div className="flex items-center justify-between gap-3 text-[14px] text-[#2A4A7B]">
        <span className="font-semibold">{etapa}…</span>
        <span className="tabular-nums font-semibold">{pct}%</span>
      </div>
      <div
        className="mt-2.5 h-3 w-full rounded-full bg-white/80 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance del escaneo"
      >
        <div
          className="h-full rounded-full bg-[#C2560A] transition-[width] duration-1000 ease-out relative overflow-hidden"
          style={{ width: `${Math.max(pct, 3)}%` }}
        >
          <span className="absolute inset-0 animate-pulse bg-white/20" />
        </div>
      </div>
      <p className="mt-2.5 text-[13px] text-[#4A5E80] leading-relaxed">
        {demora
          ? "Está tardando un poco más de lo normal; sigue trabajando. Puedes cerrar esta página: el resultado queda guardado en Mis escaneos."
          : modo === "preview"
            ? "Una vista previa tarda alrededor de 2 minutos. Esta página se actualiza sola."
            : "Un escaneo profesional tarda entre 10 y 30 minutos. Puedes cerrar esta página: el resultado queda guardado en Mis escaneos."}
      </p>
    </div>
  )
}
