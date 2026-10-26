"use client";

import { coverColors } from "@/components/book-cover";
import { EDGE_META } from "@/lib/graph/labels";
import type { GraphNode } from "@/lib/graph/schema";
import type { GraphModel, Selection, ViewState } from "./model";

interface GraphCanvasProps {
  model: GraphModel;
  view: ViewState;
  selection: Selection;
  /** Sin handlers, el mapa es solo de lectura (mapa completo en mobile). */
  onSelect?: (selection: Selection) => void;
}

/**
 * El mapa: nodos ubicados en una línea de tiempo y aristas tipadas.
 * Las aristas van en un único <svg> debajo; los nodos son botones HTML encima.
 */
export function GraphCanvas({ model, view, selection, onSelect }: GraphCanvasProps) {
  const { layout, geometry, graph } = model;
  const { width, height, nodeWidth, nodeHeight } = layout.options;
  const interactive = !!onSelect;
  const destId = view.rec.nodeId;
  const showBadges = selection.kind === "path";

  return (
    <div className="relative mx-auto" style={{ width, height: height + 30 }}>
      {layout.ticks.map((tick) => (
        <div key={tick.label} aria-hidden="true">
          <div className="absolute top-6 w-px bg-grid" style={{ left: tick.x, height: height - 24 }} />
          <div className="absolute w-[60px] text-center text-[11px] text-muted" style={{ left: tick.x - 30, top: height + 8 }}>
            {tick.label}
          </div>
        </div>
      ))}

      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
        <defs>
          <marker id="arrow-muted" viewBox="0 0 8 8" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" className="fill-edge" />
          </marker>
          <marker id="arrow-accent" viewBox="0 0 8 8" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" className="fill-accent" />
          </marker>
        </defs>
        {view.visibleEdges.map((edge) => {
          const geo = geometry.get(edge.id);
          if (!geo) return null;
          const meta = EDGE_META[edge.type];
          const hi = view.highlightEdges.has(edge.id);
          return (
            <g key={edge.id} className="transition-opacity duration-300" style={{ opacity: hi ? 1 : 0.45 }}>
              <path
                d={geo.d}
                fill="none"
                className={hi ? "stroke-accent" : "stroke-edge"}
                strokeWidth={hi ? meta.width + 1 : meta.width}
                strokeDasharray={meta.dash}
                strokeLinecap="round"
                markerEnd={meta.arrow ? `url(#${hi ? "arrow-accent" : "arrow-muted"})` : undefined}
              />
              {interactive && (
                <path
                  d={geo.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  pointerEvents="stroke"
                  className="cursor-pointer"
                  onClick={() => onSelect({ kind: "edge", id: edge.id })}
                />
              )}
            </g>
          );
        })}
      </svg>

      {graph.nodes
        .filter((node) => view.visibleNodes.has(node.id))
        .map((node) => {
          const pos = layout.positions.get(node.id)!;
          const selected = selection.kind === "node" && selection.id === node.id;
          const style = {
            left: pos.x - nodeWidth / 2,
            top: pos.y - nodeHeight / 2,
            width: nodeWidth,
            height: nodeHeight,
            opacity: view.highlightNodes.has(node.id) ? 1 : 0.38,
          };
          const className = nodeClass(node, node.id === destId, selected);
          const content = <NodeContent node={node} />;
          return interactive ? (
            <button
              key={node.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected ? { kind: "path" } : { kind: "node", id: node.id })}
              className={`${className} transition-[opacity,transform,box-shadow] duration-200 hover:-translate-y-px`}
              style={style}
            >
              {content}
            </button>
          ) : (
            <div key={node.id} className={className} style={style}>
              {content}
            </div>
          );
        })}

      {showBadges &&
        view.steps.map((edge, i) => {
          const geo = geometry.get(edge.id);
          if (!geo) return null;
          return (
            <div
              key={edge.id}
              aria-hidden="true"
              className="animate-fade pointer-events-none absolute flex size-[22px] items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink shadow-[0_0_0_3px_var(--surface)]"
              style={{ left: Math.round(geo.mid.x - 11), top: Math.round(geo.mid.y - 11) }}
            >
              {i + 1}
            </div>
          );
        })}
    </div>
  );
}

function nodeClass(node: GraphNode, isDest: boolean, selected: boolean): string {
  const base = "absolute box-border flex items-center gap-2 px-2.5 py-1.5 text-left";
  const shape = node.kind === "person" || node.kind === "art" ? "rounded-full" : "rounded-md";
  const abstract = node.kind === "movement" || node.kind === "concept";
  const skin = node.isClue
    ? "border border-ink bg-ink text-bg"
    : abstract
      ? "border border-dashed border-line bg-bg text-ink"
      : "border border-line bg-surface text-ink";
  const dest = isDest ? "border-2 !border-accent" : "";
  const ring = selected ? "ring-[3px] ring-accent" : "shadow-[0_4px_14px_rgba(0,0,0,0.06)]";
  return [base, shape, skin, dest, ring].join(" ");
}

function NodeContent({ node }: { node: GraphNode }) {
  const abstract = node.kind === "movement" || node.kind === "concept";
  const serif = node.kind === "book" || abstract;
  return (
    <>
      {node.kind === "book" && (
        <span aria-hidden="true" className="h-[18px] w-3 shrink-0 rounded-[1px]" style={{ background: coverColors(node.id).bg }} />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`line-clamp-2 leading-[1.15] ${serif ? "font-serif" : "font-sans"} ${abstract ? "text-[15px] italic" : node.kind === "book" ? "text-[13.5px]" : "text-[12.5px]"}`}>
          {node.label}
        </span>
        <span className={`truncate text-[10px] leading-[1.2] ${node.isClue ? "text-bg/80" : "text-muted"}`}>
          {nodeCaption(node)}
        </span>
      </span>
    </>
  );
}

function nodeCaption(node: GraphNode): string {
  const parts: string[] = [];
  if (node.isClue) parts.push("Tu pista");
  if (node.kind === "book" && node.book?.author) parts.push(node.book.author.split(" ").at(-1)!);
  parts.push(node.era.label);
  return parts.join(" · ");
}
