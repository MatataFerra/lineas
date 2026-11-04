import { HomeScreen } from "@/features/clues/home-screen";
import { PageTransition } from "@/components/page-transition";

export default function Page() {
  return (
    <PageTransition>
      <HomeScreen />
    </PageTransition>
  );
}
