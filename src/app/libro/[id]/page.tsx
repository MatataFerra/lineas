import type { Metadata } from "next";
import { Suspense } from "react";
import { BookScreen } from "@/features/book/book-screen";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Libro · Líneas" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <PageTransition>
        <BookScreen params={params} />
      </PageTransition>
    </Suspense>
  );
}
