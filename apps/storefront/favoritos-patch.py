#!/usr/bin/env python3
# Agrega Favoritos y Mis compras al encabezado, y el boton de favorito en la ficha
import os
BASE = os.environ.get("HETNA_SRC") or os.path.expanduser("~/hetnacnc/apps/storefront/src")
ok, falla = [], []


def paso(n, c):
    (ok if c else falla).append(n)


# 1) Encabezado
hp = os.path.join(BASE, "components/hetna/HetnaHeader.tsx")
h = open(hp, encoding="utf-8").read()
if "FavoritosBoton" not in h:
    h = h.replace(
        'import { SocialIcon } from "./SocialIcon"',
        'import { SocialIcon } from "./SocialIcon"\n'
        'import { FavoritosBoton, MisComprasBoton } from "./Favoritos"',
    )
    h = h.replace(
        '          className="ml-auto flex items-center gap-2 lg:gap-4"\n',
        '          className="ml-auto flex items-center gap-4 lg:gap-6"\n',
    )
    h = h.replace(
        "          <UserDropdown isLoggedIn={isLoggedIn} />\n",
        "          <FavoritosBoton />\n"
        "          <MisComprasBoton isLoggedIn={isLoggedIn} />\n"
        "          <UserDropdown isLoggedIn={isLoggedIn} />\n",
    )
    open(hp, "w", encoding="utf-8").write(h)
h = open(hp, encoding="utf-8").read()
paso("botones en encabezado", "<FavoritosBoton />" in h and "<MisComprasBoton" in h)

# 2) Ficha del producto: boton guardar en favoritos
pp = os.path.join(BASE, "components/cells/ProductDetailsHeader/ProductDetailsHeader.tsx")
p = open(pp, encoding="utf-8").read()
if "BotonFavorito" not in p:
    p = p.replace(
        'import { WhatsAppButton } from "@/components/atoms/WhatsAppButton/WhatsAppButton"',
        'import { WhatsAppButton } from "@/components/atoms/WhatsAppButton/WhatsAppButton"\n'
        'import { BotonFavorito } from "@/components/hetna/Favoritos"',
    )
    p = p.replace(
        "      <WhatsAppButton productTitle={product.title} seller={seller} />\n",
        "      <WhatsAppButton productTitle={product.title} seller={seller} />\n"
        "      <BotonFavorito\n"
        "        producto={{\n"
        "          id: product.id,\n"
        '          handle: product.handle || "",\n'
        "          title: product.title,\n"
        '          thumbnail: product.thumbnail || "",\n'
        "        }}\n"
        "      />\n",
    )
    open(pp, "w", encoding="utf-8").write(p)
p = open(pp, encoding="utf-8").read()
paso("favorito en ficha de producto", "<BotonFavorito" in p and "import { BotonFavorito }" in p)

# 3) Textos en ingles para el traductor
ep = os.path.join(BASE, "i18n/en.ts")
if os.path.exists(ep):
    e = open(ep, encoding="utf-8").read()
    nuevos = {
        "Favoritos": "Favorites", "Mis compras": "My purchases", "Tus favoritos": "Your favorites",
        "Aún no tienes favoritos": "You have no favorites yet",
        "Toca el corazón en cualquier producto para guardarlo aquí.": "Tap the heart on any product to save it here.",
        "Quitar de favoritos": "Remove from favorites", "Guardar en favoritos": "Save to favorites",
        "En tus favoritos": "In your favorites", "Sin imagen": "No image",
    }
    agregar = "".join(f' "{k}": "{v}",\n' for k, v in nuevos.items() if f'"{k}"' not in e)
    if agregar:
        e = e.replace("export const EN: Record<string, string> = {\n",
                      "export const EN: Record<string, string> = {\n" + agregar, 1)
        open(ep, "w", encoding="utf-8").write(e)
    paso("traducciones", '"Mis compras"' in open(ep, encoding="utf-8").read())

print("OK:   ", ", ".join(ok) if ok else "-")
print("FALLA:", ", ".join(falla) if falla else "ninguna")
