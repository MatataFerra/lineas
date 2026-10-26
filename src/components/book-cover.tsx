const PALETTE: { bg: string; ink: string }[] = [
  { bg: "#b8432e", ink: "#f4f0e8" },
  { bg: "#2f4a5c", ink: "#f4f0e8" },
  { bg: "#2a2723", ink: "#f4f0e8" },
  { bg: "#c49a5a", ink: "#1e1c19" },
  { bg: "#3d6a8a", ink: "#f4f0e8" },
  { bg: "#5c6b4a", ink: "#f4f0e8" },
  { bg: "#8a3b52", ink: "#f4f0e8" },
  { bg: "#d8cbb4", ink: "#1e1c19" },
  { bg: "#6b5b3e", ink: "#f4f0e8" },
];

/** Color estable por id: el mismo libro siempre tiene la misma portada. */
export function coverColors(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const SIZES = {
  xs: { box: "h-[18px] w-3 rounded-[1px]", title: "hidden", author: "hidden" },
  sm: { box: "h-[58px] w-10 rounded-[2px] p-1.5", title: "text-[15px]", author: "hidden" },
  md: { box: "h-[170px] w-[116px] rounded-[3px] px-[11px] py-3.5", title: "text-[17px]", author: "text-[9px]" },
  lg: { box: "h-[220px] w-[150px] rounded-[3px] px-3.5 py-[18px]", title: "text-[22px]", author: "text-[10px]" },
};

/**
 * Portada tipográfica provisoria. Cuando el libro venga verificado de un
 * catálogo con `coverUrl`, se reemplaza por la imagen real.
 */
export function BookCover({ id, title, author, size }: { id: string; title: string; author?: string; size: keyof typeof SIZES }) {
  const colors = coverColors(id);
  const s = SIZES[size];
  const initialOnly = size === "sm";
  return (
    <span
      aria-hidden="true"
      className={`box-border flex shrink-0 flex-col shadow-[0_1px_2px_rgba(0,0,0,0.12),0_10px_20px_rgba(0,0,0,0.08)] ${s.box} ${initialOnly ? "justify-end" : "justify-between"}`}
      style={{ background: colors.bg, color: colors.ink }}
    >
      <span className={`font-serif leading-[1.05] ${s.title}`}>{initialOnly ? title.charAt(0) : title}</span>
      {author && <span className={`uppercase tracking-[0.06em] opacity-85 ${s.author}`}>{author}</span>}
    </span>
  );
}
