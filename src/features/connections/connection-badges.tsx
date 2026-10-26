import { CONFIDENCE_META, EDGE_META } from "@/lib/graph/labels";
import type { Confidence, EdgeType } from "@/lib/graph/schema";

export function EdgeTypeBadge({ type }: { type: EdgeType }) {
  return <span className="inline-block rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{EDGE_META[type].label}</span>;
}

const CONFIDENCE_DOT: Record<Confidence, string> = {
  documented: "bg-ink",
  scholarly: "bg-[linear-gradient(90deg,var(--ink)_50%,transparent_50%)] border border-ink",
  interpretive: "border border-ink",
};

/** Qué tan firme es la conexión: el mapa no presenta una interpretación como un hecho. */
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const meta = CONFIDENCE_META[confidence];
  return (
    <span title={meta.hint} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      <span aria-hidden="true" className={`size-2 rounded-full ${CONFIDENCE_DOT[confidence]}`} />
      {meta.label}
    </span>
  );
}
