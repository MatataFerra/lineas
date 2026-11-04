import type { Metadata } from "next";
import { LibraryScreen } from "@/features/library/library-screen";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Mi biblioteca · Líneas" };

export default function Page() {
  return (
    <PageTransition>
      <LibraryScreen />
    </PageTransition>
  );
}
