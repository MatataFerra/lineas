import { describe, expect, it, vi } from "vitest";
import { findPortrait } from "./wikipedia";

const summary = (over: Record<string, unknown> = {}) => ({
  type: "standard",
  description: "poeta francés",
  thumbnail: { source: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Rimbaud.PNG/330px-Rimbaud.PNG?utm_source=es.wikipedia.org" },
  content_urls: { desktop: { page: "https://es.wikipedia.org/wiki/Arthur_Rimbaud" } },
  ...over,
});

function fetchFrom(map: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const hit = Object.entries(map).find(([k]) => url.includes(k));
    return hit ? Response.json(hit[1]) : new Response("", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("findPortrait", () => {
  it("toma el retrato de Wikipedia en castellano, sin parámetros de rastreo", async () => {
    const fetch = fetchFrom({ "es.wikipedia.org": summary() });
    expect(await findPortrait("Arthur Rimbaud", "person", { fetch })).toEqual({
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Rimbaud.PNG/330px-Rimbaud.PNG",
      sourceUrl: "https://es.wikipedia.org/wiki/Arthur_Rimbaud",
    });
  });

  it("si no está en castellano prueba en inglés", async () => {
    const fetch = fetchFrom({ "en.wikipedia.org": summary({ description: "American novelist" }) });
    expect((await findPortrait("Jack Kerouac", "person", { fetch }))?.imageUrl).toContain("wikimedia");
  });

  it("descarta homónimos que no son de oficio creativo y las desambiguaciones", async () => {
    const fetch = fetchFrom({
      "es.wikipedia.org": summary({ description: "futbolista argentino" }),
      "en.wikipedia.org": summary({ type: "disambiguation" }),
    });
    expect(await findPortrait("Juan Pérez", "person", { fetch })).toBeNull();
  });

  it("para otras artes no exige oficio (puede ser un músico o una obra)", async () => {
    const fetch = fetchFrom({ "es.wikipedia.org": summary({ description: "álbum de 1959" }) });
    expect(await findPortrait("Kind of Blue", "art", { fetch })).not.toBeNull();
  });

  it("sin imagen devuelve null", async () => {
    const fetch = fetchFrom({ "es.wikipedia.org": summary({ thumbnail: undefined }), "en.wikipedia.org": summary({ thumbnail: undefined }) });
    expect(await findPortrait("Alguien", "person", { fetch })).toBeNull();
  });
});
