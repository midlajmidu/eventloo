import type { ThemeId, ThemeModule } from "./themeTypes";
import { minimalEditorial } from "./minimal-editorial";
import { enchantedIllustrated } from "./enchanted-illustrated";
import { swissModernist } from "./swiss-modernist";
import { playful3dWorld } from "./playful-3d-world";
import { creativeBrutalism } from "./creative-brutalism";
import { retroCollegiate } from "./retro-collegiate";

export const DEFAULT_THEME: ThemeId = "enchanted-illustrated";

/** Order here is the numbering shown in Event Settings (01–06). */
export const themes: ThemeModule[] = [enchantedIllustrated, minimalEditorial, swissModernist, playful3dWorld, creativeBrutalism, retroCollegiate];

/** Pick the theme to render: a valid preview wins, then the saved theme, then the default. */
export function resolveTheme(saved: string | null | undefined, preview?: string): ThemeModule {
  const usable = (id?: string | null) => themes.find((t) => t.id === id && t.available && t.pages);
  return usable(preview) ?? usable(saved) ?? usable(DEFAULT_THEME)!;
}
