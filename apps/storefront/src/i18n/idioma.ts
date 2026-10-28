// Ajustes del idioma de la tienda (se usan en servidor y en navegador)
export const COOKIE_IDIOMA = "hetna_lang"

// Se ejecuta antes de pintar: si la pagina va a salir en ingles (el cliente
// eligio ingles, o entro a /us sin haber elegido idioma), la oculta un instante
// para que no vea el espanol parpadear (maximo 1.5 s).
export const SCRIPT_VELO =
  "try{var c=document.cookie;if(c.indexOf('" +
  COOKIE_IDIOMA +
  "=en')>-1||(c.indexOf('" +
  COOKIE_IDIOMA +
  "=')<0&&/^\\/us(\\/|$)/.test(location.pathname))){document.documentElement.lang='en-US';var s=document.createElement('style');s.id='hetna-en-velo';" +
  "s.textContent='body{opacity:0!important}';document.head.appendChild(s);" +
  "setTimeout(function(){var v=document.getElementById('hetna-en-velo');if(v)v.remove()},1500)}}catch(e){}"
