// Junta los archivos en-s-*.ts (textos que sólo traduce el servidor) y las
// reglas para frases armadas con partes (planos, guías por ciudad).
// En una regla, ⟪$1⟫ quiere decir "traduce también esta parte" (i18n/traducir.ts).
// Cada archivo pesa 28 KB o menos para poder subirlo y revisarlo.
import { EN_S_LUGARES } from "./en-s-lugares"
import { EN_S_CONTENIDO_A } from "./en-s-contenido-a"
import { EN_S_CONTENIDO_B } from "./en-s-contenido-b"
import { EN_S_CONTENIDO_C } from "./en-s-contenido-c"
import { EN_S_CONTENIDO_D } from "./en-s-contenido-d"
import { EN_S_CONTENIDO_E } from "./en-s-contenido-e"
import { EN_S_CONTENIDO_F } from "./en-s-contenido-f"
import { EN_S_CONTENIDO_G } from "./en-s-contenido-g"

export const EN_S: Record<string, string> = {
  ...EN_S_LUGARES,
  ...EN_S_CONTENIDO_A,
  ...EN_S_CONTENIDO_B,
  ...EN_S_CONTENIDO_C,
  ...EN_S_CONTENIDO_D,
  ...EN_S_CONTENIDO_E,
  ...EN_S_CONTENIDO_F,
  ...EN_S_CONTENIDO_G,
}

export const REGLAS_S: [RegExp, string][] = [
  // Guías por ciudad (components/hetna/guias/GuiaCnc.tsx)
  [/^¿Hay talleres de (.+) en (.+)\?$/, "Are there shops for ⟪$1⟫ in ⟪$2⟫?"],
  [/^, incluido el envío a (.+) si no recoges$/, ", including shipping to ⟪$1⟫ if you don't pick up"],
  [/^en ([A-ZÁÉÍÓÚÑ][^,.;:?!]*)$/, "in ⟪$1⟫"],
  // Planos (app/[locale]/(main)/planos/[slug]/page.tsx)
  [/^(.+) → (.+): tornillo de (.+)$/, "⟪$1⟫ → ⟪$2⟫: $3 screw"],
  [/^(.+) → (.+): clavo o grapa$/, "⟪$1⟫ → ⟪$2⟫: nail or staple"],
  [/^(.+) → (.+): ranura de (\d+) mm con pegamento$/, "⟪$1⟫ → ⟪$2⟫: $3 mm dado with glue"],
  [/^(\d+) tornillos para madera de (.+)$/, "$1 wood screws, $2"],
  [/^(\d+) tornillos de (.+)$/, "$1 screws, $2"],
  [/^(\d+) clavos de 3\/4" o grapas$/, '$1 3/4" nails or staples'],
  [/^(· )?(\d+) clavos o grapas$/, "$1$2 nails or staples"],
  [/^(· )?(\d+) barrenos guía de 3 mm \(en el DXF, capa «barrenos»; puntos naranjas en el acomodo\)$/, "$1$2 pilot holes, 3 mm (in the DXF, layer «barrenos»; orange dots in the layout)"],
  [/^(· )?(\d+) ranuras \(en el DXF, capas «ranura_6mm» y «ranura_4mm»; rayadas en el acomodo\)$/, "$1$2 dadoes (in the DXF, layers «ranura_6mm» and «ranura_4mm»; hatched in the layout)"],
  [
    /^(\d+) ranuras de 4 a 6 mm en costados y divisiones: las repisas, pisos y respaldos entran en ellas y quedan escuadrados\. Ya vienen alargadas en la lista de corte y marcadas en el DXF\.$/,
    "$1 dadoes, 4 to 6 mm, in the sides and dividers: shelves, bottoms, and backs fit into them and stay square. They're already lengthened in the cut list and marked in the DXF.",
  ],
  [/^1 hoja de (.+)$/, "1 sheet of ⟪$1⟫"],
  [/^(\d+) hojas de (.+)$/, "$1 sheets of ⟪$2⟫"],
  [/^(· )?se cortan (\d+) (.+)$/, "$1$2 ⟪$3⟫ are cut"],
  [/^Plano gratis: (.+) \(lista de corte y DXF\)$/, "Free plan: ⟪$1⟫ (cut list and DXF)"],
  [
    /^(.+) Plano con lista de corte, acomodo en la hoja, pasos de armado y DXF para router CNC\.$/,
    "⟪$1⟫ Plan with cut list, sheet layout, assembly steps, and DXF for a CNC router.",
  ],
  // Talleres fundadores (mismo número en /talleres/fundadores y /talleres/unete)
  [/^Quedan (\d+) de (\d+) lugares de fundador$/, "$1 of $2 founding spots left"],
  [/^Quedan (\d+) de (\d+) lugares de Taller fundador: insignia permanente y 6 meses de plan Pro gratis\.$/, "$1 of $2 Founding Shop spots left: permanent badge and 6 months of the Pro plan free."],
  // Modelos 3D y anuncios
  [/^(.+): modelo 3D a tu medida$/, "⟪$1⟫: custom-size 3D model"],
  [/^(\d+) días en (.+)$/, "$1 days on ⟪$2⟫"],
]
