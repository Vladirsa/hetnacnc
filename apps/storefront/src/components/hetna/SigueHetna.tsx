import { EMPRESA } from "@/lib/hetna/empresa"

// Bloque "Síguenos" con todas las redes oficiales de HETNA (se alimenta de empresa.ts).
export default function SigueHetna({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wide text-[#6B675C]">Síguenos</span>
      {EMPRESA.redes.map((r) => (
        <a
          key={r.nombre}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[#E7E4DC] bg-white px-3 py-1.5 text-xs font-semibold text-[#142033] hover:border-[#C2560A] hover:text-[#C2560A]"
        >
          {r.nombre}
        </a>
      ))}
    </div>
  )
}
