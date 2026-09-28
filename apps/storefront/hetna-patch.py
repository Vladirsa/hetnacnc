#!/usr/bin/env python3
# Aplica el diseno HETNA CNC a la tienda (colores, tipografias, header, inicio).
# Se corre desde ~/hetnacnc/apps/storefront
import os
import re
import sys

BASE = os.environ.get("HETNA_SRC") or os.path.expanduser("~/hetnacnc/apps/storefront/src")
ok, falla = [], []


def leer(rel):
    with open(os.path.join(BASE, rel), encoding="utf-8") as f:
        return f.read()


def escribir(rel, s):
    with open(os.path.join(BASE, rel), "w", encoding="utf-8") as f:
        f.write(s)


def paso(nombre, cond):
    (ok if cond else falla).append(nombre)


# 1) Colores de marca (se agregan al final: ganan sobre los de FLEEK)
MARCA = """
/* ===== HETNA CNC: colores de marca ===== */
:root {
    --bg-primary: 250, 249, 246;
    --bg-secondary: 244, 241, 234;
    --bg-tertiary: 20, 32, 51;
    --bg-component-primary: 255, 255, 255;
    --bg-component-primary-hover: 250, 249, 246;
    --bg-component-primary-pressed: 244, 241, 234;
    --bg-component-secondary: 244, 241, 234;
    --bg-component-secondary-hover: 236, 232, 222;
    --bg-component-secondary-pressed: 228, 223, 211;
    --bg-action-primary: 194, 86, 10;
    --bg-action-primary-hover: 168, 74, 8;
    --bg-action-primary-pressed: 143, 63, 7;
    --content-primary: 27, 27, 24;
    --content-secondary: 107, 106, 99;
    --content-action-primary: 179, 77, 7;
    --content-action-primary-hover: 168, 74, 8;
    --content-action-primary-pressed: 143, 63, 7;
    --content-action-on-primary: 255, 255, 255;
    --border-primary: 231, 228, 220;
    --border-action: 194, 86, 10;
}
"""
c = leer("app/colors.css")
if "HETNA CNC: colores de marca" not in c:
    escribir("app/colors.css", c.rstrip() + "\n" + MARCA)
paso("colores de marca", "HETNA CNC: colores de marca" in leer("app/colors.css"))

# 2) Titulos con tipografia Space Grotesk
TIPO = """
/* ===== HETNA CNC: tipografia de titulos ===== */
.font-display,
.heading-xs, .heading-sm, .heading-md, .heading-lg, .heading-xl,
.display-sm, .display-md {
  font-family: var(--font-display), system-ui, sans-serif;
  letter-spacing: -0.01em;
}
body { background: #FAF9F6; }
"""
g = leer("app/globals.css")
if "HETNA CNC: tipografia" not in g:
    escribir("app/globals.css", g.rstrip() + "\n" + TIPO)
paso("tipografia de titulos", "HETNA CNC: tipografia" in leer("app/globals.css"))

# 3) Fuentes: Inter (texto) + Space Grotesk (titulos)
l = leer("app/layout.tsx")
if "Space_Grotesk" not in l:
    l = l.replace(
        "import { Funnel_Display } from 'next/font/google';",
        "import { Inter, Space_Grotesk } from 'next/font/google';",
    )
    l = re.sub(
        r"const funnelDisplay = Funnel_Display\(\{[\s\S]*?\}\);",
        "const funnelDisplay = Inter({\n  variable: '--font-body',\n  subsets: ['latin'],\n"
        "  weight: ['300', '400', '500', '600', '700']\n});\n\n"
        "const hetnaDisplay = Space_Grotesk({\n  variable: '--font-display',\n"
        "  subsets: ['latin'],\n  weight: ['500', '600', '700']\n});",
        l,
    )
    l = l.replace(
        "${funnelDisplay.className} relative",
        "${funnelDisplay.className} ${hetnaDisplay.variable} relative",
    )
    escribir("app/layout.tsx", l)
l = leer("app/layout.tsx")
paso(
    "fuentes Inter + Space Grotesk",
    "Space_Grotesk({" in l and "hetnaDisplay.variable" in l and "Funnel_Display" not in l,
)

# 4) Header nuevo en el layout principal
ml = leer("app/[locale]/(main)/layout.tsx")
if "HetnaHeader" not in ml:
    ml = ml.replace(
        "import { Footer, Header } from '@/components/organisms';",
        "import { Footer, Header } from '@/components/organisms';\n"
        "import { HetnaHeader } from '@/components/hetna/HetnaHeader';",
    )
    ml = ml.replace("<Header locale={locale} />", "<HetnaHeader locale={locale} />")
    escribir("app/[locale]/(main)/layout.tsx", ml)
ml = leer("app/[locale]/(main)/layout.tsx")
paso(
    "header HETNA",
    "import { HetnaHeader }" in ml and "<HetnaHeader locale={locale} />" in ml
    and "<Header locale={locale} />" not in ml,
)

# 5) Pagina de inicio
p = leer("app/[locale]/(main)/page.tsx")
if "HetnaHome" not in p:
    p = 'import { HetnaHome } from "@/components/hetna/HetnaHome"\n' + p
    p = re.sub(r"\n\s*<link\s+rel=\"preload\"[\s\S]*?/>", "", p, count=1)
    p = re.sub(r"<Hero[\s\S]*?</main>", "<HetnaHome locale={locale} />\n    </main>", p, count=1)
    p = re.sub(r'<main className="[^"]*">', '<main className="flex flex-col w-full text-primary">', p, count=1)
    p = p.replace('const title = "Home"', 'const title = "Inicio"')
    p = re.sub(
        r'"Welcome to Mercur B2C Demo![^"]*"',
        '"HETNA CNC: marketplace de CNC en México. Diseños DXF, SVG y STL, máquinas, '
        'herramientas, materiales y servicios de diseño y maquila."',
        p,
    )
    p = p.replace('"Mercur B2C Demo - Marketplace Storefront"', '"HETNA CNC"')
    escribir("app/[locale]/(main)/page.tsx", p)
p = leer("app/[locale]/(main)/page.tsx")
paso(
    "inicio HETNA",
    "<HetnaHome locale={locale} />" in p and "<Hero" not in p and "Mercur B2C Demo" not in p,
)

print("OK:   ", ", ".join(ok) if ok else "-")
print("FALLA:", ", ".join(falla) if falla else "ninguna")
sys.exit(1 if falla else 0)
