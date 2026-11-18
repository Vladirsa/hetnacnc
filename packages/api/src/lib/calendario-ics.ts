// Calendario en formato iCalendar (RFC 5545) para suscribirse desde Google
// Calendar, Outlook o el calendario del iPhone ("Agregar calendario desde URL").
// Sólo lectura: Google lo vuelve a pedir solo cada pocas horas.
import { createHash, createHmac, timingSafeEqual } from "crypto"

export type EventoIcs = {
  uid: string
  titulo: string
  descripcion?: string | null
  url?: string | null
  lugar?: string | null
  /** Todo el día: "YYYY-MM-DD" */
  dia?: string
  /** Con hora exacta (instante real) */
  inicio?: Date
  /** Con hora "de reloj" del taller: "YYYY-MM-DDTHH:MM", se manda con TZID */
  inicioLocal?: string
  minutos?: number
}

/** Escapa texto según RFC 5545 (\\ ; , y saltos de línea). */
export const escIcs = (t: string) =>
  String(t ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")

/** Corta líneas a 75 bytes (con espacio al inicio de la continuación), sin partir caracteres UTF-8. */
export function doblar(linea: string): string {
  const partes: string[] = []
  let actual = ""
  let bytes = 0
  for (const ch of linea) {
    const b = Buffer.byteLength(ch)
    const max = partes.length ? 74 : 75
    if (bytes + b > max) {
      partes.push(actual)
      actual = ""
      bytes = 0
    }
    actual += ch
    bytes += b
  }
  partes.push(actual)
  return partes.join("\r\n ")
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
const sinGuiones = (dia: string) => dia.replace(/-/g, "")
const diaSiguiente = (dia: string) => {
  const d = new Date(`${dia}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const sumarMinutosLocal = (local: string, min: number) => {
  // Aritmética en "hora de reloj": se trata como UTC sólo para sumar
  const d = new Date(`${local}:00Z`)
  d.setUTCMinutes(d.getUTCMinutes() + min)
  return d.toISOString().slice(0, 16)
}
const local = (l: string) => l.replace(/[-:]/g, "") + "00"

export const ZONA = "America/Mexico_City"

export function armarIcs(nombre: string, eventos: EventoIcs[], opciones: { zona?: string; descripcion?: string } = {}): string {
  const zona = opciones.zona || ZONA
  const ahora = utc(new Date())
  const l: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HETNA CNC//Calendario//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escIcs(nombre)}`,
    `X-WR-TIMEZONE:${zona}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT2H",
    "X-PUBLISHED-TTL:PT2H",
  ]
  if (opciones.descripcion) l.push(`X-WR-CALDESC:${escIcs(opciones.descripcion)}`)
  for (const e of eventos) {
    const v: string[] = ["BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${ahora}`]
    if (e.dia) {
      v.push(`DTSTART;VALUE=DATE:${sinGuiones(e.dia)}`, `DTEND;VALUE=DATE:${sinGuiones(diaSiguiente(e.dia))}`, "TRANSP:TRANSPARENT")
    } else if (e.inicioLocal) {
      v.push(`DTSTART;TZID=${zona}:${local(e.inicioLocal)}`, `DTEND;TZID=${zona}:${local(sumarMinutosLocal(e.inicioLocal, e.minutos || 60))}`)
    } else if (e.inicio) {
      v.push(`DTSTART:${utc(e.inicio)}`, `DTEND:${utc(new Date(e.inicio.getTime() + (e.minutos || 30) * 60_000))}`)
    } else continue
    v.push(`SUMMARY:${escIcs(e.titulo)}`)
    if (e.descripcion) v.push(`DESCRIPTION:${escIcs(e.descripcion)}`)
    if (e.lugar) v.push(`LOCATION:${escIcs(e.lugar)}`)
    if (e.url && /^https:\/\//.test(e.url)) v.push(`URL:${e.url}`)
    v.push("END:VEVENT")
    l.push(...v)
  }
  l.push("END:VCALENDAR")
  return l.map(doblar).join("\r\n") + "\r\n"
}

// ── Ligas firmadas (sin guardar nada en la base) ───────────────────────
const secreto = () => {
  const s = process.env.CALENDARIO_SECRET || process.env.JWT_SECRET || ""
  return s.length >= 16 ? s : ""
}
export const calendarioListo = () => Boolean(secreto())

/** Firma corta (24 caracteres) de un dueño de calendario, p. ej. "taller:<id>" o "hetna". */
export function firmar(dueno: string): string {
  const s = secreto()
  if (!s) throw new Error("Falta CALENDARIO_SECRET (o JWT_SECRET) en el .env")
  return createHmac("sha256", s).update(`calendario:${dueno}`).digest("base64url").slice(0, 24)
}

export function firmaValida(dueno: string, firma: string): boolean {
  if (!secreto() || !/^[A-Za-z0-9_-]{24}$/.test(firma)) return false
  const a = Buffer.from(firmar(dueno))
  const b = Buffer.from(firma)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** UID estable de un evento (no revela ids internos). */
export const uidDe = (tipo: string, id: string) => `${createHash("sha1").update(`${tipo}:${id}`).digest("hex").slice(0, 20)}@hetnacnc.com`
