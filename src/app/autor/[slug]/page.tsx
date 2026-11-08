import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthorScreen } from "@/features/author/author-screen";

export const metadata: Metadata = { title: "Autor · Líneas" };

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense>
      <AuthorScreen params={params} />
    </Suspense>
  );
}
