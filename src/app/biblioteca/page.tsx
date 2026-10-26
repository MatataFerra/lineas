import type { Metadata } from "next";
import { LibraryScreen } from "@/features/library/library-screen";

export const metadata: Metadata = { title: "Mi biblioteca · Líneas" };

export default function Page() {
  return <LibraryScreen />;
}
