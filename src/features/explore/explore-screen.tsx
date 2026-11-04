"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { GraphCanvas, type CanvasView } from "@/features/connections/graph-canvas";
import type { Selection } from "@/features/connections/model";
import { authorHref, bookHref } from "@/lib/authors/link";
import { RINCON_GROUPS, type Rincon, type RinconGroup } from "@/lib/explore/rincon";
import { CONFIDENCE_META, EDGE_META, NODE_KIND_LABEL } from "@/lib/graph/labels";
import { otherEnd } from "@/lib/graph/queries";
import type { GraphNode } from "@/lib/graph/schema";

type Bridges = Record<string, { slug: string; title: string }[]>;

interface ExploreScreenProps {
  rincon: Rincon;
  list: { slug: string; title: string; group: RinconGroup }[];
  bridges: Bridges;
}

/**
 * Un rincón: la lista de rincones al costado, el tema en el centro del mapa y,
 * al tocar algo, por qué está acá y en qué otros rincones aparece. Esos
 * puentes son la manera de seguir explorando sin buscar nada.
 */
export function ExploreScreen({ rincon, list, bridges }: ExploreScreenProps) {
  const [selection, setSelection] = useState<Selection>({ kind: "path" });
  const view = useMemo(() => canvasView(rincon, selection), [rincon, selection]);
  const selectedNode = selection.kind === "node" ? rincon.nodes.find((n) => n.id === selection.id) : undefined;
  const selectedEdge = selection.kind === "edge" ? rincon.edges.find((e) => e.id === selection.id) : undefined;

  // Los rincones a los que se puede saltar desde éste, con lo que los une.
  const onward = useMemo(() => {
    const by = new Map<string, { slug: string; title: string; via: string[] }>();
    for (const node of rincon.nodes) {
      for (const b of bridges[node.id] ?? []) {
        const entry = by.get(b.slug) ?? { ...b, via: [] };
        entry.via.push(node.label);
        by.set(b.slug, entry);
      }
    }
    return [...by.values()].sort((a, b) => b.via.length - a.via.length);
  }, [rincon, bridges]);

  return (
    <div className="min-h-dvh px-[22px] pt-5 pb-16 md:px-14 md:pt-7">
      <div className="mx-auto max-w-[1320px]">
        <SiteHeader />

        <div className="mt-6 lg:mt-10 lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-12">
          <RinconNav list={list} current={rincon.slug} />

          <main className="min-w-0">
            <Link href="/explorar" className="inline-flex items-center gap-2 py-2 text-[13px] text-muted hover:text-ink lg:hidden">
              <ArrowLeftIcon size={14} />
              Todos los rincones
            </Link>
            <p className="mt-3 text-[13px] text-muted lg:mt-0">{RINCON_GROUPS.find((g) => g.id === rincon.group)?.one}</p>
            <h1 className="mt-1 font-serif text-[36px] leading-[1.06] tracking-[-0.01em] md:text-[48px]">{rincon.title}</h1>
            <p className="mt-3 max-w-[66ch] text-[15px] leading-relaxed text-muted">{rincon.intro}</p>

            <div className="mt-6 rounded-3xl border border-line bg-surface/60 px-2 py-4 md:mt-8 md:px-4">
              <GraphCanvas nodes={rincon.nodes} focusId={rincon.centerId} view={view} selection={selection} onSelect={setSelection} />
            </div>

            <div className="mt-6 grid gap-8 md:mt-8 md:grid-cols-[minmax(0,1fr)_300px] md:gap-12">
              <section aria-live="polite" className="min-w-0">
                {selectedNode ? (
                  <NodeDetail rincon={rincon} node={selectedNode} bridges={bridges[selectedNode.id] ?? []} onSelect={setSelection} />
                ) : selectedEdge ? (
                  <EdgeDetail rincon={rincon} edgeId={selectedEdge.id} onSelect={setSelection} />
                ) : (
                  <p className="font-serif text-[19px] leading-snug text-muted">Tocá un libro, una persona o una línea para ver por qué está en este rincón.</p>
                )}
              </section>

              {onward.length > 0 && (
                <aside aria-labelledby="onward-title">
                  <h2 id="onward-title" className="font-serif text-[19px]">
                    Seguir por
                  </h2>
                  <ul className="mt-3 flex flex-col">
                    {onward.slice(0, 6).map((r) => (
                      <li key={r.slug} className="border-t border-line first:border-t-0">
                        <Link href={`/explorar/${r.slug}`} className="group flex items-center justify-between gap-3 py-3">
                          <span className="min-w-0">
                            <span className="block font-serif text-[16px] group-hover:underline group-hover:underline-offset-4">{r.title}</span>
                            <span className="block truncate text-[12px] text-muted">por {r.via.join(", ")}</span>
                          </span>
                          <ArrowRightIcon size={13} className="shrink-0 text-muted group-hover:text-ink" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </aside>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function RinconNav({ list, current }: { list: ExploreScreenProps["list"]; current: string }) {
  return (
    <nav aria-label="Rincones" className="hidden lg:block">
      <Link href="/explorar" className="font-serif text-[15px] hover:underline hover:underline-offset-4">
        Todos los rincones
      </Link>
      {RINCON_GROUPS.map((g) => (
        <div key={g.id} className="mt-6">
          <p className="text-[12px] text-muted">{g.label}</p>
          <ul className="mt-1.5 flex flex-col">
            {list
              .filter((r) => r.group === g.id)
              .map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/explorar/${r.slug}`}
                    aria-current={r.slug === current ? "page" : undefined}
                    className="-ml-2.5 block rounded-md px-2.5 py-1 text-[13.5px] hover:bg-chip aria-[current=page]:bg-ink aria-[current=page]:text-bg">
                    {r.title}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NodeDetail({ rincon, node, bridges, onSelect }: { rincon: Rincon; node: GraphNode; bridges: { slug: string; title: string }[]; onSelect: (s: Selection) => void }) {
  const edges = rincon.edges.filter((e) => e.source === node.id || e.target === node.id);
  const author = node.book?.author ?? node.subtitle ?? "";
  return (
    <div className="animate-fade">
      <p className="text-[12px] text-muted">
        {NODE_KIND_LABEL[node.kind]} · {node.era.label}
      </p>
      <h2 className="mt-1 font-serif text-[28px] leading-tight">{node.label}</h2>
      {node.subtitle && node.kind !== "book" && <p className="mt-1 text-sm text-muted">{node.subtitle}</p>}
      {node.kind === "book" && author && (
        <p className="mt-1 text-sm text-muted">
          <Link href={authorHref(author)} className="underline-offset-[3px] hover:text-ink hover:underline">
            {author}
          </Link>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        {node.kind === "book" && (
          <Link
            href={bookHref({ id: node.id, title: node.label, author, year: node.era.from, coverUrl: node.book?.coverUrl })}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-bg">
            Ver el libro
            <ArrowRightIcon size={13} />
          </Link>
        )}
        {node.kind === "person" && (
          <Link href={authorHref(node.label)} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-bg">
            Ver su vida y sus obras
            <ArrowRightIcon size={13} />
          </Link>
        )}
        <button type="button" onClick={() => onSelect({ kind: "path" })} className="h-10 rounded-full border border-line px-4 text-[13px] hover:bg-chip">
          Ver todo el rincón
        </button>
      </div>

      <ul className="mt-6 flex flex-col gap-4">
        {edges.map((edge) => {
          const other = rincon.nodes.find((n) => n.id === otherEnd(edge, node.id));
          return (
            <li key={edge.id} className="border-l-2 border-accent/50 pl-4">
              <button type="button" onClick={() => other && onSelect({ kind: "node", id: other.id })} className="font-serif text-[17px] hover:underline hover:underline-offset-4">
                {other?.label}
              </button>
              <p className="text-[12px] text-muted" title={CONFIDENCE_META[edge.confidence].hint}>
                {EDGE_META[edge.type].label} · {CONFIDENCE_META[edge.confidence].label}
              </p>
              <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed">{edge.explanation}</p>
              {edge.quote && <p className="mt-1.5 font-serif text-[15px] italic">«{edge.quote}»</p>}
            </li>
          );
        })}
      </ul>

      {bridges.length > 0 && (
        <p className="mt-6 text-[13px] text-muted">
          También aparece en{" "}
          {bridges.map((b, i) => (
            <span key={b.slug}>
              {i > 0 && (i === bridges.length - 1 ? " y " : ", ")}
              <Link href={`/explorar/${b.slug}`} className="text-ink underline underline-offset-[3px] hover:text-accent">
                {b.title}
              </Link>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}

function EdgeDetail({ rincon, edgeId, onSelect }: { rincon: Rincon; edgeId: string; onSelect: (s: Selection) => void }) {
  const edge = rincon.edges.find((e) => e.id === edgeId)!;
  const label = (id: string) => rincon.nodes.find((n) => n.id === id)?.label ?? id;
  return (
    <div className="animate-fade">
      <p className="text-[12px] text-muted" title={CONFIDENCE_META[edge.confidence].hint}>
        {EDGE_META[edge.type].label} · {CONFIDENCE_META[edge.confidence].label}
      </p>
      <h2 className="mt-1 font-serif text-[24px] leading-tight">
        <button type="button" onClick={() => onSelect({ kind: "node", id: edge.source })} className="hover:underline hover:underline-offset-4">
          {label(edge.source)}
        </button>
        <span className="text-muted"> y </span>
        <button type="button" onClick={() => onSelect({ kind: "node", id: edge.target })} className="hover:underline hover:underline-offset-4">
          {label(edge.target)}
        </button>
      </h2>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed">{edge.explanation}</p>
      {edge.quote && <p className="mt-2 font-serif text-[16px] italic">«{edge.quote}»</p>}
    </div>
  );
}

/** Todo visible; al elegir algo se ilumina lo suyo y el resto se atenúa. */
function canvasView(r: Rincon, selection: Selection): CanvasView {
  const all = new Set(r.nodes.map((n) => n.id));
  if (selection.kind === "node") {
    const incident = r.edges.filter((e) => e.source === selection.id || e.target === selection.id);
    return {
      visibleNodes: all,
      visibleEdges: r.edges,
      highlightEdges: new Set(incident.map((e) => e.id)),
      highlightNodes: new Set([selection.id, ...incident.flatMap((e) => [e.source, e.target])]),
      steps: [],
    };
  }
  if (selection.kind === "edge") {
    const edge = r.edges.find((e) => e.id === selection.id);
    return { visibleNodes: all, visibleEdges: r.edges, highlightEdges: new Set(edge ? [edge.id] : []), highlightNodes: new Set(edge ? [edge.source, edge.target] : []), steps: [] };
  }
  return { visibleNodes: all, visibleEdges: r.edges, highlightEdges: new Set(), highlightNodes: all, steps: [] };
}
