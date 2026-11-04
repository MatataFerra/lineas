import type { Metadata } from "next";
import { ExploreIndex } from "@/features/explore/explore-index";
import { rinconSummaries } from "@/lib/explore/rincones";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Explorar · Líneas" };

export default function Page() {
  return (
    <PageTransition>
      <ExploreIndex rincones={rinconSummaries()} />
    </PageTransition>
  );
}
