import thumbnail from "@/assets/thumbs/minimal-editorial.webp";
import type { ThemeModule } from "../themeTypes";
import { Landing } from "./Landing";
import { Results, Schedule, Standings, Verify } from "./Pages";

export const minimalEditorial: ThemeModule = {
  id: "minimal-editorial",
  name: "Minimal Editorial",
  description: "Clean, elegant and minimal festival design.",
  thumbnail,
  available: true,
  pages: { landing: Landing, results: Results, standings: Standings, schedule: Schedule, verify: Verify },
};
