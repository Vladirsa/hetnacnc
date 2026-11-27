// Texto traducible para componentes de SERVIDOR (no manda nada al navegador):
//   <TS>Texto en español</TS>
// En componentes de cliente se usa <T> (components/hetna/i18n/Idioma.tsx).
import type { ReactNode } from "react"

import { traductor } from "./servidor"

export async function TS({ children }: { children?: ReactNode }) {
  if (typeof children !== "string") return <>{children}</>
  const t = await traductor()
  return <>{t(children)}</>
}
