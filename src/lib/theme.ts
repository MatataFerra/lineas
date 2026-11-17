/** Donde se guarda el tema elegido; sin valor, sigue al sistema. */
export const THEME_KEY = "lineas-theme";

export type Theme = "light" | "dark";

/** El color de la barra del navegador en cada tema: el fondo de la página (--bg). */
export const THEME_COLORS: Record<Theme, string> = { light: "#f4f0e8", dark: "#151412" };

/** La etiqueta theme-color del tema forzado; sin ella, la barra sigue al sistema con las del layout. */
const FORCED_BAR_ID = "theme-color-forced";

/**
 * Aplica el tema guardado antes de pintar, para que no parpadee el del sistema. Va en el <head> del layout.
 * Pinta también la barra del navegador con una etiqueta theme-color propia, al principio del <head>: el
 * navegador usa la primera que coincide, y React no la conoce, así que no la reemplaza al hidratar.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")return;document.documentElement.dataset.theme=t;var m=document.createElement("meta");m.name="theme-color";m.id="${FORCED_BAR_ID}";m.content=${JSON.stringify(THEME_COLORS)}[t];document.head.prepend(m)}catch(e){}})()`;

/** Fuerza un tema en la página ya cargada: lo mismo que THEME_SCRIPT, al tocar el botón. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  let bar = document.getElementById(FORCED_BAR_ID) as HTMLMetaElement | null;
  if (!bar) {
    bar = document.createElement("meta");
    bar.name = "theme-color";
    bar.id = FORCED_BAR_ID;
    document.head.prepend(bar);
  }
  bar.content = THEME_COLORS[theme];
}
