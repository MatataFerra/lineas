import { describe, expect, it, vi } from "vitest";
import { authorSlug, fetchAuthorProfile } from "./profile";

const wiki = {
  type: "standard",
  title: "Julio Cortázar",
  description: "escritor argentino",
  extract: "Julio Cortázar fue un escritor argentino.",
  thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Cortazar.jpg?x=1" },
  content_urls: { desktop: { page: "https://es.wikipedia.org/wiki/Julio_Cort%C3%A1zar" } },
};
const authors = {
  docs: [
    { key: "OL15645840A", name: "Julio Cortázar", work_count: 8 },
    { key: "OL2631008A", name: "Julio Cortázar", work_count: 477, birth_date: "26 August 1914", death_date: "12 February 1984" },
    { key: "OL1A", name: "Otra Persona", work_count: 900 },
  ],
};
const works = {
  docs: [
    { key: "/works/OL1W", title: "Rayuela", first_publish_year: 1963, cover_i: 111, edition_count: 129 },
    { key: "/works/OL2W", title: "Rayuela", first_publish_year: 1970, cover_i: 112, edition_count: 3 },
    { key: "/works/OL3W", title: "Bestiario", first_publish_year: 1951, edition_count: 37 },
  ],
};

function fakeFetch() {
  return vi.fn(async (url: string) => {
    if (url.includes("wikipedia.org")) return Response.json(wiki);
    if (url.includes("search/authors.json")) return Response.json(authors);
    if (url.includes("search.json")) return Response.json(works);
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("fetchAuthorProfile", () => {
  it("junta biografía de Wikipedia y obras de Open Library", async () => {
    const fetch = fakeFetch();
    const p = await fetchAuthorProfile("Julio Cortázar", { fetch });
    expect(p.name).toBe("Julio Cortázar");
    expect(p.bio).toBe("Julio Cortázar fue un escritor argentino.");
    expect(p.imageUrl).toBe("https://upload.wikimedia.org/wikipedia/commons/a/ab/Cortazar.jpg");
    expect(p.lifespan).toBe("1914–1984");
    // El autor con más obras entre los que coinciden en nombre.
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes("author=OL2631008A"))).toBe(true);
  });

  it("deduplica obras por título y se queda con la de más ediciones", async () => {
    const p = await fetchAuthorProfile("Julio Cortázar", { fetch: fakeFetch() });
    expect(p.works.map((w) => w.title)).toEqual(["Rayuela", "Bestiario"]);
    expect(p.works[0]).toMatchObject({ id: "rayuela", year: 1963, coverUrl: "https://covers.openlibrary.org/b/id/111-M.jpg" });
    expect(p.works[1].coverUrl).toBeNull();
  });

  it("si los catálogos fallan devuelve el nombre sin datos, no un error", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof globalThis.fetch;
    const p = await fetchAuthorProfile("Nadie", { fetch });
    expect(p).toEqual({ name: "Nadie", works: [], bio: undefined, description: undefined, imageUrl: undefined, sourceUrl: undefined, lifespan: undefined });
  });
});

describe("authorSlug", () => {
  it("arma un slug estable sin acentos", () => {
    expect(authorSlug("Julio Cortázar")).toBe("julio-cortazar");
  });
});
