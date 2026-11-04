import { describe, expect, it } from "vitest";
import { laneSubgraph } from "@/lib/graph/merge";
import { MOCK_GRAPH } from "@/lib/graph/mock";
import { encodeEvent, readEventStream, type StreamEvent } from "./events";

const lane = laneSubgraph(MOCK_GRAPH, MOCK_GRAPH.recommendations.find((r) => r.lane === "beyond")!);

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("readEventStream", () => {
  it("entrega cada evento aunque las líneas lleguen partidas entre fragmentos", async () => {
    const text = encodeEvent({ type: "lane", lane: "beyond", graph: lane, cached: false }) + encodeEvent({ type: "done" });
    const cut = Math.floor(text.length / 3);
    const events: StreamEvent[] = [];
    await readEventStream(streamOf([text.slice(0, cut), text.slice(cut, cut * 2), text.slice(cut * 2)]), (e) => events.push(e));
    expect(events.map((e) => e.type)).toEqual(["lane", "done"]);
    expect(events[0].type === "lane" && events[0].graph.recommendations[0].lane).toBe("beyond");
  });

  it("rechaza un carril que no cumple el contrato de su carril", async () => {
    const wrong = encodeEvent({ type: "lane", lane: "affinity", graph: lane, cached: false });
    await expect(readEventStream(streamOf([wrong]), () => {})).rejects.toThrow();
  });

  it("acepta un error de carril y un patch de verificación", async () => {
    const events: StreamEvent[] = [];
    await readEventStream(
      streamOf([
        encodeEvent({ type: "lane-error", lane: "affinity", message: "x" }),
        encodeEvent({ type: "patch", lane: "beyond", nodeId: "el-extranjero", book: { author: "Albert Camus", verified: true } }),
      ]),
      (e) => events.push(e),
    );
    expect(events.map((e) => e.type)).toEqual(["lane-error", "patch"]);
  });
});
