// Botones de compartir en redes. Solo enlaces (sin scripts de terceros): no frenan la página.
// Instagram y TikTok no permiten compartir por enlace; para ellos se usa publicación automática (n8n).
type Props = { url: string; titulo: string; texto?: string; className?: string }

export default function Compartir({ url, titulo, texto, className = "" }: Props) {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(titulo)
  const msg = encodeURIComponent(`${texto || titulo} ${url}`)
  const redes: { nombre: string; href: string; color: string }[] = [
    { nombre: "WhatsApp", href: `https://wa.me/?text=${msg}`, color: "#1FA855" },
    { nombre: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, color: "#1877F2" },
    { nombre: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, color: "#111111" },
    { nombre: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, color: "#0A66C2" },
    { nombre: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}`, color: "#229ED9" },
    { nombre: "Correo", href: `mailto:?subject=${t}&body=${msg}`, color: "#6B675C" },
  ]
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wide text-[#6B675C]">Compartir</span>
      {redes.map((r) => (
        <a
          key={r.nombre}
          href={r.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={`Compartir en ${r.nombre}`}
          className="rounded-full border border-[#E7E4DC] bg-white px-3 py-1.5 text-xs font-semibold text-[#142033] transition hover:text-white"
          style={{ ["--c" as any]: r.color }}
          onMouseEnter={undefined}
        >
          <span className="inline-block h-2 w-2 rounded-full align-middle mr-1.5" style={{ background: r.color }} />
          {r.nombre}
        </a>
      ))}
    </div>
  )
}
