import { BarraForo } from "@/components/hetna/foro/BarraForo"

// Todas las páginas del foro llevan la barra del foro arriba (siempre visible)
export default function ForoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BarraForo />
      {children}
    </>
  )
}
