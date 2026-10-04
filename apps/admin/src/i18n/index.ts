import en from "./en.json"
import es from "./es.json"

// Se mezclan encima de las traducciones de Mercur: solo se definen
// los textos que queremos cambiar (marca HETNA en lugar de "Mercur").
const i18nResources = {
  en: {
    translation: en,
  },
  es: {
    translation: es,
  },
}

export default i18nResources
