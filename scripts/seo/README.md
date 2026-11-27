# SEO automático (Search Console → n8n → Telegram y campañas)

## Qué hace

| Pieza | Dónde | Cuándo |
|---|---|---|
| **«SEO - Search Console semanal»** (n8n) | `scripts/seo/n8n/` | Lunes 8:13 (hora de México) |
| **Correo «su perfil apareció N veces en Google»** | nodo «Correo perfil en Google» de «Prospectos HETNA - Campaña de correo CNC» (`scripts/prospectos/n8n/perfil_google.js`) | L-V 9:00, dentro de la campaña |

1. **Cada lunes** el flujo lee Search Console (los 28 días que terminan hace 3, que es lo que tarda Google en tener los datos completos) y:
   - Reemplaza las tablas de n8n **`seo_paginas`** (cada página: clics, impresiones, posición y la búsqueda principal) y **`seo_consultas`** (cada búsqueda y su página principal).
   - Actualiza **`seo_semanal`**, la tendencia por semana.
   - Manda a Telegram el reporte:
     - clics e impresiones contra los 28 días anteriores;
     - búsquedas en posición 4 a 20 (a punto de llegar a la página 1);
     - temas que la gente busca y en los que estamos lejos (ideas de guía, página o campaña);
     - las páginas que más clics trajeron;
     - los perfiles del directorio más vistos;
     - **títulos SEO a revisar**: si al título de una página le faltan las palabras que la gente busca, propone uno. **No cambia nada en el sitio**: es una sugerencia.
   - Si Search Console falla (credencial vencida o sin permiso), sólo avisa por Telegram y **no toca las tablas**.
2. **La campaña de correo** usa `seo_paginas`: a los talleres y proveedores con perfil no reclamado que ya van en el correo 4 o más y cuyo perfil tuvo 10 impresiones o más, en lugar de la novedad del mes les toca el aviso con el número real de impresiones y la liga para reclamar su perfil.
   - Máximo una vez cada 90 días; queda anotado en la columna `notas` de la hoja como «Correo perfil en Google el AAAA-MM-DD».
   - No se manda a quien tiene `publicar = NO`, ni en otro idioma.
3. **Claude puede leer las mismas tablas** (por el conector de n8n) para revisar el SEO, proponer campañas o cambiar títulos con datos reales.

## Configurar la credencial de Google (una vez)

El flujo necesita permiso para leer Search Console:

1. En n8n abre **Credentials → Add credential → «Google OAuth2 API»** y nómbrala **Google Search Console**.
2. Usa el mismo Client ID y Client Secret de Google Cloud que la credencial de Google Sheets, o crea unos nuevos en <https://console.cloud.google.com/apis/credentials>. En ese proyecto de Google Cloud, habilita la **Google Search Console API**.
3. En **Scope** pon: `https://www.googleapis.com/auth/webmasters.readonly`
4. Presiona **Sign in with Google** con la cuenta que administra la propiedad `https://hetnacnc.com/` en Search Console.
5. Abre el flujo «SEO - Search Console semanal» y, en los 4 nodos «GSC …», elige esa credencial.
6. Presiona **Probar a mano**. El reporte llega por Telegram en un minuto.

Si la propiedad en Search Console es de dominio (`sc-domain:hetnacnc.com`) en lugar de prefijo de URL, cambia `SITIO_GSC` en `fechas.js` (y en el nodo «Fechas»).

## Cambiar el flujo

Edita `fechas.js`, `armar.js` o `titulos.js`, corre `python3 scripts/seo/n8n/generar_flujo.py` y actualiza el flujo en n8n con `flujo.sdk.js`. Sin backticks ni barras invertidas en los `.js`, como en los demás flujos.

Hasta que la credencial esté lista, las tablas tienen los datos de la exportación manual de Search Console del 27 nov 2026 (`fuente = export`, agosto a noviembre).
