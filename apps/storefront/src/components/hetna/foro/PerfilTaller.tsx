// Secciones del perfil de taller (tipo LinkedIn) que se dibujan en el servidor:
// máquinas, materiales con espesores, portafolio de trabajos y zonas que atiende.
// Todo es opcional: si una lista viene vacía, la sección no sale.
import { ImagenSegura as Image } from "@/components/hetna/ImagenSegura"
import {
  type Equipo,
  MATERIALES_TALLER,
  type MaterialEspesor,
  TIPOS_MAQUINA,
  TODO_MEXICO,
  type Trabajo,
  areaTrabajo,
  rangoEspesor,
  urlFoto,
} from "@/lib/foro/tipos"

/** "Atiende: Todo México" o "Atiende: Puebla, Tlaxcala y 3 estados más". */
export function textoZonas(zonas: string[]): string {
  if (!zonas.length) return ""
  if (zonas.includes(TODO_MEXICO)) return "Atiende todo México"
  if (zonas.length <= 3) return `Atiende ${zonas.join(", ")}`
  return `Atiende ${zonas.slice(0, 3).join(", ")} y ${zonas.length - 3} estados más`
}

export function MaquinasTaller({ equipos }: { equipos: Equipo[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
      {equipos.map((e, i) => (
        <li key={i} className="flex items-center gap-3 rounded-[12px] border border-[#E7E4DC] bg-[#FCFBF8] p-3">
          {e.foto ? (
            <a href={urlFoto(e.foto)} target="_blank" rel="noopener" className="shrink-0">
              <Image src={urlFoto(e.foto)} alt={`${TIPOS_MAQUINA[e.tipo]} ${e.modelo}`.trim()} width={128} height={128} className="h-16 w-16 rounded-[10px] object-cover" />
            </a>
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[10px] bg-[#F1EFEA] text-[26px]" aria-hidden="true">
              ⚙️
            </span>
          )}
          <div className="min-w-0">
            <p className="m-0 text-[15px] font-bold text-[#1B1B18]">{TIPOS_MAQUINA[e.tipo]}</p>
            {e.modelo && <p className="m-0 text-[13.5px] text-[#44433D]">{e.modelo}</p>}
            {(areaTrabajo(e) || e.potencia) && (
              <p className="m-0 text-[13px] text-[#6B6A63]">
                {[areaTrabajo(e) && `Área ${areaTrabajo(e)}`, e.potencia && `${e.potencia.toLocaleString("es-MX")} ${e.unidad}`].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function MaterialesTaller({ materiales }: { materiales: MaterialEspesor[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {materiales.map((m) => (
        <li key={m.material} className="rounded-full bg-[#F4F1EA] px-3 py-1.5 text-[14px] text-[#1B1B18]">
          <strong className="font-semibold">{MATERIALES_TALLER[m.material]}</strong>
          {rangoEspesor(m) && <span className="text-[#6B6A63]"> · {rangoEspesor(m)}</span>}
        </li>
      ))}
    </ul>
  )
}

export function PortafolioTrabajos({ trabajos }: { trabajos: Trabajo[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
      {trabajos.map((t) => (
        <li key={t.id} className="overflow-hidden rounded-[12px] border border-[#E7E4DC] bg-white">
          <a href={urlFoto(t.fotos[0])} target="_blank" rel="noopener" className="block bg-[#F6F4EF]">
            <Image src={urlFoto(t.fotos[0])} alt={t.titulo} width={640} height={480} className="aspect-[4/3] h-full w-full object-cover" />
          </a>
          {t.fotos.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto px-3 pt-2">
              {t.fotos.slice(1).map((f) => (
                <a key={f} href={urlFoto(f)} target="_blank" rel="noopener" className="shrink-0">
                  <Image src={urlFoto(f)} alt={t.titulo} width={112} height={112} className="h-14 w-14 rounded-[8px] object-cover" />
                </a>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1 p-3">
            <p className="m-0 text-[15px] font-bold text-[#1B1B18]">{t.titulo}</p>
            {(t.material || t.espesor || t.maquina) && (
              <p className="m-0 text-[13px] text-[#6B6A63]">
                {[t.material && MATERIALES_TALLER[t.material], t.espesor && `${t.espesor.toLocaleString("es-MX")} mm`, t.maquina && TIPOS_MAQUINA[t.maquina]]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {t.detalle && <p className="m-0 whitespace-pre-line text-[14px] leading-relaxed text-[#23231F]">{t.detalle}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}
