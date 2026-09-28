// Ajustes del idioma de la tienda (se usan en servidor y en navegador)
export const COOKIE_IDIOMA = "hetna_lang"

// Se ejecuta antes de pintar: si el cliente eligio ingles, oculta la pagina
// un instante para que no vea el espanol parpadear (maximo 1.5 s).
export const SCRIPT_VELO =
  "try{if(document.cookie.indexOf('" +
  COOKIE_IDIOMA +
  "=en')>-1){var s=document.createElement('style');s.id='hetna-en-velo';" +
  "s.textContent='body{opacity:0!important}';document.head.appendChild(s);" +
  "setTimeout(function(){var v=document.getElementById('hetna-en-velo');if(v)v.remove()},1500)}}catch(e){}"
