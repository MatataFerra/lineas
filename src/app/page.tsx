import { HomeScreen } from "@/features/clues/home-screen";
import { InspirationArt } from "@/features/clues/inspiration-art";

export default function Page() {
  return <HomeScreen art={<InspirationArt />} />;
}
