import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ColumnaDisenar, FilaDisenar, MigasDisenar } from "@/components/hetna/disenar/NavDisenar"

// Espacio de trabajo "Diseñar y escanear": el menú de herramientas se queda
// fijo y sólo cambia la herramienta de la derecha. Así quien entra ve todo lo
// que puede hacer y pasa de una herramienta a otra sin salir de aquí.
export default function DisenarLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="w-full bg-[#FAF9F6] min-h-[70vh]">
      <div className="border-b border-[#E7E4DC] bg-white">
        <div className="flex items-center justify-between gap-3 px-4 lg:px-8 py-3">
          <MigasDisenar />
          <LocalizedClientLink
            href="/herramientas-cnc"
            className="hidden sm:inline shrink-0 text-[13px] font-semibold text-[#B34D07] hover:underline"
          >
            Todas las herramientas CNC
          </LocalizedClientLink>
        </div>
      </div>
      <FilaDisenar />
      <div className="xl:grid xl:grid-cols-[250px_minmax(0,1fr)]">
        <ColumnaDisenar />
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  )
}
