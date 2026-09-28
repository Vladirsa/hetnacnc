#!/usr/bin/env python3
# Cambia el logo de la tienda por el de HETNA CNC
import os
BASE = os.path.expanduser("~/hetnacnc/apps/storefront/src")
cambios = 0
for raiz, _, files in os.walk(BASE):
    for f in files:
        if not f.endswith((".ts", ".tsx")):
            continue
        p = os.path.join(raiz, f)
        s = open(p, encoding="utf-8").read()
        n = s.replace("/Logo.svg", "/logo-hetna.webp")
        if f == "HetnaHeader.tsx":
            n = n.replace("width={126} height={40}", "width={180} height={48}")
        if n != s:
            open(p, "w", encoding="utf-8").write(n)
            cambios += 1
            print("actualizado:", p.replace(BASE, "src"))
print("ARCHIVOS CON LOGO NUEVO:", cambios)
print("DISENO HETNA INSTALADO:", "si" if os.path.exists(os.path.join(BASE, "components/hetna/HetnaHeader.tsx")) else "NO")
