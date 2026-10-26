import type { Metadata } from "next";
import { ConnectionsScreen } from "@/features/connections/connections-screen";

export const metadata: Metadata = { title: "Conexiones · Líneas" };

export default function Page() {
  return <ConnectionsScreen />;
}
