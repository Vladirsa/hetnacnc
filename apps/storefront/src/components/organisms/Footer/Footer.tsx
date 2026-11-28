import { TS } from "@/i18n/TS"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { BotonPreferenciasCookies } from "@/components/hetna/AvisoCookies"
import { SocialIcon } from "@/components/hetna/SocialIcon"
import footerLinks from "@/data/footerLinks"
import { EMPRESA } from "@/lib/hetna/empresa"

const Columna = ({
  titulo,
  links,
}: {
  titulo: string
  links: { label: string; path: string }[]
}) => (
  <div className="flex flex-col gap-2.5">
    <span className="text-white font-semibold text-[13.5px]"><TS>{titulo}</TS></span>
    {links.map(({ label, path }) =>
      path.startsWith("/") && !path.startsWith("/seller") ? (
        <LocalizedClientLink
          key={label}
          href={path}
          // Sin precarga: el pie trae ~25 ligas y Next.js las precargaba todas al
          // verse, gastando datos del celular en cada página (se cargan al tocar)
          prefetch={false}
          className="text-[13px] text-[#9FACC2] hover:text-white"
        >
          <TS>{label}</TS>
        </LocalizedClientLink>
      ) : (
        <a
          key={label}
          href={path}
          className="text-[13px] text-[#9FACC2] hover:text-white"
        >
          <TS>{label}</TS>
        </a>
      )
    )}
  </div>
)

export function Footer() {
  const vendedores = [
    { label: "Vender en HETNA CNC", path: "/talleres/unete" },
    { label: "Panel de vendedor", path: "/seller" },
    // Cotizador y escaneo 3D. Van en esta columna porque quien los busca es
    // un taller, no alguien que viene a comprar.
    { label: "Trabajos buscando taller", path: "/trabajos" },
    { label: "Cotizador para tu taller", path: "/servicios/cotizador-cnc" },
    { label: "Planos de muebles para taller", path: "/planos" },
    { label: "Talleres fundadores", path: "/talleres/fundadores" },
    { label: "HETNA en Latinoamérica, EUA y España", path: "/latinoamerica" },
    { label: "Anúnciate en HETNA", path: "/anunciate" },
    { label: "Términos para vendedores", path: "/terminos-vendedores" },
    { label: "Eliminar mi cuenta", path: "/eliminar-cuenta" },
  ]

  // Guías CNC (lib/seo/guias.ts): enlaces internos a las páginas por búsqueda
  const guias = [
    { label: "Guías CNC", path: "/cnc" },
    { label: "Taller de router CNC", path: "/cnc/taller-router-cnc-mexico" },
    { label: "Corte láser de MDF", path: "/cnc/corte-laser-mdf" },
    { label: "Maquinado de aluminio", path: "/cnc/maquinado-cnc-aluminio" },
    { label: "Programación CAM 5 ejes", path: "/cnc/programacion-cam-5-ejes" },
    { label: "Archivos DXF para router", path: "/cnc/archivos-dxf-router-cnc" },
    { label: "Calculadora de avance y RPM", path: "/calculadora-cnc" },
  ]

  // Páginas de servicio por ciudad (plan SEO del 27 nov 2026, riesgo 2): las 5
  // ciudades de la meta, empezando por Tlaxcala y Puebla. Una liga desde el pie
  // de todas las páginas le dice a Google que son importantes.
  const ciudades = [
    { label: "Corte láser en Tlaxcala", path: "/cnc/corte-laser-mdf/tlaxcala" },
    { label: "Router CNC en Tlaxcala", path: "/cnc/taller-router-cnc-mexico/tlaxcala" },
    { label: "Router CNC en Puebla", path: "/cnc/taller-router-cnc-mexico/puebla" },
    { label: "Corte láser en Puebla", path: "/cnc/corte-laser-mdf/puebla" },
    { label: "Router CNC en CDMX", path: "/cnc/taller-router-cnc-mexico/cdmx" },
    { label: "Router CNC en Monterrey", path: "/cnc/taller-router-cnc-mexico/monterrey" },
    { label: "Corte plasma en Monterrey", path: "/cnc/corte-plasma/monterrey" },
    { label: "Router CNC en Guadalajara", path: "/cnc/taller-router-cnc-mexico/guadalajara" },
    { label: "Corte láser en Guadalajara", path: "/cnc/corte-laser-mdf/guadalajara" },
  ]

  return (
    <footer
      className="bg-[#0F1826] text-[#C9D2E0] px-4 lg:px-16 pt-12 pb-7 w-full"
      data-testid="footer"
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 pb-8 border-b border-[#23324A]">
        <Columna
          titulo="Atención al cliente"
          links={footerLinks.customerServices}
        />
        <Columna titulo="Nosotros" links={footerLinks.about} />
        <Columna titulo="Vendedores" links={vendedores} />
        <Columna titulo="Guías CNC" links={guias} />
        <div className="flex flex-col gap-2.5">
          <span className="text-white font-semibold text-[13.5px]">
            <TS>Síguenos</TS>
          </span>
          {footerLinks.connect.map(({ label, path }) => (
            <a
              key={label}
              href={path}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[#9FACC2] hover:text-white flex items-center gap-2"
            >
              <SocialIcon label={label} size={14} />
              <TS>{label}</TS>
            </a>
          ))}
        </div>
      </div>
      <nav aria-label="Talleres CNC por ciudad" className="pt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
        <span className="text-white font-semibold text-[13.5px]"><TS>Talleres CNC por ciudad</TS></span>
        {ciudades.map(({ label, path }) => (
          <LocalizedClientLink key={path} href={path} className="text-[#9FACC2] hover:text-white">
            <TS>{label}</TS>
          </LocalizedClientLink>
        ))}
      </nav>
      {/* Contacto visible en todas las páginas: Google Merchant Center lo pide
          para confiar en la tienda (aviso "Información engañosa"). Datos en empresa.ts */}
      <address
        className="not-italic pt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-[#9FACC2]"
        data-testid="footer-contacto"
      >
        <span className="text-white font-semibold text-[13.5px]"><TS>Atención a clientes</TS></span>
        {EMPRESA.correo ? (
          <a href={`mailto:${EMPRESA.correo}`} className="hover:text-white">
            <TS>{EMPRESA.correo}</TS>
          </a>
        ) : null}
        <a
          href={`https://wa.me/${EMPRESA.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white"
        >
          <TS>WhatsApp</TS> <TS>{EMPRESA.whatsappVisible}</TS>
        </a>
        <span><TS>{EMPRESA.horario}</TS></span>
      </address>
      <div
        className="pt-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
        data-testid="footer-copyright"
      >
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#9FACC2]">
          <span><TS>© 2026 HETNA CNC. Hecho en México.</TS></span>
          <LocalizedClientLink href="/aviso-de-privacidad" prefetch={false} className="hover:text-white">
            <TS>Privacidad</TS>
          </LocalizedClientLink>
          <BotonPreferenciasCookies className="hover:text-white" />
        </span>
        <div className="flex gap-3 items-center">
          {footerLinks.connect.map(({ label, path }) => (
            <a
              key={label}
              href={path}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="w-8 h-8 rounded-full bg-[#1B2A42] hover:bg-[#23324A] flex items-center justify-center text-[#C9D2E0]"
            >
              <SocialIcon label={label} size={15} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
