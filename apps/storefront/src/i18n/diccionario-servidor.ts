// Diccionario del SERVIDOR: el de todo el sitio (diccionario.ts) más textos que
// sólo se dibujan en el servidor (guías por ciudad, planos, Fabricación,
// programas…). Estos archivos (en-s-*.ts) nunca se mandan al navegador, así la
// página en inglés no carga más JavaScript.
// Lo usa i18n/servidor.ts (traductor, <TS>, traducirDatos, metadata).
import { EN as EN_SITIO, REGLAS as REGLAS_SITIO } from "./diccionario"
import { EN_S, REGLAS_S } from "./en-s"
import { EN_META_A } from "./en-meta-a"
import { EN_META_B } from "./en-meta-b"
import { EN_META_C } from "./en-meta-c"
import { EN_META_D } from "./en-meta-d"
import { EN_META_E } from "./en-meta-e"
import { EN_META_F } from "./en-meta-f"

// Metadata de las páginas (títulos y descripciones para Google): sólo en el servidor
const EN_META = { ...EN_META_A, ...EN_META_B, ...EN_META_C, ...EN_META_D, ...EN_META_E, ...EN_META_F }

export const EN: Record<string, string> = { ...EN_S, ...EN_META, ...EN_SITIO }
export const REGLAS: [RegExp, string][] = [...REGLAS_SITIO, ...REGLAS_S]
