"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CloseIcon, ExpandIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { EDGE_META, EDGE_ORDER, LANE_META, LANE_ORDER } from "@/lib/graph/labels";
import { GRAPH_LIMITS, type EdgeType, type Lane, type Recommendation } from "@/lib/graph/schema";
import { useLineas } from "@/lib/store";
import { GraphCanvas } from "./graph-canvas";
import { MiniMap } from "./mini-map";
import { buildModel, viewState, type GraphModel, type Selection, type ViewState } from "./model";
import { PathPanel } from "./path-panel";
import { PathTimeline } from "./path-timeline";

const LANE_DOT: Record<Lane, string> = { affinity: "var(--ink)", alternative: "var(--edge)", beyond: "var(--accent)" };

export function ConnectionsScreen() {
  const graph = useLineas((s) => s.graph);
  const status = useLineas((s) => s.status);
  const error = useLineas((s) => s.error);
  const search = useLineas((s) => s.search);
  const focus = useLineas((s) => s.focus);
  const setFocus = useLineas((s) => s.setFocus);

  useEffect(() => {
    void search();
  }, [search]);

  const [selection, setSelection] = useState<Selection>({ kind: "path" });
  const [maxHops, setMaxHops] = useState<number>(GRAPH_LIMITS.maxHops);
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<EdgeType>>(new Set());
  const [mapOpen, setMapOpen] = useState(false);

  const model = useMemo(() => (graph ? buildModel(graph) : null), [graph]);
  const recs = useMemo(
    () => (graph ? LANE_ORDER.flatMap((lane) => graph.recommendations.filter((r) => r.lane === lane)) : []),
    [graph],
  );
  // Sin foco elegido, mostramos el primer "fuera de tu mapa": es el recorrido más revelador.
  const rec = recs.find((r) => r.nodeId === focus) ?? recs.find((r) => r.lane === "beyond") ?? recs[0];

  const view = useMemo(
    () => (model && rec ? viewState(model, rec, selection, maxHops, hiddenTypes) : null),
    [model, rec, selection, maxHops, hiddenTypes],
  );

  const choose = (r: Recommendation) => {
    setFocus(r.nodeId);
    setSelection({ kind: "path" });
  };

  return (
    <div className="min-h-dvh px-[22px] pt-5 pb-12 lg:px-10 lg:pt-7">
      <div className="mx-auto max-w-[1240px]">
        <SiteHeader />

        <Link href="/resultados" className="mt-5 inline-flex items-center gap-2 py-2 text-[13px] text-muted hover:text-ink lg:mt-6">
          <ArrowLeftIcon size={14} />
          Volver a los resultados
        </Link>

        <div className="max-w-[640px]">
          <h1 className="mt-1.5 font-serif text-[30px] leading-[1.1] lg:text-[42px] lg:leading-[1.08]">Conexiones</h1>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted lg:text-[15px]">
            Cada recomendación tiene un recorrido. Elegí un libro y seguí el camino desde tus pistas hasta él: quién inspiró a quién, qué frase se repite,
            qué música suena de fondo.
          </p>
        </div>

        {status === "error" && (
          <div role="alert" className="mt-8 rounded-2xl border border-line bg-surface p-6 text-sm">
            {error}
            <button type="button" onClick={() => void search()} className="mt-4 block h-10 rounded-full bg-ink px-5 text-[13px] text-bg">
              Reintentar
            </button>
          </div>
        )}

        {status !== "error" && (!model || !view || !rec) && <p className="animate-soft-pulse mt-8 text-[13px] text-muted">Armando el mapa…</p>}

        {model && view && rec && (
          <>
            <div role="group" aria-label="Camino hacia" className="no-scrollbar -mx-[22px] mt-5 flex gap-2 overflow-x-auto px-[22px] lg:mx-0 lg:mt-6 lg:flex-wrap lg:items-center lg:px-0">
              <span className="hidden text-xs text-muted lg:mr-1 lg:inline">Camino hacia</span>
              {recs.map((r) => {
                const active = r.nodeId === rec.nodeId;
                return (
                  <button
                    key={r.nodeId}
                    type="button"
                    aria-pressed={active}
                    onClick={() => choose(r)}
                    className={`inline-flex h-[38px] shrink-0 items-center gap-2 rounded-full border pr-3.5 pl-3 text-[13px] whitespace-nowrap ${active ? "border-ink bg-ink text-bg" : "border-line hover:bg-chip"}`}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ background: LANE_DOT[r.lane], boxShadow: active ? "0 0 0 1.5px var(--bg)" : undefined }}
                    />
                    {model.index.nodes.get(r.nodeId)?.label}
                  </button>
                );
              })}
            </div>

            {/* Desktop: grafo + panel */}
            <div className="mt-[18px] hidden items-start gap-5 lg:flex">
              <section aria-label="Mapa" className="min-w-0 flex-[999_1_640px] overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="overflow-x-auto pt-2">
                  <GraphCanvas model={model} view={view} selection={selection} onSelect={setSelection} />
                </div>
                <MapControls
                  maxHops={maxHops}
                  onHops={setMaxHops}
                  hiddenTypes={hiddenTypes}
                  onToggleType={(type) =>
                    setHiddenTypes((prev) => {
                      const next = new Set(prev);
                      if (next.has(type)) next.delete(type);
                      else next.add(type);
                      return next;
                    })
                  }
                />
                <p className="px-4 pb-3.5 text-[11px] text-muted">
                  {view.visibleNodes.size} de {model.graph.nodes.length} nodos · hasta {maxHops} {maxHops === 1 ? "salto" : "saltos"} desde tus pistas · el eje del
                  tiempo se estira donde hay más conexiones
                </p>
              </section>
              <aside className="max-w-[360px] min-w-[300px] flex-[1_1_320px] rounded-2xl border border-line bg-surface p-[22px]">
                <PathPanel model={model} view={view} selection={selection} onSelect={setSelection} laneDot={LANE_DOT[rec.lane]} />
              </aside>
            </div>

            {/* Mobile y tablet: mini mapa + recorrido vertical */}
            <div className="lg:hidden">
              <div className="mt-4 overflow-hidden rounded-[14px] border border-line bg-surface">
                <div className="flex items-center justify-between pt-2 pr-2 pl-3.5">
                  <span className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Mapa</span>
                  <button type="button" onClick={() => setMapOpen(true)} className="inline-flex h-9 items-center gap-1.5 px-2.5 text-xs font-medium text-accent">
                    Ver completo
                    <ExpandIcon size={13} />
                  </button>
                </div>
                <button type="button" onClick={() => setMapOpen(true)} aria-label="Abrir el mapa completo" className="block w-full px-1 pb-1">
                  <MiniMap model={model} view={view} />
                </button>
              </div>

              <div key={rec.nodeId} className="animate-fade">
                <div className="mt-6 flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: LANE_DOT[rec.lane] }} />
                  {LANE_META[rec.lane].label}
                </div>
                <h2 className="mt-2 font-serif text-2xl leading-[1.15]">Hacia {model.index.nodes.get(rec.nodeId)?.label}</h2>
                <p className="mt-1 text-xs text-muted">
                  {view.steps.length} {view.steps.length === 1 ? "salto" : "saltos"} desde tus pistas
                </p>
                <PathTimeline model={model} view={view} />
                <div className="mt-5 rounded-xl bg-chip px-4 py-3.5">
                  <div className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">En una frase</div>
                  <p className="mt-1.5 font-serif text-base leading-snug">{rec.pathSummary}</p>
                </div>
                <p className="mt-3.5 text-[11px] leading-normal text-muted">
                  Un recorte de {model.graph.nodes.length} nodos, hasta {GRAPH_LIMITS.maxHops} saltos desde tus pistas. Tocá una parada para ver con qué más conecta.
                </p>
              </div>
            </div>

            {mapOpen && <FullMapDialog model={model} view={view} title={model.index.nodes.get(rec.nodeId)?.label ?? ""} onClose={() => setMapOpen(false)} />}
          </>
        )}
      </div>
    </div>
  );
}

