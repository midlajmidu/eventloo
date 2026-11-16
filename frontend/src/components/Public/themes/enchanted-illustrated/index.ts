import thumbnail from "@/assets/thumbs/enchanted-illustrated.webp";
import type { ThemeModule } from "../themeTypes";
import { Landing } from "./Landing";
import { Results, Schedule, Standings, Verify } from "./Pages";

export const enchantedIllustrated: ThemeModule = {
  id: "enchanted-illustrated",
  name: "Enchanted Illustrated",
  description: "Cinematic, painterly and immersive festival experience.",
  thumbnail,
  available: true,
  pages: { landing: Landing, results: Results, standings: Standings, schedule: Schedule, verify: Verify },
};
