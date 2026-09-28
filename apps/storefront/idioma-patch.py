#!/usr/bin/env python3
# Conecta el selector de idioma (ES/EN) y de moneda (MXN/USD) a la tienda
import os
BASE = os.environ.get("HETNA_SRC") or os.path.expanduser("~/hetnacnc/apps/storefront/src")
ok, falla = [], []


def paso(nombre, cond):
    (ok if cond else falla).append(nombre)


# 1) Encabezado: selectores en la barra superior y en celular
hp = os.path.join(BASE, "components/hetna/HetnaHeader.tsx")
if not os.path.exists(hp):
    raise SystemExit("FALTA HetnaHeader.tsx: el diseno HETNA no esta instalado")
h = open(hp, encoding="utf-8").read()
if "MonedaSelector" not in h:
    h = h.replace(
        'import { SocialIcon } from "./SocialIcon"',
        'import { SocialIcon } from "./SocialIcon"\n'
        'import { IdiomaSelector, MonedaSelector } from "./Selectores"\n'
        'import { listRegions } from "@/lib/data/regions"',
    )
    h = h.replace(
        "  const isLoggedIn = Boolean(user)\n",
        "  const isLoggedIn = Boolean(user)\n"
        "  const regions = (await listRegions().catch(() => [])) || []\n",
    )
    h = h.replace(
        "          <span>MXN $</span>\n",
        "          <IdiomaSelector oscuro />\n"
        "          <MonedaSelector regions={regions} oscuro />\n",
    )
    selectores_movil = (
        '          <div className="flex items-center gap-2">\n'
        "            <IdiomaSelector />\n"
        "            <MonedaSelector regions={regions} />\n"
        "          </div>\n"
    )
    envio = '        <div className="mb-2">\n          <EnvioA user={user} />\n        </div>\n'
    if envio in h:
        h = h.replace(
            envio,
            '        <div className="mb-2 flex items-center justify-between gap-2">\n'
            "          <EnvioA user={user} />\n" + selectores_movil + "        </div>\n",
        )
    else:
        abre = '      <div className="md:hidden bg-white px-4 pb-3 border-b border-[#E7E4DC]">\n'
        h = h.replace(
            abre,
            abre + '        <div className="mb-2 flex items-center justify-end gap-2">\n'
            + selectores_movil + "        </div>\n",
        )
    open(hp, "w", encoding="utf-8").write(h)
h = open(hp, encoding="utf-8").read()
paso("selectores en encabezado", h.count("<MonedaSelector") == 2 and h.count("<IdiomaSelector") == 2
     and "listRegions()" in h)

# 2) Traductor en toda la tienda (incluye pago)
lp = os.path.join(BASE, "app/layout.tsx")
l = open(lp, encoding="utf-8").read()
if "Traductor" not in l:
    l = l.replace(
        "import { HtmlLangSetter } from '@/components/atoms/HtmlLangSetter/HtmlLangSetter';",
        "import { HtmlLangSetter } from '@/components/atoms/HtmlLangSetter/HtmlLangSetter';\n"
        "import { Traductor } from '@/components/hetna/Traductor';\n"
        "import { SCRIPT_VELO } from '@/i18n/idioma';",
    )
    l = l.replace(
        "<HtmlLangSetter />",
        "<script dangerouslySetInnerHTML={{ __html: SCRIPT_VELO }} />\n"
        "        <HtmlLangSetter />\n        <Traductor />",
        1,
    )
    open(lp, "w", encoding="utf-8").write(l)
l = open(lp, encoding="utf-8").read()
paso("traductor en toda la tienda", "<Traductor />" in l and "SCRIPT_VELO" in l
     and "import { Traductor }" in l)

print("OK:   ", ", ".join(ok) if ok else "-")
print("FALLA:", ", ".join(falla) if falla else "ninguna")
