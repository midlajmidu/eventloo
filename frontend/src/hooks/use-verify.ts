import { useCallback, useEffect, useState } from "react";
import { publicEventAPI } from "@/services/api";
import type { BadgeResult } from "@/lib/site-types";

export function useVerify(initialCode?: string, explicitEventId?: string | number) {
  const [code, setCode] = useState(initialCode ?? "");
  const [state, setState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "found"; badge: BadgeResult } | { status: "missing" } | { status: "error"; message: string }
  >({ status: "idle" });

  const run = useCallback(
    async (c: string) => {
      const value = c.trim();
      if (!value) return;
      setCode(value);
      setState({ status: "loading" });
      try {
        const pathMatch = window.location.pathname.match(/\/(?:public\/)?events\/(\d+)/) || window.location.pathname.match(/\/events\/(\d+)/);
        const eventId = explicitEventId
          ? String(explicitEventId)
          : (pathMatch ? pathMatch[1] : (new URLSearchParams(window.location.search).get("eventId") || "1"));
        
        const res = await publicEventAPI.getParticipantBadge(eventId, value);
        const participant = res.data?.participant || res.data?.student || {};
        const teamName = participant.team_name || res.data?.team?.name || null;
        const targetId = participant.chest_number || participant.id || participant.student_id || value;
        const finalEventId = res.data?.event?.id ? String(res.data.event.id) : eventId;
        const badgeUrl = `/events/${finalEventId}/badge/${targetId}`;
        const badge: BadgeResult = {
          full_name: participant.name || participant.full_name || "Participant",
          chest_number: String(participant.chest_number || value),
          institution: res.data?.school?.name || "Institution",
          team_name: teamName,
          badge_code: String(participant.chest_number || value),
          programs: res.data?.programs || [],
          badge_url: badgeUrl,
        };
        setState({ status: "found", badge });
      } catch (e: any) {
        setState({ status: "missing" });
      }
    },
    [explicitEventId],
  );

  useEffect(() => {
    if (initialCode) run(initialCode);
  }, [initialCode, run]);

  return { code, setCode, state, run };
}
