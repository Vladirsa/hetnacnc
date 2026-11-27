# Diseños originales de HETNA CNC (generadores)

Cada `.py` de esta carpeta genera diseños digitales originales de HETNA en milímetros: el DXF (capas CUT y ENGRAVE) y, en los organizadores, también el STL. Cada diseño sale con su ZIP (archivos + LEEME.txt con medidas, uso y licencia) y una vista previa PNG.

| Archivo | Diseños |
|---|---|
| `plantilla_bisagra_35.py` | Plantilla de taladro para bisagra europea de 35 mm (repuesto del ZIP dañado, nov 2026) |
| `tanda1_plantillas.py` | Plantilla para jaladeras 64–192 mm, plantilla sistema 32, escuadras de ensamble a 90° |
| `tanda2_plantillas.py` | Plantilla para chalupa eléctrica 2x4 y 4x4, plantilla para bisagra de piano, guía de sierra circular |
| `tanda3_organizadores.py` | Organizador de fresas de router, porta llaves Allen, porta puntas de 1/4" (STL + DXF) |
| `tanda4_impresion3d.py` | Maceta cónica de 10 cm con plato, soporte para celular o tableta, organizador de escritorio (STL) |

## Guardarlos en Backblaze

En el servidor:

```bash
~/hetnacnc/scripts/disenos/guardar_en_b2.sh
```

Genera todos y los sube al **bucket privado** en `disenos-generados/<nombre>/<nombre>.zip` (con su `.png`), después de revisar cada ZIP con `lib/revisar-archivo-diseno.ts`. Si ya existían, los reemplaza con la versión nueva. La primera vez instala ezdxf y gmsh en `~/.venv-disenos`.

Guardarlos en Backblaze **no los publica**: para venderlos se suben con Admin → Subir diseños.

## Pasarlos a la tienda (en borrador)

```bash
~/hetnacnc/scripts/disenos/subir_a_tienda.sh
```

Genera todos, los guarda en Backblaze y crea cada producto **en borrador** con el mismo camino que «Subir diseños»: archivo al bucket privado, foto realista con IA (si hay `FAL_KEY`), ficha escrita por Claude con las medidas del LEEME y oferta en la tienda HETNA. No duplica (SKU fijo `HCNC-G-<NOMBRE>`); la bisagra se salta porque ya tiene producto. Los borradores no se anuncian en redes; se anuncian solos la primera vez que los publicas.

## Agregar un diseño nuevo

Agrega un `.py` a esta carpeta que escriba en el directorio actual `<nombre>.zip` y `<nombre>.png`. El script de subida toma todos los `.zip` que encuentre.
