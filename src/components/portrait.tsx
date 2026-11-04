"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { NodeKindIcon } from "@/components/icons";
import type { GraphNode } from "@/lib/graph/schema";

interface PortraitData {
  imageUrl: string | null;
  sourceUrl?: string;
}

// Un pedido por persona y por sesión, aunque aparezca en varias tarjetas.
const requests = new Map<string, Promise<PortraitData>>();

function loadPortrait(node: GraphNode): Promise<PortraitData> {
  let request = requests.get(node.id);
  if (!request) {
    const params = new URLSearchParams({ slug: node.id, name: node.label, kind: node.kind });
    request = fetch(`/api/portrait?${params}`)
      .then((r) => (r.ok ? (r.json() as Promise<PortraitData>) : { imageUrl: null }))
      .catch(() => ({ imageUrl: null }));
    requests.set(node.id, request);
  }
  return request;
}

export function usePortrait(node: GraphNode): PortraitData | null {
  const wanted = node.kind === "person" || node.kind === "art";
  const [state, setState] = useState<{ id: string; data: PortraitData } | null>(null);
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    void loadPortrait(node).then((data) => alive && setState({ id: node.id, data }));
    return () => {
      alive = false;
    };
  }, [node, wanted]);
  return wanted && state?.id === node.id ? state.data : null;
}

/**
 * El retrato de una persona (o un músico, un pintor) en un círculo, en tono
 * de grabado para que conviva con las portadas. Sin retrato, el ícono a mano.
 */
export function Portrait({ node, size, className = "" }: { node: GraphNode; size: number; className?: string }) {
  const portrait = usePortrait(node);
  const [failed, setFailed] = useState(false);
  const url = !failed ? portrait?.imageUrl : null;
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line/70 bg-bg ${className}`}
      style={{ width: size, height: size }}>
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          sizes={`${size}px`}
          onError={() => setFailed(true)}
          className="animate-fade object-cover object-top [filter:grayscale(1)_sepia(0.25)_contrast(1.05)]"
        />
      ) : (
        <NodeKindIcon kind={node.kind} size={Math.round(size * 0.55)} />
      )}
    </span>
  );
}
