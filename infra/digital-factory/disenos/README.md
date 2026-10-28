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

Lo ya subido se anota en `subidas.json` y no se vuelve a mandar. Los seis
diseños ya están dados de alta, así que una corrida nueva los salta todos.

Ojo: el script **escribe** `subidas.json`, y el repo lo lleva versionado para
no perder el registro si se reinstala el VPS. Si una corrida lo dejó
modificado en el servidor, el siguiente `git pull` se queja. Se arregla
descartando la copia local, que trae lo mismo que viene del repo:

```bash
git checkout -- infra/digital-factory/disenos/subidas.json
git pull origin claude/vigilant-tesla-cq06q0
```

El registro de verdad es la tabla `digital_factory_productos`; este archivo
nada más evita mandar dos veces lo mismo.

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

## Publicar en la tienda

Una ficha en `READY_FOR_REVIEW` se publica desde el formulario del workflow
**HETNA Digital Factory - Publicar producto aprobado** en n8n: se escribe el
SKU y listo. El workflow:

1. busca la ficha y revisa que traiga el archivo respaldado en B2 y un precio
   que no pida revisión;
2. llama `POST /admin/disenos-digitales/publicar` (packages/api), que crea el
   producto en el catálogo con su imagen, categoría y etiquetas, y la
   **oferta** de la tienda HETNA con el precio;
3. marca la ficha `PUBLISHED` con el id del producto;
4. avisa por Telegram con la liga.

En Mercur el precio vive en la oferta, no en la variante. Un producto sin
oferta sale en el catálogo pero no se puede comprar, que era lo que habría
hecho la versión vieja del workflow.

La categoría siempre queda dentro de **Diseños digitales**
(`DISENOS_CATEGORIA`): si la `subcategoria` o la `categoria` de la ficha
nombran una categoría que vive debajo de ella, va ahí; si no, a la general. No
se busca en todo el catálogo porque las categorías de la ficha las propone la
IA, y "Impresión 3D" empataba con *Servicios › Impresión 3D*.

Se puede volver a mandar el SKU de una ficha ya `PUBLISHED`: no duplica nada,
y si el producto había salido sin categoría o con una fuera de Diseños
digitales, se la corrige.

El formulario trae **¿Publicar gratis?**: *Sí* o *No* mandan sobre la columna
`gratis` de la ficha, y al publicar se guarda en la tabla lo que se usó.

El precio en dólares (tienda `/us`) sale del de pesos con
`TIPO_CAMBIO_USD_MXN` (18 si no está), terminado en .99 y nunca menos de 1.99.

## Archivos gratis

Una ficha con la columna `gratis` en verdadero se publica sin precio ni
oferta: en la tienda dice **Gratis** y en lugar del carrito sale **Descargar
gratis**. Se baja con cuenta (la misma de la tienda), y el cupo lo lleva el
módulo `descargas` del API:

- cuenta sin plan: `DESCARGAS_GRATIS_SEMANA` archivos (20) en 7 días corridos;
- con plan del Cotizador vigente (Taller, Pro o Industrial): sin límite.

Volver a bajar el mismo archivo dentro de la semana no cuenta otra vez. La liga
es de B2, firmada, y dura una hora. Si B2 falla no se gasta cupo.

Un producto que ya está publicado se vuelve gratis poniéndole
`archivo_gratis: true` en su metadata desde el panel de administración.
