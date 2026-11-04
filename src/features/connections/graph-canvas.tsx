"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { Portrait } from "@/components/portrait";
import { NODE_KIND_LABEL } from "@/lib/graph/labels";
import { RADIAL, radialEdge, radialLayout } from "@/lib/graph/radial";
import type { GraphNode } from "@/lib/graph/schema";
import type { GraphModel, Selection, ViewState } from "./model";

const MIN_WIDTH = 640;

interface GraphCanvasProps {
  model: GraphModel;
  view: ViewState;
  selection: Selection;
  /** Sin handlers, el mapa es solo de lectura (mapa completo en mobile). */
  onSelect?: (selection: Selection) => void;
}

/**
 * El mapa como constelación: el libro del recorrido en el centro, las personas,
 * movimientos e ideas en un arco arriba y los libros abajo, de lo más antiguo
 * a lo más nuevo. Las aristas van en un <svg> debajo; los nodos son botones HTML encima.
 */
export function GraphCanvas({ model, view, selection, onSelect }: GraphCanvasProps) {
  const { graph } = model;
  const focusId = view.rec.nodeId;
  // El mapa toma el ancho del contenedor; por debajo de MIN_WIDTH se dibuja a ese ancho y se achica entero.
  const box = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const width = available ? Math.max(available, MIN_WIDTH) : RADIAL.width;
  const scale = available ? Math.min(1, available / width) : 1;
  const layout = useMemo(() => radialLayout(graph.nodes, focusId, view.visibleNodes, width), [graph.nodes, focusId, view.visibleNodes, width]);
  const center = layout.positions.get(focusId)!;
  const interactive = !!onSelect;
  const showSteps = selection.kind === "path";

  const edges = view.visibleEdges.flatMap((edge) => {
    const a = layout.positions.get(edge.source);
    const b = layout.positions.get(edge.target);
    return a && b ? [{ edge, ...radialEdge(a, b, center) }] : [];
  });

  return (
    <div ref={box} className="w-full" style={{ height: layout.height * scale }}>
      <div className="relative origin-top-left" style={{ width: layout.width, height: layout.height, transform: scale < 1 ? `scale(${scale})` : undefined }}>
        <svg width={layout.width} height={layout.height} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
          {/* El halo del libro elegido: un anillo fino con dos marcas que orbitan despacio y un eco que respira. */}
          <g className="animate-orbit" style={{ transformOrigin: `${center.x}px ${center.y}px` }}>
            <circle cx={center.x} cy={center.y} r={RADIAL.focus / 2 + 14} fill="none" className="stroke-accent/25" strokeWidth={1} />
            <circle cx={center.x} cy={center.y - RADIAL.focus / 2 - 14} r={2.5} className="fill-accent" />
            <circle cx={center.x} cy={center.y + RADIAL.focus / 2 + 14} r={2.5} className="fill-accent" />
          </g>
          <circle
            cx={center.x}
            cy={center.y}
            r={RADIAL.focus / 2 + 26}
            fill="none"
            className="animate-breathe stroke-accent/20"
            strokeWidth={1}
            strokeDasharray="2 6"
            style={{ transformOrigin: `${center.x}px ${center.y}px` }}
          />
          {edges.map(({ edge, d }) => {
            const hi = view.highlightEdges.has(edge.id);
            return (
              <g key={edge.id} className="transition-opacity duration-300" style={{ opacity: hi ? 1 : 0.7 }}>
                <path d={d} fill="none" className={hi ? "stroke-accent" : "stroke-edge/60"} strokeWidth={hi ? 1.6 : 1} strokeLinecap="round" />
                {interactive && (
                  <path
                    d={d}
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
          .filter((node) => layout.positions.has(node.id))
          .map((node) => {
            const pos = layout.positions.get(node.id)!;
            const size = layout.sizes.get(node.id)!;
            const selected = selection.kind === "node" && selection.id === node.id;
            const isFocus = node.id === focusId;
            const style = {
              left: pos.x - size.w / 2,
              top: pos.y - size.h / 2,
              width: size.w,
              height: size.h,
            };
            // El nodo queda opaco (tapa las líneas que pasan detrás); lo que se atenúa es su contenido.
            const dim = !isFocus && !view.highlightNodes.has(node.id);
            const className = nodeClass(node, isFocus, selected);
            const inner = isFocus ? <FocusContent node={node} /> : node.kind === "book" ? <BookContent node={node} /> : <CardContent node={node} />;
            const content = <span className={`contents transition-opacity ${dim ? "[&>*]:opacity-45" : ""}`}>{inner}</span>;
            return interactive ? (
              <button
                key={node.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${node.label}${node.isClue ? " (tu pista)" : ""}`}
                onClick={() => onSelect(selected ? { kind: "path" } : { kind: "node", id: node.id })}
                className={`${className} transition-[opacity,box-shadow] duration-200`}
                style={style}>
                {content}
              </button>
            ) : (
              <div key={node.id} className={className} style={style}>
                {content}
              </div>
            );
          })}

        {showSteps &&
          view.steps.map((step, i) => {
            const found = edges.find((e) => e.edge.id === step.id);
            if (!found) return null;
            return (
              <div
                key={step.id}
                aria-hidden="true"
                className="animate-fade pointer-events-none absolute flex size-[22px] items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink shadow-[0_0_0_3px_var(--surface)]"
                style={{ left: Math.round(found.mid.x - 11), top: Math.round(found.mid.y - 11) }}>
                {i + 1}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function nodeClass(node: GraphNode, isFocus: boolean, selected: boolean): string {
  const ring = selected ? "ring-[3px] ring-accent/70" : "";
  if (isFocus) return `absolute flex items-center justify-center rounded-full bg-accent p-4 text-center text-accent-ink shadow-[0_10px_30px_rgba(201,64,42,0.25)] ${ring}`;
  const skin = node.isClue ? "border-ink/70" : "border-line";
  const base = "absolute box-border border bg-surface text-ink shadow-[0_6px_18px_rgba(30,28,25,0.06)] hover:border-ink/40";
  return node.kind === "book"
    ? `${base} ${skin} flex flex-col items-center gap-2 rounded-2xl px-2 pt-3 pb-2 ${ring}`
    : `${base} ${skin} flex items-center gap-3 rounded-2xl px-3 text-left ${ring}`;
}

function FocusContent({ node }: { node: GraphNode }) {
  return <span className="line-clamp-3 font-serif text-[19px] leading-[1.1]">{node.label}</span>;
}

function CardContent({ node }: { node: GraphNode }) {
  return (
    <>
      <Portrait node={node} size={38} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`line-clamp-2 font-serif text-[14px] leading-[1.15] ${node.kind === "concept" ? "italic" : ""}`}>{node.label}</span>
        <span className="truncate text-[11px] text-muted">{node.isClue ? "Tu pista" : NODE_KIND_LABEL[node.kind]} · {node.era.label}</span>
      </span>
    </>
  );
}

function BookContent({ node }: { node: GraphNode }) {
  const author = node.book?.author ?? node.subtitle ?? "";
  return (
    <>
      <BookCover id={node.id} title={node.label} author={author} size="graph" coverUrl={node.book?.coverUrl} />
      <span className="flex w-full min-w-0 flex-col items-center gap-0.5 text-center">
        <span className="line-clamp-2 font-serif text-[13px] leading-[1.15]">{node.label}</span>
        <span className="w-full truncate text-[10.5px] text-muted">{node.isClue ? "Tu pista" : author}</span>
      </span>
    </>
  );
}