function MapControls({
  maxHops,
  onHops,
  hiddenTypes,
  onToggleType,
}: {
  maxHops: number;
  onHops: (n: number) => void;
  hiddenTypes: ReadonlySet<EdgeType>;
  onToggleType: (t: EdgeType) => void;
}) {
  const hopOptions = Array.from({ length: GRAPH_LIMITS.maxHops }, (_, i) => i + 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-line px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="text-xs text-muted">Alcance</span>
        <div role="group" aria-label="Alcance" className="flex rounded-full bg-chip p-[3px]">
          {hopOptions.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={n === maxHops}
              onClick={() => onHops(n)}
              className={`h-[30px] rounded-full px-3 text-xs ${n === maxHops ? "bg-surface text-ink" : "text-muted"}`}
            >
              {n} {n === 1 ? "salto" : "saltos"}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label="Tipos de conexión" className="flex flex-wrap gap-x-1.5 gap-y-1">
        {EDGE_ORDER.map((type) => {
          const meta = EDGE_META[type];
          const on = !hiddenTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              onClick={() => onToggleType(type)}
              className={`inline-flex h-[30px] items-center gap-[7px] rounded-full px-2.5 text-xs hover:bg-chip ${on ? "" : "opacity-40"}`}
            >
              <svg aria-hidden="true" width="26" height="8" viewBox="0 0 26 8">
                <line x1="1" y1="4" x2="25" y2="4" stroke="currentColor" strokeWidth={meta.width} strokeDasharray={meta.dash} strokeLinecap="round" />
              </svg>
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FullMapDialog({ model, view, title, onClose }: { model: GraphModel; view: ViewState; title: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // Abrir el mapa con el recorrido a la vista: centrado entre su primera y su última parada.
    const xs = view.rec.path.map((id) => model.layout.positions.get(id)?.x ?? 0);
    const middle = (Math.min(...xs) + Math.max(...xs)) / 2;
    if (scroller.current) scroller.current.scrollLeft = middle - scroller.current.clientWidth / 2;
    return () => dialog?.close();
  }, [model, view.rec.path]);

  return (
    <dialog ref={ref} aria-label="Mapa completo" onClose={onClose} className="animate-sheet m-0 h-dvh max-h-none w-full max-w-none bg-bg p-0 text-ink">
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-3 pt-3 pb-2">
          <button type="button" aria-label="Cerrar el mapa" onClick={onClose} className="flex size-11 items-center justify-center">
            <CloseIcon />
          </button>
          <div className="text-center">
            <h2 className="font-serif text-[19px]">Mapa completo</h2>
            <div className="text-[11px] text-muted">Deslizá para recorrer el tiempo</div>
          </div>
          <span className="w-11" />
        </div>
        <div ref={scroller} className="no-scrollbar min-h-0 flex-1 overflow-auto bg-surface pt-6">
          <GraphCanvas model={model} view={view} selection={{ kind: "path" }} />
        </div>
        <p className="shrink-0 border-t border-line px-5 pt-3 pb-6 text-xs leading-normal text-muted">
          En acento, el camino hacia <span className="text-ink">{title}</span>. Los números siguen el orden del recorrido.
        </p>
      </div>
    </dialog>
  );
}
