import type { Metadata } from "next";
import { ConnectionsScreen } from "@/features/connections/connections-screen";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Conexiones · Líneas" };

export default function Page() {
  return (
    <PageTransition>
      <ConnectionsScreen />
    </PageTransition>
  );
}
