import { ViewTransition, type ReactNode } from "react";

/**
 * El paso entre pantallas: lo que se va se desvanece rápido y lo nuevo llega
 * con un leve ascenso. El encabezado no se desvanece: se desliza a su lugar
 * (ver site-header y globals.css), así el cambio de ancho entre pantallas no
 * es un salto. Los enlaces con el tipo «instant» (entre rincones de Explorar)
 * cambian sin efecto.
 *
 * Va en cada page.tsx: el layout persiste y ahí la transición nunca dispara.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={{ instant: "none", default: "page" }} exit={{ instant: "none", default: "page" }} default="none">
      {children}
    </ViewTransition>
  );
}
