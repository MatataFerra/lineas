import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExploreScreen } from "@/features/explore/explore-screen";
import { RINCONES, rinconBridges, rinconBySlug, rinconSummaries } from "@/lib/explore/rincones";

export function generateStaticParams() {
  return RINCONES.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const rincon = rinconBySlug((await params).slug);
  return { title: rincon ? `${rincon.title} · Explorar · Líneas` : "Explorar · Líneas", description: rincon?.intro };
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense>
      <RinconPage params={params} />
    </Suspense>
  );
}

async function RinconPage({ params }: { params: Promise<{ slug: string }> }) {
  const rincon = rinconBySlug((await params).slug);
  if (!rincon) notFound();
  const list = rinconSummaries().map(({ slug, title, group }) => ({ slug, title, group }));
  return <ExploreScreen key={rincon.slug} rincon={rincon} list={list} bridges={rinconBridges(rincon)} />;
}
