// Eventos del foro: tarjeta con la fecha, ficha del evento y liga para
// agregarlo a Google Calendar. Las fechas se guardan en hora de México.
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { type Evento, SITIO, type TemaResumen, urlTema } from "@/lib/foro/tipos"

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]

const partes = (f: string) => {
  const [d, h] = f.split("T")
  const [y, m, dia] = d.split("-").map(Number)
  return { y, m, dia, hora: h || "00:00" }
}

// "jueves 20 nov 2026, 10:00"
export const fechaEvento = (f: string) => {
  const p = partes(f)
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.dia)).getUTCDay()
  return `${DIAS[dow]} ${p.dia} ${MESES[p.m - 1]} ${p.y}, ${p.hora} h`
}

// Liga de Google Calendar (la hora va en zona de México)
export const ligaCalendario = (titulo: string, e: Evento, url: string) => {
  const g = (f: string) => f.replace(/[-:]/g, "") + "00"
  const finDefecto = () => {
    const p = partes(e.inicio)
    const [hh, mm] = p.hora.split(":").map(Number)
    const d = new Date(Date.UTC(p.y, p.m - 1, p.dia, hh + 2, mm))
    return d.toISOString().slice(0, 16)
  }
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${g(e.inicio)}/${g(e.fin || finDefecto())}`,
    ctz: "America/Mexico_City",
    details: `${e.liga ? e.liga + "\n" : ""}${url}`,
    location: e.lugar,
  })
  return `https://calendar.google.com/calendar/render?${q}`
}

export function FechaCuadro({ inicio }: { inicio: string }) {
  const p = partes(inicio)
  return (
    <span className="flex h-[58px] w-[54px] shrink-0 flex-col items-center justify-center rounded-[10px] border border-[#E7E4DC] bg-white leading-none">
      <span className="text-[11px] font-bold uppercase text-[#C2560A]">{MESES[p.m - 1]}</span>
      <span className="mt-1 text-[22px] font-extrabold text-[#142033]">{p.dia}</span>
    </span>
  )
}

export function TarjetaEvento({ t }: { t: TemaResumen }) {
  if (!t.evento) return null
  return (
    <LocalizedClientLink href={urlTema(t)} className="flex items-start gap-3 rounded-[12px] border border-[#E7E4DC] bg-white p-4 hover:border-[#C2560A]">
      <FechaCuadro inicio={t.evento.inicio} />
      <span className="min-w-0">
        <span className="block text-[15.5px] font-bold leading-snug text-[#1B1B18]">{t.titulo}</span>
        <span className="mt-0.5 block text-[13.5px] text-[#44433D]">{fechaEvento(t.evento.inicio)}</span>
        <span className="block truncate text-[13px] text-[#6B6A63]">
          {t.evento.modalidad === "en_linea" ? "🖥 En línea · " : "📍 "}
          {t.evento.lugar} · por {t.autor.nombre}
        </span>
      </span>
    </LocalizedClientLink>
  )
}

export function FichaEvento({ t, e }: { t: { titulo: string; seccion: { slug: string }; slug: string }; e: Evento }) {
  const url = `${SITIO}/mx${urlTema(t)}`
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[#BFE0CC] bg-[#F3FAF5] p-4 sm:flex-row sm:items-center">
      <FechaCuadro inicio={e.inicio} />
      <div className="min-w-0 flex-1 text-[14.5px] text-[#1B1B18]">
        <div className="font-bold">
          {fechaEvento(e.inicio)}
          {e.fin ? ` — ${e.fin.split("T")[0] === e.inicio.split("T")[0] ? `${e.fin.split("T")[1]} h` : fechaEvento(e.fin)}` : ""}
        </div>
        <div className="text-[#44433D]">
          {e.modalidad === "en_linea" ? "🖥 En línea: " : "📍 "}
          {e.lugar}
        </div>
        {e.liga && (
          <a href={e.liga} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-[13.5px] font-semibold text-[#14683F] underline">
            Registro o transmisión →
          </a>
        )}
      </div>
      <a
        href={ligaCalendario(t.titulo, e, url)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full border border-[#16794F] px-3.5 py-1.5 text-[13px] font-semibold text-[#14683F] hover:bg-[#EAF6EF]"
      >
        + Agregar a mi calendario
      </a>
    </div>
  )
}
