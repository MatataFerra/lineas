import { describe, expect, it, vi } from "vitest";
import { fetchBookDetails } from "./details";

const volume = {
  id: "abc",
  volumeInfo: {
    title: "On the Road",
    authors: ["Jack Kerouac"],
    publisher: "Penguin Classics",
    pageCount: 320,
    description: "<p>La historia de un viaje <b>sin destino</b>.</p><br>Un clásico.",
    categories: ["Fiction / Classics", "Fiction / Literary"],
    infoLink: "https://books.google.com/books?id=abc",
  },
};

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("fetchBookDetails", () => {
  it("con id de Google Books pide ese volumen y limpia la descripción", async () => {
    const fetch = fakeFetch(volume);
    const d = await fetchBookDetails({ googleBooksId: "abc", title: "On the Road", author: "Jack Kerouac" }, { fetch });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/volumes/abc");
    expect(d).toEqual({
      publisher: "Penguin Classics",
      pageCount: 320,
      description: "La historia de un viaje sin destino.\n\nUn clásico.",
      categories: ["Clásicos", "Literaria"],
      goodreadsUrl: "https://www.goodreads.com/search?q=On%20the%20Road%20Jack%20Kerouac",
    });
  });

  it("sin id busca por título y autor y toma el primero que coincide", async () => {
    const fetch = fakeFetch({ items: [{ id: "x", volumeInfo: { title: "Otro libro", authors: ["Alguien"] } }, volume] });
    const d = await fetchBookDetails({ title: "On the Road", author: "Jack Kerouac" }, { fetch });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("volumes?");
    expect(d?.publisher).toBe("Penguin Classics");
  });

  it("si Google Books no responde, completa con Open Library", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("googleapis")) return new Response("{}", { status: 403 });
      if (url.includes("search.json"))
        return Response.json({ docs: [{ key: "/works/OL1W", title: "On the Road", author_name: ["Jack Kerouac"], number_of_pages_median: 310, subject: ["Beat generation", "Fiction", "Travel"] }] });
      return Response.json({ description: { value: "*Writer* buddies wander from [coast](https://x) to coast." } });
    }) as unknown as typeof globalThis.fetch;
    const d = await fetchBookDetails({ title: "On the Road", author: "Jack Kerouac" }, { fetch });
    expect(d).toMatchObject({ pageCount: 310, description: "Writer buddies wander from coast to coast.", categories: ["Novela", "Viajes"] });
    expect(d.publisher).toBeUndefined();
  });

  it("si ningún catálogo lo encuentra, solo queda el enlace a Goodreads", async () => {
    const d = await fetchBookDetails({ title: "Rayuela", author: "Julio Cortázar" }, { fetch: fakeFetch({}, 503) });
    expect(d).toEqual({ goodreadsUrl: "https://www.goodreads.com/search?q=Rayuela%20Julio%20Cort%C3%A1zar", categories: [] });
  });
});
