import type { ThemeModule } from "../themeTypes";
import thumbnail from "@/assets/thumbs/playful-3d-world.webp";
import { Landing } from "./Landing";
import { Results, Schedule, Standings, Verify } from "./Pages";

export const playful3dWorld: ThemeModule = {
  id: "playful-3d-world",
  name: "Playful 3D World",
  description: "A toy-like 3D campus, real WebGL lettering, chunky blocks and bouncy motion.",
  thumbnail,
  available: true,
  pages: { landing: Landing, results: Results, standings: Standings, schedule: Schedule, verify: Verify },
};
