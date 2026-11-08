<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reglas y Guía de Desarrollo del Proyecto

## 1. Stack Tecnológico

- **Framework:** Next.js 16 (App Router, _Cache Components_ / `use cache`).
- **Lenguaje:** TypeScript en modo estricto (`strict: true`, prohibido el uso de `any`).
- **Estilos:** Tailwind CSS v4.
- **Entorno de Ejecución:** Node.js 24.
- **Biblioteca UI:** React 19 (con `react-compiler` **desactivado**).

## 2. Metodología y Flujo de Trabajo

- **Planificación previa (Spec-Driven):** Antes de modificar la arquitectura o tocar múltiples archivos, presenta una breve especificación del plan de cambios.
- **Estrategia de Ramas y PRs:** Nunca apliques cambios directamente sobre la rama principal. Crea siempre una rama de trabajo usando la convención `feat/` (o `fix/`, `refactor/`) y genera la Pull Request correspondiente antes de modificar o integrar archivos base.
- **Convención de Commits:** Usa la nomenclatura estandarizada: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`.
- **Validación:** Comprueba tipos (`tsc --noEmit`), linter y tests antes de dar por finalizada una tarea.

## 3. Seguridad y Privacidad (Estricto)

- **Protección de Datos:** Bajo ningún concepto incluyas, transmitas o expongas el correo electrónico del usuario, tokens o datos sensibles en cabeceras HTTP (incluyendo la cabecera `User-Agent`), logs, código fuente o archivos de configuración.
- **Manejo de Credenciales:** Toda clave o secreto debe gestionarse únicamente a través de variables de entorno locales (`.env.local`) que nunca deben incluirse en el control de versiones.

## 4. Patrones de Código

- Diseña componentes modulares, legibles y fuertemente tipados.
- Implementa la estrategia de _Cache Components_ nativa de Next.js 16 para optimizar el renderizado y el consumo de datos.
- Deshabilita cualquier optimización implícita orientada a `react-compiler` manteniéndote en el modelo de ejecución estándar de React 19.

## Estándares de Diseño UX/UI

- **Mobile-First:** Diseña comenzando por la experiencia móvil y escala hacia pantallas grandes usando breakpoints nativos de Tailwind v4.
- **Jerarquía Visual y Espaciado:** Mantén escalas de espaciado basadas en múltiplos de 4 ( Tailwind `gap-2`, `p-4`, `space-y-6`). Usar jerarquías claras en títulos y textos secundarios.
- **Accesibilidad (A11y):** Todo elemento interactivo debe poseer estados `:focus-visible` claros, etiquetas `aria-label` en botones con íconos y contraste suficiente en texto.
- **Componentes Atómicos:** Separa la lógica de presentación de la lógica de datos. Usa componentes pequeños, reutilizables y limpios.
- **Micro-interacciones:** Agrega transiciones suaves (`transition-colors duration-200`, `active:scale-95`) para feedback inmediato de usuario.
