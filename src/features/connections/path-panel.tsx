"use client";

import { ArrowLeftIcon } from "@/components/icons";
import { LANE_META, NODE_KIND_LABEL } from "@/lib/graph/labels";
import { otherEnd } from "@/lib/graph/queries";
import { useLineas } from "@/lib/store";
import { ConfidenceBadge, EdgeTypeBadge } from "./connection-badges";
import type { GraphModel, Selection, ViewState } from "./model";

interface PathPanelProps {
  model: GraphModel;
  view: ViewState;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  laneDot: string;
}

/** Panel lateral del mapa (desktop): el recorrido, un nodo o una conexión. */
export function PathPanel({ model, view, selection, onSelect, laneDot }: PathPanelProps) {
  const { index, graph } = model;
  const saved = useLineas((s) => s.saved);
  const toggleSaved = useLineas((s) => s.toggleSaved);
  const back = () => onSelect({ kind: "path" });

  if (selection.kind === "node") {
    const node = index.nodes.get(selection.id);
    if (!node) return null;
    const incident = index.edgesByNode.get(node.id) ?? [];
    return (
      <div key={node.id} className="animate-fade">
        <BackButton onClick={back} />
        <span className="mt-3 inline-block rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{NODE_KIND_LABEL[node.kind]}</span>
        <h2 className="mt-2.5 font-serif text-[26px] leading-[1.1]">{node.label}</h2>
        <p className="mt-1.5 text-xs text-muted">{[node.subtitle, node.era.label].filter(Boolean).join(" · ")}</p>
        <div className="mt-[22px] text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Conexiones en este mapa · {incident.length}</div>
        <div className="mt-2.5 flex flex-col gap-2">
          {incident.map((edge) => (
            <button
              key={edge.id}
              type="button"
              onClick={() => onSelect({ kind: "edge", id: edge.id })}
              className="rounded-xl border border-line px-3.5 py-3 text-left hover:bg-chip/60"
            >
              <span className="flex justify-between gap-2 text-[13px] font-medium">
                {index.nodes.get(otherEnd(edge, node.id))?.label}
                <EdgeTypeBadge type={edge.type} />
              </span>
              <span className="mt-1 block text-xs leading-normal text-muted">{edge.summary}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (selection.kind === "edge") {
    const edge = graph.edges.find((e) => e.id === selection.id);
    if (!edge) return null;
    const from = index.nodes.get(edge.source)!;
    const to = index.nodes.get(edge.target)!;
    return (
      <div key={edge.id} className="animate-fade">
        <BackButton onClick={back} />
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <EdgeTypeBadge type={edge.type} />
          <ConfidenceBadge confidence={edge.confidence} />
        </div>
        <h2 className="mt-2.5 font-serif text-2xl leading-[1.15]">
          {from.label} → {to.label}
        </h2>
        <p className="mt-1.5 text-xs text-muted">
          {from.era.label} → {to.era.label}
        </p>
        {edge.quote && <blockquote className="mt-4 border-l-0 font-serif text-lg leading-snug italic">«{edge.quote}»</blockquote>}
        <p className="mt-4 text-sm leading-relaxed">{edge.explanation}</p>
      </div>
    );
  }

  const rec = view.rec;
  const target = index.nodes.get(rec.nodeId)!;
  const isSaved = !!saved[target.id];
  return (
    <div key={rec.nodeId} className="animate-fade">
      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ background: laneDot }} />
        {LANE_META[rec.lane].label}
      </div>
      <h2 className="mt-2.5 font-serif text-[26px] leading-[1.1]">{target.label}</h2>
      <p className="mt-1.5 text-xs text-muted">
        {view.steps.length} {view.steps.length === 1 ? "salto" : "saltos"} · de {index.nodes.get(rec.path[0])?.label} a {target.label}
      </p>

      <ol className="mt-5 flex flex-col gap-[18px]">
        {view.steps.map((edge, i) => (
          <li key={edge.id} className="flex gap-3">
            <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink">
              {i + 1}
            </span>
            <div className="min-w-0">
              <button type="button" onClick={() => onSelect({ kind: "edge", id: edge.id })} className="text-left text-[13px] leading-snug font-medium hover:underline">
                {index.nodes.get(rec.path[i])?.label} → {index.nodes.get(rec.path[i + 1])?.label}
              </button>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <EdgeTypeBadge type={edge.type} />
                <ConfidenceBadge confidence={edge.confidence} />
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed">{edge.explanation}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 rounded-xl bg-chip px-4 py-3.5">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">En una frase</div>
        <p className="mt-1.5 font-serif text-base leading-snug">{rec.pathSummary}</p>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          aria-pressed={isSaved}
          onClick={() => toggleSaved(target.id)}
          className={`h-[42px] flex-1 rounded-full border border-accent text-[13px] font-medium ${isSaved ? "text-accent" : "bg-accent text-accent-ink"}`}
        >
          {isSaved ? "Guardado ✓" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 py-1.5 text-xs text-muted hover:text-ink">
      <ArrowLeftIcon size={12} strokeWidth={2} />
      Volver al recorrido
    </button>
  );
}
