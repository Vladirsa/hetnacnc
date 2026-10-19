# Tipografías del sitio

Aquí viven los archivos que antes se bajaban de Google en cada build.

**Por qué:** `next/font/google` descarga la tipografía al construir. Eso
significa que un build puede fallar por la red de Google aunque el código esté
perfecto -- y pasó: el 19 de octubre el despliegue se cayó con
`TypeError: Cannot read properties of null` en `next/font`, con el sitio abajo,
sin nada que ver con lo que se estaba publicando.

Con `next/font/local` el build ya no sale a internet. El sitio sirve las
tipografías igual que antes, desde su propio dominio.

**Qué son:** el subconjunto *latin* de las versiones variables de Inter y
Space Grotesk, tal como las entrega Google Fonts. Variables significa que un
solo archivo cubre todos los grosores (300 a 700 en Inter, 500 a 700 en Space
Grotesk), así que pesan menos que un archivo por grosor.

**Licencia:** las dos son SIL Open Font License 1.1, que permite
redistribuirlas junto con el proyecto.

**Para actualizarlas:** pide el CSS a Google con un navegador moderno
(`https://fonts.googleapis.com/css2?family=Inter:wght@300..700`), toma la URL
del bloque marcado `/* latin */` y reemplaza el .woff2.
