import type { Metadata } from "next";
import { ExploreIndex } from "@/features/explore/explore-index";
import { rinconSummaries } from "@/lib/explore/rincones";

export const metadata: Metadata = { title: "Explorar · Líneas" };

export default function Page() {
  return <ExploreIndex rincones={rinconSummaries()} />;
}
