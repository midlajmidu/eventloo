import type { ComponentType } from "react";
import type { SiteData } from "@/lib/site-types";

export type ThemeId = "minimal-editorial" | "enchanted-illustrated" | "swiss-modernist" | "playful-3d-world" | "creative-brutalism" | "retro-collegiate";
export type ThemePageKey = "landing" | "results" | "standings" | "schedule" | "verify";

export type ThemePageProps = {
  data: SiteData;
  /** set while an admin previews an unpublished theme; links keep it */
  preview?: string | undefined;
  /** badge code passed in the URL (verify page) */
  code?: string | undefined;
  /** open the QR scanner straight away (verify page, "Scan QR" nav link) */
  scan?: boolean | undefined;
};

export type ThemeModule = {
  id: ThemeId;
  name: string;
  description: string;
  thumbnail: string;
  available: boolean;
  pages?: Record<ThemePageKey, ComponentType<ThemePageProps>>;
};
