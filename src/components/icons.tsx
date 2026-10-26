import type { SVGProps } from "react";
import type { ClueKind } from "@/lib/graph/schema";

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

export function ClueKindIcon({ kind, ...p }: IconProps & { kind: ClueKind }) {
  switch (kind) {
    case "book":
      return (
        <Icon {...p}>
          <path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z" />
          <path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" />
        </Icon>
      );
    case "author":
      return <UserIcon {...p} />;
    case "quote":
      return (
        <Icon {...p}>
          <path d="M5 7h5v5c0 3-1.5 5-4 6" />
          <path d="M14 7h5v5c0 3-1.5 5-4 6" />
        </Icon>
      );
    case "movement":
      return (
        <Icon {...p}>
          <path d="M12 3 3 8l9 5 9-5z" />
          <path d="m3 13 9 5 9-5" />
        </Icon>
      );
    case "style":
      return <PenIcon {...p} />;
    case "feeling":
      return (
        <Icon {...p}>
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
        </Icon>
      );
    case "idea":
      return (
        <Icon {...p}>
          <path d="M9 18h6" />
          <path d="M10 21h4" />
          <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
        </Icon>
      );
  }
}
