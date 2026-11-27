// Diccionario del panel del taller: se descarga sólo si el panel va en inglés (src/lib/idioma.tsx).
import { PANEL_EN_A } from "./a"
import { PANEL_EN_B } from "./b"
import { PANEL_EN_C } from "./c"
import { PANEL_EN_D } from "./d"
import { PANEL_EN_E } from "./e"
import { PANEL_EN_F } from "./f"

export const PANEL_EN: Record<string, string> = {
  ...PANEL_EN_A,
  ...PANEL_EN_B,
  ...PANEL_EN_C,
  ...PANEL_EN_D,
  ...PANEL_EN_E,
  ...PANEL_EN_F,
}
