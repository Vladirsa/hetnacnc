import NextImage from "next/image"

// `next/image` con una dirección que viene de la base de datos o del navegador
// del cliente.
//
// next/image no acepta cualquier cosa en `src`: si no empieza con "/" o con
// "https://", **lanza una excepción al dibujar**. No avisa en consola, no deja
// la imagen rota: tumba la pantalla completa. En el App Router eso sube hasta
// el error boundary más cercano, o sea que una sola imagen con una dirección
// rara deja la página en "Esta parte no se pudo cargar".
//
// Las direcciones que esta tienda maneja no son constantes del repositorio: son
// portadas de artículos y logos de talleres que escribe cualquiera en el panel,
// y vistas previas que el navegador arma con URL.createObjectURL, que producen
// "blob:..." -- justo lo que next/image rechaza. Por eso la foto que acabas de
// elegir en el formulario de anuncios reventaba la página.
//
// Entonces: cuando la dirección sirve para next/image, se usa next/image con
// todo lo que trae (optimización, lazy, srcset). Cuando no, se cae a un <img>
// normal, que dibuja igual de bien y nunca truena. Vale más una imagen sin
// optimizar que una pantalla caída.
export const esSrcDeNextImage = (src: unknown): src is string => {
  if (typeof src !== "string" || !src) return false
  // "//cdn.ejemplo.com/x.jpg" no lo acepta: no trae protocolo.
  if (src.startsWith("//")) return false
  if (src.startsWith("/")) return true
  // Sólo https: el next.config de este sitio sólo tiene http para localhost.
  return /^https:\/\//i.test(src)
}

type Props = {
  src?: string | null
  alt?: string
  width?: number | string
  height?: number | string
  className?: string
  style?: React.CSSProperties
  loading?: "lazy" | "eager"
  decoding?: "async" | "auto" | "sync"
  priority?: boolean
  sizes?: string
  fill?: boolean
  unoptimized?: boolean
  [k: string]: unknown
}

export const ImagenSegura = ({ src, alt = "", ...resto }: Props) => {
  if (!src) return null

  if (esSrcDeNextImage(src)) {
    return (
      <NextImage
        src={src}
        alt={alt}
        {...(resto as Record<string, never>)}
      />
    )
  }

  const { priority: _priority, sizes: _sizes, fill: _fill, unoptimized: _unoptimized, ...propsImg } = resto

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      {...(propsImg as Record<string, never>)}
    />
  )
}

export default ImagenSegura
