import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { SiteHeader } from "@/components/site-header";
import { RINCON_GROUPS, type RinconSummary } from "@/lib/explore/rincon";

/**
 * La entrada a Explorar: los rincones agrupados (movimientos, épocas, temas,
 * lugares), cada uno con tres tapas en abanico. Sin pistas ni búsqueda: se
 * entra por un tema y desde ahí se salta a otros por lo que comparten.
 */
export function ExploreIndex({ rincones }: { rincones: RinconSummary[] }) {
  return (
    <div className="min-h-dvh px-[22px] pt-5 pb-16 md:px-14 md:pt-7">
      <div className="mx-auto max-w-[1160px]">
        <SiteHeader />

        <header className="mt-12 max-w-[62ch] md:mt-20">
          <h1 className="font-serif text-[38px] leading-[1.06] tracking-[-0.015em] md:text-[56px]">Explorar</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted md:text-base">
            Rincones de la literatura: un tema en el centro y los libros, las personas y las obras que giran a su alrededor. Entrá por uno y seguí lo que lo
            une con los demás.
          </p>
        </header>

        {RINCON_GROUPS.map((group) => {
          const items = rincones.filter((r) => r.group === group.id);
          if (!items.length) return null;
          return (
            <section key={group.id} aria-labelledby={`g-${group.id}`} className="mt-14 md:mt-20">
              <h2 id={`g-${group.id}`} className="border-b border-line pb-3 font-serif text-[22px] md:text-[26px]">
                {group.label}
              </h2>
              <ul className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-x-10">
                {items.map((r) => (
                  <li key={r.slug} className="border-b border-line/70">
                    <Link href={`/explorar/${r.slug}`} className="group flex items-center gap-5 py-6">
                      <Fan covers={r.covers} />
                      <span className="min-w-0">
                        <span className="block font-serif text-[21px] leading-tight group-hover:underline group-hover:underline-offset-4">{r.title}</span>
                        <span className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-muted">{r.intro}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Tres tapas superpuestas; al pasar por encima se abren un poco. */
function Fan({ covers }: { covers: RinconSummary["covers"] }) {
  const angles = [-8, 0, 8];
  return (
    <span aria-hidden="true" className="relative h-[96px] w-[92px] shrink-0">
      {covers.map((c, i) => (
        <span
          key={c.id}
          className="absolute top-0.5 left-[14px] origin-bottom transition-transform duration-300 ease-out [transform:rotate(var(--a))_translateX(var(--x))] group-hover:[transform:rotate(var(--b))_translateX(var(--y))]"
          style={{ zIndex: i === 1 ? 2 : 1, ["--a" as string]: `${angles[i]}deg`, ["--b" as string]: `${angles[i] * 1.6}deg`, ["--x" as string]: `${(i - 1) * 10}px`, ["--y" as string]: `${(i - 1) * 16}px` }}>
          <BookCover id={c.id} title={c.title} author={c.author} size="graph" coverUrl={c.coverUrl} />
        </span>
      ))}
    </span>
  );
}
