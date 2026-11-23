# GUÍA 1 — datos para el panel (Admin → Blog → Nuevo)

Título: Cómo convertir STEP a STL (y STL a STEP) gratis, sin instalar nada
Dirección (slug): convertir-step-a-stl-gratis
Sección del foro: Diseño y CAM
Autor: Equipo HETNA
Resumen: STEP es para diseñar y maquinar; STL, para imprimir en 3D. Te explicamos la diferencia, cuándo conviene cada uno y cómo convertirlos gratis en tu navegador, sin subir tu archivo.
Título para Google: Convertir STEP a STL gratis y sin instalar nada | HETNA
Descripción para Google: Convierte STEP a STL o STL a STEP gratis en tu navegador, sin subir tu archivo. Qué diferencia hay entre los dos formatos y cuándo usar cada uno.

----- CONTENIDO (copiar desde aquí) -----

Te mandaron una pieza en STEP y tu impresora 3D sólo acepta STL. O al revés: tienes un STL y el taller de maquinado te pide STEP. Aquí te explicamos qué es cada formato y cómo pasar de uno a otro gratis, en tu navegador, con el [Convertidor de HETNA](https://hetnacnc.com/mx/disenar/convertidor).

## ¿Qué diferencia hay entre STEP y STL?

**STEP (.step o .stp)** guarda la pieza como un sólido exacto: caras planas, cilindros y curvas con su medida matemática. Es el formato de intercambio entre programas de CAD (SolidWorks, Fusion 360, FreeCAD, Inventor) y el que piden los talleres de maquinado y torno CNC, porque se puede editar y programar con precisión.

**STL (.stl)** guarda sólo la superficie, hecha de miles de triángulos. No tiene curvas reales: un círculo es un polígono de muchos lados. Es el formato que leen los laminadores de impresión 3D (Cura, PrusaSlicer, Bambu Studio, OrcaSlicer) y también sirve para tallar relieves en router CNC.

- Para **imprimir en 3D**: STL.
- Para **maquinar, tornear o seguir diseñando**: STEP.

## Cómo convertir STEP a STL

1. Abre el [Convertidor](https://hetnacnc.com/mx/disenar/convertidor).
2. Arrastra tu archivo .step o .stp.
3. Revisa la vista previa y las medidas.
4. Descarga el STL y ábrelo en tu laminador.

El archivo se procesa en tu navegador: no se sube a ningún servidor.

## Cómo convertir STL a STEP

Se hace igual: sube el STL y descarga el STEP. Hay un detalle importante: como el STL sólo tiene triángulos, **el STEP que sale está hecho de caras planas**. Se abre en cualquier programa de CAD y sirve para medir, ensamblar, hacer cortes o agregarle piezas encima, pero las superficies curvas siguen siendo triángulos. Si necesitas cilindros y curvas reales para maquinar, lo correcto es pedir el STEP original a quien diseñó la pieza.

## Consejos para que salga bien

- **Trabaja en milímetros.** Si la pieza sale 25.4 veces más grande o más chica, el archivo venía en pulgadas.
- **Revisa que la malla esté cerrada.** Un STL con huecos da errores al laminar o al convertir.
- **No pierdas el original.** Guarda siempre el STEP: de STEP a STL no se pierde nada importante para imprimir, pero de STL a STEP no se recuperan las curvas.

## ¿Y si la pieza no cabe en mi impresora?

Con [Partir modelo 3D](https://hetnacnc.com/mx/disenar/partir-3d) la divides en piezas que caben en tu cama, con pernos o imanes para armarla.

## ¿No tienes impresora o máquina?

Manda tu archivo a [Cotizar](https://hetnacnc.com/mx/cotizar) y varios talleres de la red te mandan su precio para imprimirlo o maquinarlo.

## Preguntas frecuentes

**¿Es gratis?** Sí, sin cuenta y sin marca de agua.

**¿Mi archivo se sube a internet?** No. La conversión se hace en tu navegador.

**¿Qué otros formatos convierte?** También DXF a SVG y SVG a DXF, STL a OBJ, y puede cambiar el tamaño de un archivo o ajustarlo a otro espesor de material.
