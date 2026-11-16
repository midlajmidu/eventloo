import type { ThemeModule } from "../themeTypes";
import thumbnail from "@/assets/thumbs/creative-brutalism.webp";
import { Landing } from "./Landing";
import { Results, Schedule, Standings, Verify } from "./Pages";

export const creativeBrutalism: ThemeModule = {
  id: "creative-brutalism",
  name: "Creative Brutalism",
  description: "Loud poster type, colour blocks, halftone cut-outs and kinetic motion.",
  thumbnail,
  available: true,
  pages: { landing: Landing, results: Results, standings: Standings, schedule: Schedule, verify: Verify },
};
