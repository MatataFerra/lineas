import type { Metadata } from "next";
import { ResultsScreen } from "@/features/results/results-screen";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Resultados · Líneas" };

export default function Page() {
  return (
    <PageTransition>
      <ResultsScreen />
    </PageTransition>
  );
}
