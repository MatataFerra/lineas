import type { SVGProps } from "react";
import type { ClueKind, NodeKind } from "@/lib/graph/schema";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, strokeWidth = 1.6, children, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) => (
  <Icon strokeWidth={1.8} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon strokeWidth={1.8} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const ArrowLeftIcon = (p: IconProps) => (
  <Icon strokeWidth={1.8} {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);
export const CheckIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon strokeWidth={1.8} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);
export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);
export const UserIcon = (p: IconProps) => (
  <Icon strokeWidth={1.5} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Icon>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Icon strokeWidth={1.8} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
export const ExpandIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
  </Icon>
);
export const PenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z" />
    <path d="M14 6l3 3" />
  </Icon>
);

/*
 * Íconos de pistas y nodos: trazo a mano, como en la ilustración. Las líneas no
 * son rectas ni cierran perfecto a propósito; el grosor es un poco menor que el
 * de los íconos de interfaz.
 */
function HandIcon(p: IconProps) {
  return <Icon strokeWidth={1.45} {...p} />;
}

export function ClueKindIcon({ kind, ...p }: IconProps & { kind: ClueKind }) {
  switch (kind) {
    case "book":
      return (
        <HandIcon {...p}>
          <path d="M6.9 3.5c3.5-.3 7-.2 10.4.1.4 5.6.3 11.3-.1 16.9-3.4.3-6.8.2-10.2 0-.4-5.7-.4-11.4-.1-17z" />
          <path d="M9.5 3.7c-.3 5.6-.2 11.2.2 16.7" />
          <path d="M17.4 3.8l1.7 1.2c.3 5.2.2 10.4-.1 15.6l-1.7.1" />
        </HandIcon>
      );
    case "author":
      return (
        <HandIcon {...p}>
          <path d="M12.3 3.6c2.2.1 3.6 1.8 3.4 3.9-.2 2.1-1.9 3.6-3.9 3.4-2-.1-3.4-1.8-3.3-3.8.2-2.1 1.7-3.6 3.8-3.5z" />
          <path d="M10.6 10.6c-2.9.8-5 3.4-5.2 6.6 0 1 .1 2 .3 3" />
          <path d="M13.6 10.7c2.8.7 4.9 3.3 5 6.4 0 1-.1 2-.4 3" />
          <path d="M5.5 20.3c4.4.3 8.8.3 13.3-.1" />
        </HandIcon>
      );
    case "quote":
      return (
        <HandIcon {...p}>
          <path d="M10.2 7.6c-2-.5-3.9.6-4.1 2.5-.2 1.6.9 2.9 2.5 2.8 1.3 0 1.7 1.2 1.1 2.4-.6 1.2-1.9 2-3.2 2.3" />
          <path d="M18.4 7.6c-2-.5-3.9.6-4.1 2.5-.2 1.6.9 2.9 2.5 2.8 1.3 0 1.7 1.2 1.1 2.4-.6 1.2-1.9 2-3.2 2.3" />
        </HandIcon>
      );
    case "movement":
      return (
        <HandIcon {...p}>
          <path d="M4.2 5.4c5.3-.4 10.6-.4 15.8 0 .3 3.5.3 7-.1 10.5-3.5.2-7 .3-10.5.2l-3.4 3.2.2-3.3H4.1c-.3-3.6-.3-7.1.1-10.6z" />
          <path d="M8.3 9.3c1.6-.1 3.2-.1 4.8 0" />
          <path d="M8.4 12.3c2.4-.1 4.8-.1 7.2 0" />
          <path d="M15.9 8.9v.6" />
        </HandIcon>
      );
    case "style":
      return (
        <HandIcon {...p}>
          <path d="M5.6 14.7c2.9-3.4 6-6.7 9.2-9.8 1.2-1.1 3-1 4 .3 1 1.2.9 2.9-.2 4-3.1 3.2-6.4 6.2-9.8 9.1-1.2 1-3 .9-4-.3-.9-1-.9-2.4-.1-3.3z" />
          <path d="M8 12.1c1.3 1 2.5 2.2 3.6 3.5" />
          <path d="M16.3 7.4l.2.2" />
        </HandIcon>
      );
    case "feeling":
      return (
        <HandIcon {...p}>
          <path d="M12 4.1c4.6-.1 8.3 3.5 8.3 8.1.1 4.7-3.6 8.4-8.3 8.5-4.5.1-8.2-3.5-8.3-8.1-.1-4.6 3.6-8.4 8.3-8.5z" />
          <path d="M10.7 4.2c.1-1 .6-1.7 1.3-1.7.8 0 1.3.7 1.3 1.6" />
          <path d="M12 16.2c-2.3-1.5-3.8-3-3.8-4.7 0-1.2.9-2.1 2-2.1.8 0 1.5.4 1.8 1.1.4-.7 1.1-1.1 1.9-1.1 1.1 0 1.9.9 1.9 2.1 0 1.7-1.5 3.2-3.8 4.7z" />
        </HandIcon>
      );
    case "idea":
      return (
        <HandIcon {...p}>
          <path d="M10.2 12.6V5.3c0-.9.7-1.7 1.6-1.7.9 0 1.6.8 1.6 1.7v6.1" />
          <path d="M13.4 11c0-.8.7-1.3 1.5-1.3s1.4.6 1.4 1.4v1.2c.1-.7.7-1.2 1.4-1.1.8 0 1.4.6 1.4 1.4v2.8c0 3.4-2.6 5.9-5.9 5.9h-1.2c-2 0-3.6-.9-4.7-2.6l-2-3.2c-.4-.7-.2-1.6.5-2 .6-.4 1.5-.3 1.9.3l1.9 2" />
        </HandIcon>
      );
  }
}

/** Para los nodos del mapa: un libro, una persona, un movimiento, otra arte o una idea. */
export function NodeKindIcon({ kind, ...p }: IconProps & { kind: NodeKind }) {
  switch (kind) {
    case "book":
      return <ClueKindIcon kind="book" {...p} />;
    case "person":
      return <ClueKindIcon kind="author" {...p} />;
    case "movement":
      return <ClueKindIcon kind="movement" {...p} />;
    case "art":
      return (
        <HandIcon {...p}>
          <path d="M9.3 17.3V6.4c3.2-.8 6.4-1.6 9.6-2.3v10.6" />
          <path d="M9.4 9.6c3.1-.8 6.3-1.5 9.4-2.2" />
          <path d="M9.2 17.2c.1 1.4-1 2.5-2.5 2.5-1.3 0-2.3-.8-2.3-2 0-1.3 1.1-2.3 2.5-2.3 1.2 0 2.2.7 2.3 1.8z" />
          <path d="M18.9 14.6c.1 1.4-1 2.5-2.5 2.5-1.3 0-2.3-.8-2.3-2 0-1.3 1.1-2.3 2.5-2.3 1.2 0 2.2.7 2.3 1.8z" />
        </HandIcon>
      );
    case "concept":
      return (
        <HandIcon {...p}>
          <path d="M12.4 12.2c-.6-.8-.2-2 .8-2.2 1.4-.3 2.5 1 2.3 2.4-.3 2-2.3 3.1-4.2 2.6-2.5-.6-3.7-3.3-3-5.6.9-2.9 4.2-4.4 7-3.5 3.4 1.1 5 4.9 3.9 8.2-1.3 3.9-5.7 5.7-9.5 4.4" />
        </HandIcon>
      );
  }
}
