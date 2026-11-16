export type Stat = { label: string; value: string };

export type EventInfo = {
  id: string | number;
  name: string;
  theme_title: string;
  tagline: string;
  description: string;
  logo_url: string | null;
  artwork_url: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string;
  organizer: string;
  stats: Stat[];
  website_theme: string;
};

export type Team = {
  id: string | number;
  name: string;
  color?: string;
  first_places?: number;
  second_places?: number;
  third_places?: number;
  total_points?: number;
};

export type Program = {
  id: string | number;
  name: string;
  category: string;
  venue: string;
  starts_at: string | null;
  ends_at: string | null;
  status?: string;
  is_published?: boolean;
};

export type Result = {
  id: string | number;
  program_id: string | number;
  position: number;
  participant_name: string;
  team_id: string | number | null;
  team_name?: string;
  points: number;
  grade?: string;
  chest_number?: string | number;
};

export type SiteData = {
  event: EventInfo | null;
  teams: Team[];
  programs: Program[];
  results: Result[];
};

export type BadgeResult = {
  full_name: string;
  chest_number: string;
  institution: string;
  team_name: string | null;
  badge_code: string;
  programs?: any[];
  badge_url?: string;
};

