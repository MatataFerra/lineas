"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { ArrowLeftIcon, ArrowRightIcon, NodeKindIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { bookHref } from "@/lib/authors/link";
import { authorSlug, type AuthorProfile } from "@/lib/authors/profile";
import { EDGE_META } from "@/lib/graph/labels";
import { otherEnd } from "@/lib/graph/queries";
import { useLineas } from "@/lib/store";

/**
 * Un autor dentro de la app: retrato y biografía (Wikipedia), sus obras más
 * editadas (Open Library) y, si aparece en el mapa de esta búsqueda, con qué
 * se conecta. Nada de esto se guarda en la base: llega de /api/author.
 */
export function AuthorScreen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const graph = useLineas((s) => s.graph);
  const setFocus = useLineas((s) => s.setFocus);

  const node = graph?.nodes.find((n) => n.kind === "person" && authorSlug(n.label) === slug);
  const name = searchParams.get("n") ?? node?.label ?? slug.replace(/-/g, " ");
  const profile = useAuthorProfile(name);

  const inMap = new Set(graph?.nodes.filter((n) => n.kind === "book" && n.book && authorSlug(n.book.author) === slug).map((n) => n.id) ?? []);
  const edges = node ? (graph?.edges.filter((e) => e.source === node.id || e.target === node.id) ?? []) : [];

  return (
    <div className="min-h-dvh px-[22px] pt-5 pb-16 md:px-14 md:pt-7">
      <div className="mx-auto max-w-[1160px]">
        <SiteHeader />
        <button type="button" onClick={() => router.back()} className="mt-5 inline-flex items-center gap-2 py-2 text-[13px] text-muted hover:text-ink md:mt-6">
          <ArrowLeftIcon size={14} />
          Volver
        </button>

        <article className="mt-4 grid gap-8 md:mt-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-14 lg:grid-cols-[240px_minmax(0,720px)]">
          <aside className="flex items-end gap-5 md:block">
            <div className="relative h-[200px] w-[150px] shrink-0 overflow-hidden rounded-[3px] bg-chip shadow-[0_1px_2px_rgba(0,0,0,0.12),0_10px_20px_rgba(0,0,0,0.08)] md:h-[290px] md:w-[220px]">
              {profile.data?.imageUrl ? (
                <Image
                  src={profile.data.imageUrl}
                  alt={`Retrato de ${profile.data.name}`}
                  fill
                  sizes="220px"
                  className="animate-fade object-cover object-top [filter:grayscale(1)_sepia(0.25)_contrast(1.05)]"
                />
              ) : (
                <span className={`flex h-full items-center justify-center text-muted ${profile.loading ? "animate-soft-pulse" : ""}`}>
                  <NodeKindIcon kind="person" size={56} />
                </span>
              )}
            </div>
            {profile.data?.sourceUrl && (
              <p className="pb-1 text-[11px] text-muted md:mt-3">
                Retrato y biografía:{" "}
                <a href={profile.data.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
                  Wikipedia
                </a>
              </p>
            )}
          </aside>

          <div className="min-w-0">
            <h1 className="font-serif text-[34px] leading-[1.06] tracking-[-0.01em] md:text-[46px]">{profile.data?.name ?? name}</h1>
            <p className="mt-2 text-sm text-muted first-letter:uppercase">
              {[profile.data?.description, profile.data?.lifespan].filter(Boolean).join(" · ") || (profile.loading ? "…" : "")}
            </p>

            {profile.loading && (
              <div aria-hidden="true" className="mt-6 flex flex-col gap-2.5">
                {[100, 92, 96, 54].map((w) => (
                  <span key={w} className="animate-soft-pulse h-3 rounded bg-chip" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
            {profile.data?.bio && <p className="mt-6 max-w-[64ch] text-[15px] leading-relaxed">{profile.data.bio}</p>}

            {node && edges.length > 0 && (
              <section className="mt-9" aria-labelledby="map-title">
                <h2 id="map-title" className="font-serif text-[20px]">
                  En tu mapa
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {edges.map((edge) => {
                    const other = graph!.nodes.find((n) => n.id === otherEnd(edge, node.id));
                    return (
                      <li key={edge.id} className="rounded-xl border border-line bg-surface px-4 py-3">
                        <span className="text-[13px] font-medium">{other?.label}</span>
                        <span className="ml-2 text-[11px] text-muted">{EDGE_META[edge.type].label}</span>
                        <p className="mt-1 text-[13px] leading-snug text-muted">{edge.summary}</p>
                      </li>
                    );
                  })}
                </ul>
                <Link href="/conexiones" onClick={() => setFocus(null)} className="mt-3 inline-flex items-center gap-1.5 text-[13px] underline underline-offset-[3px] hover:text-accent">
                  Ver el mapa
                  <ArrowRightIcon size={12} />
                </Link>
              </section>
            )}

            <section className="mt-10" aria-labelledby="works-title">
              <h2 id="works-title" className="font-serif text-[20px]">
                Obras
              </h2>
              {profile.data && profile.data.works.length === 0 && <p className="mt-2 text-sm text-muted">No encontramos sus obras en el catálogo.</p>}
              <ul className="mt-5 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
                {(profile.data?.works ?? []).map((work) => (
                  <li key={work.id}>
                    <Link href={bookHref({ ...work, author: profile.data!.name })} className="group flex flex-col">
                      <span className="transition-transform duration-200 group-hover:-translate-y-0.5">
                        <BookCover id={work.id} title={work.title} author={profile.data!.name} size="md" coverUrl={work.coverUrl} />
                      </span>
                      <span className="mt-3 line-clamp-2 font-serif text-[15px] leading-tight group-hover:underline">{work.title}</span>
                      <span className="mt-1 text-xs text-muted">
                        {work.year ?? ""}
                        {inMap.has(work.id) && <span className="ml-2 rounded-full bg-ink px-1.5 py-px text-[10px] text-bg">En tu mapa</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}

function useAuthorProfile(name: string) {
  const [state, setState] = useState<{ name: string; data: AuthorProfile | null }>({ name: "", data: null });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/author?${new URLSearchParams({ name })}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<AuthorProfile>) : null))
      .then((data) => setState({ name, data }))
      .catch(() => {});
    return () => controller.abort();
  }, [name]);
  return { data: state.name === name ? state.data : null, loading: state.name !== name };
}
