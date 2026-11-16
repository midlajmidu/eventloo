import type { ThemeModule } from "../themeTypes";
import thumbnail from "@/assets/thumbs/retro-collegiate.webp";
import { Landing } from "./Landing";
import { Results, Schedule, Standings, Verify } from "./Pages";

export const retroCollegiate: ThemeModule = {
  id: "retro-collegiate",
  name: "Retro Collegiate",
  description: "Vintage campus posters, admission tickets, scoreboards and a flip-clock countdown.",
  thumbnail,
  available: true,
  pages: { landing: Landing, results: Results, standings: Standings, schedule: Schedule, verify: Verify },
};
