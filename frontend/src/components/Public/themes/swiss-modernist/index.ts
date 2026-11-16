import type { ThemeModule } from "../themeTypes";
import thumbnail from "@/assets/thumbs/swiss-modernist.webp";
import { Landing } from "./Landing";
import { Results, Schedule, Standings, Verify } from "./Pages";

export const swissModernist: ThemeModule = {
  id: "swiss-modernist",
  name: "Swiss Modernist",
  description: "Strict grids, oversized grotesk type, vermilion accents and numbered sections.",
  thumbnail,
  available: true,
  pages: { landing: Landing, results: Results, standings: Standings, schedule: Schedule, verify: Verify },
};
