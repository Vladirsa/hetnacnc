# Diseños CNC del Agente Generador

Geometría paramétrica propia de HETNA, para vender como producto digital en
hetnacnc.com. Cada diseño es un script de Python que construye la pieza con
[cadgen](https://pypi.org/project/cadgen/) / build123d; el script es la
fuente de verdad y los archivos de `DXF/`, `STEP/` y `STL/` son su salida.

## Qué hay

| Diseño | Categoría | Entrega |
|---|---|---|
| `plantilla_bisagra_35` | Diseños 2D/3D para router | DXF |
| `celosia_hexagonal` | Diseños 2D/3D para router | DXF |
| `portavasos_panal` | Impresión 3D | STL + 3MF |
| `organizador_brocas` | Impresión 3D | STL |
| `brida_escalonada_m12` | Recursos CAD/CAM | STEP + STL |
| `soporte_nema23` | Recursos CAD/CAM | STEP + STL |

Los nombres de categoría tienen que coincidir **exactamente** con la tabla de
precios del workflow "HETNA Digital Factory - Calcular precio de producto";
si no coinciden, cae al precio base de 30 MXN sin avisar.

## Regenerar un diseño

`cadgen` corre por `uv`, no hace falta instalar nada a mano:

```bash
CG="uvx --no-config --managed-python --python 3.13 --from cadgen==0.7.16 python"
$CG src/celosia_hexagonal.py
```

Un diseño sin cambios no se reconstruye. Los bytes de salida son función de
la geometría, así que una corrida que no cambió el modelo no ensucia el diff.

## Revisar a ojo

`cadgen dxf snapshot` y `cadgen stl snapshot` pintan el archivo en un Chromium
que se bajan ellos la primera vez. En el contenedor del agente esa descarga
está bloqueada, así que aquí se revisa con ezdxf/matplotlib, que ya vienen
con cadgen y no necesitan navegador:

```bash
$CG revisar_dxf.py DXF/celosia-hexagonal-600.dxf tmp/celosia.png
$CG revisar_stl.py STL/soporte-nema23.stl tmp/nema23.png
```

## Dar de alta en el pipeline

`fichas.json` trae la ficha comercial de cada diseño (título, descripción,
SEO, FAQ) y qué archivos entran en su paquete.

```bash
python3 armar_paquetes.py        # arma PAQUETES/*.zip con los formatos + LEEME.txt
python3 subir_al_pipeline.py     # da de alta las que falten
```

`subir_al_pipeline.py` llama el webhook del workflow **HETNA Digital Factory -
Alta de diseno generado por agente**, que sube el ZIP al bucket privado de B2,
inserta la fila en `digital_factory_productos`, calcula el precio y genera la
imagen de mockup. La ficha queda en `READY_FOR_REVIEW`: **nada se publica
solo**, hay que revisarla antes.

Lo ya subido se anota en `subidas.json` y no se vuelve a mandar. Ahorita trae
tres: plantilla de bisagra, celosía y brida escalonada. Faltan portavasos,
organizador de brocas y soporte NEMA 23.

**Córrelo desde el VPS.** El contenedor del agente no alcanza
`n8n.hetnacnc.com`:

```bash
cd /root/hetnacnc/infra/digital-factory/disenos
git pull origin claude/vigilant-tesla-cq06q0
python3 armar_paquetes.py
python3 subir_al_pipeline.py
```

El SKU lo arma el workflow con la hora al segundo, por eso el script deja
3 segundos entre altas. Si mandas dos fichas en el mismo segundo, las dos
terminan con el mismo SKU.
