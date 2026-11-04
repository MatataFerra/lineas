import type { Metadata } from "next";
import { ResultsScreen } from "@/features/results/results-screen";

export const metadata: Metadata = { title: "Resultados · Líneas" };

export default function Page() {
  return <ResultsScreen />;
}
