/** Donde se guarda el tema elegido; sin valor, sigue al sistema. */
export const THEME_KEY = "lineas-theme";

/** Aplica el tema guardado antes de pintar, para que no parpadee el del sistema. Va en el <head> del layout. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;
