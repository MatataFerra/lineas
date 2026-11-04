import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthorScreen } from "@/features/author/author-screen";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Autor · Líneas" };

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense>
      <PageTransition>
        <AuthorScreen params={params} />
      </PageTransition>
    </Suspense>
  );
}
