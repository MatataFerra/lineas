import type { GraphModel, ViewState } from "./model";

const W = 344;
const H = 120;

/** El mapa entero en miniatura, con el recorrido resaltado. Es un dibujo, no se interactúa. */
export function MiniMap({ model, view }: { model: GraphModel; view: ViewState }) {
  const { layout, graph } = model;
  const sx = W / layout.options.width;
  const ys = [...layout.positions.values()].map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const y = (v: number) => 12 + ((v - minY) / Math.max(maxY - minY, 1)) * 84;
  const pathEdges = new Set(view.steps.map((e) => e.id));
  const pathNodes = new Set(view.rec.path);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Miniatura del mapa de conexiones con el recorrido resaltado">
      {layout.ticks.map((t) => (
        <g key={t.label}>
          <line x1={t.x * sx} x2={t.x * sx} y1={6} y2={100} className="stroke-grid" strokeWidth={1} />
          <text x={t.x * sx} y={113} textAnchor="middle" className="fill-muted text-[9px]">
            {t.label}
          </text>
        </g>
      ))}
      {graph.edges.map((e) => {
        const a = layout.positions.get(e.source)!;
        const b = layout.positions.get(e.target)!;
        const hi = pathEdges.has(e.id);
        return (
          <line
            key={e.id}
            x1={a.x * sx}
            y1={y(a.y)}
            x2={b.x * sx}
            y2={y(b.y)}
            className={hi ? "stroke-accent" : "stroke-edge"}
            strokeWidth={hi ? 2 : 1}
            strokeLinecap="round"
            opacity={hi ? 1 : 0.4}
          />
        );
      })}
      {graph.nodes.map((n) => {
        const p = layout.positions.get(n.id)!;
        const isDest = n.id === view.rec.nodeId;
        const inPath = pathNodes.has(n.id);
        return (
          <circle
            key={n.id}
            cx={p.x * sx}
            cy={y(p.y)}
            r={isDest ? 5.5 : inPath ? 4.5 : 3}
            className={`stroke-surface ${isDest ? "fill-accent" : inPath ? "fill-ink" : "fill-edge"}`}
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}
