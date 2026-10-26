"use client";

import { useState } from "react";
import { coverColors } from "@/components/book-cover";
import { ChevronDownIcon } from "@/components/icons";
import { describeTimeJump, otherEnd } from "@/lib/graph/queries";
import { EDGE_META } from "@/lib/graph/labels";
import { ConfidenceBadge, EdgeTypeBadge } from "./connection-badges";
import type { GraphModel, ViewState } from "./model";

/**
 * El recorrido en mobile: una línea de tiempo vertical. Cada parada se puede
 * desplegar para ver con qué más conecta dentro del mapa.
 */
export function PathTimeline({ model, view }: { model: GraphModel; view: ViewState }) {
  const { index } = model;
  const [open, setOpen] = useState<string | null>(null);
  const pathEdgeIds = new Set(view.steps.map((e) => e.id));

  return (
    <ol className="mt-5">
      {view.rec.path.map((id, k) => {
        const node = index.nodes.get(id)!;
        const next = k < view.rec.path.length - 1 ? index.nodes.get(view.rec.path[k + 1])! : null;
        const edge = next ? view.steps[k] : null;
        const isDest = id === view.rec.nodeId;
        const isOpen = open === id;
        const others = (index.edgesByNode.get(id) ?? []).filter((e) => !pathEdgeIds.has(e.id));
        const abstract = node.kind === "movement" || node.kind === "concept";

        return (
          <li key={id} className="flex gap-3">
            <div className="flex w-10 shrink-0 flex-col items-center">
              <span className="text-center text-[10px] leading-3 whitespace-nowrap text-muted">{node.era.label}</span>
              <span
                aria-hidden="true"
                className={`mt-1.5 shrink-0 rounded-full ${isDest ? "size-3.5 bg-accent" : node.isClue ? "size-2.5 bg-ink" : "size-2.5 border border-edge bg-surface"}`}
                style={{ boxShadow: "0 0 0 3px var(--bg)" }}
              />
              {next && <span aria-hidden="true" className="mt-1.5 w-0.5 flex-1 bg-accent/50" />}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : id)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                  node.isClue ? "border border-ink bg-ink text-bg" : "border border-line bg-surface",
                  isDest ? "border-2 !border-accent" : "",
                ].join(" ")}
              >
                {node.kind === "book" && <span aria-hidden="true" className="h-8 w-[22px] shrink-0 rounded-[2px]" style={{ background: coverColors(node.id).bg }} />}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`leading-tight ${node.kind === "book" || abstract ? "font-serif text-base" : "text-sm"} ${abstract ? "italic" : ""}`}>{node.label}</span>
                  <span className={`text-[11px] ${node.isClue ? "text-bg/80" : "text-muted"}`}>
                    {node.isClue ? "Tu pista · " : ""}
                    {node.subtitle}
                  </span>
                </span>
                <ChevronDownIcon size={14} className={`shrink-0 opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="animate-fade mt-2 rounded-xl bg-chip px-3 py-2.5">
                  <div className="text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">También conecta con</div>
                  {others.length === 0 && <p className="mt-1.5 text-xs text-muted">No tiene otras conexiones dentro de este mapa.</p>}
                  {others.map((other) => (
                    <div key={other.id} className="mt-2">
                      <div className="text-[13px] font-medium">
                        {index.nodes.get(otherEnd(other, id))?.label}{" "}
                        <span className="text-[11px] font-normal text-muted">· {EDGE_META[other.type].label}</span>
                      </div>
                      <div className="mt-0.5 text-xs leading-snug text-muted">{other.summary}</div>
                    </div>
                  ))}
                </div>
              )}

              {edge && next && (
                <div className="pt-3.5 pb-[22px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-ink">
                      {k + 1}
                    </span>
                    <EdgeTypeBadge type={edge.type} />
                    <span className="text-[11px] text-muted">{describeTimeJump(node, next)}</span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed">{edge.explanation}</p>
                  <div className="mt-1.5">
                    <ConfidenceBadge confidence={edge.confidence} />
                  </div>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
