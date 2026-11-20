// Páginas para insertar en sitios de terceros (widget del cotizador del
// taller, estrategia 2.3): sin encabezado ni pie del sitio. El layout raíz
// también quita la barra móvil, el aviso de instalar y el de cookies en /embed.
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-0 bg-white p-3 sm:p-4">{children}</main>
}
