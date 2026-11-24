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
    <span className="text-white font-semibold text-[13.5px]">{titulo}</span>
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
          {label}
        </LocalizedClientLink>
      ) : (
        <a
          key={label}
          href={path}
          className="text-[13px] text-[#9FACC2] hover:text-white"
        >
          {label}
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
            Síguenos
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
              {label}
            </a>
          ))}
        </div>
      </div>
      {/* Contacto visible en todas las páginas: Google Merchant Center lo pide
          para confiar en la tienda (aviso "Información engañosa"). Datos en empresa.ts */}
      <address
        className="not-italic pt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-[#9FACC2]"
        data-testid="footer-contacto"
      >
        <span className="text-white font-semibold text-[13.5px]">Atención a clientes</span>
        {EMPRESA.correo ? (
          <a href={`mailto:${EMPRESA.correo}`} className="hover:text-white">
            {EMPRESA.correo}
          </a>
        ) : null}
        <a
          href={`https://wa.me/${EMPRESA.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white"
        >
          WhatsApp {EMPRESA.whatsappVisible}
        </a>
        <span>{EMPRESA.horario}</span>
      </address>
      <div
        className="pt-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
        data-testid="footer-copyright"
      >
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#9FACC2]">
          <span>© 2026 HETNA CNC. Hecho en México.</span>
          <LocalizedClientLink href="/aviso-de-privacidad" prefetch={false} className="hover:text-white">
            Privacidad
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
