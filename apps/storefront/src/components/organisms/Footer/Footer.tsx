import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { SocialIcon } from "@/components/hetna/SocialIcon"
import footerLinks from "@/data/footerLinks"

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
    { label: "Vender en HETNA CNC", path: "/seller" },
    { label: "Panel de vendedor", path: "/seller" },
    { label: "Talleres fundadores", path: "/talleres/fundadores" },
    { label: "Anuncia tu taller", path: "/anunciate" },
  ]

  return (
    <footer
      className="bg-[#0F1826] text-[#C9D2E0] px-4 lg:px-16 pt-12 pb-7 w-full"
      data-testid="footer"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pb-8 border-b border-[#23324A]">
        <Columna
          titulo="Atención al cliente"
          links={footerLinks.customerServices}
        />
        <Columna titulo="Nosotros" links={footerLinks.about} />
        <Columna titulo="Vendedores" links={vendedores} />
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
      <div
        className="pt-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
        data-testid="footer-copyright"
      >
        <span className="text-[12px] text-[#9FACC2]">
          © 2026 HETNA CNC. Hecho en México.
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
