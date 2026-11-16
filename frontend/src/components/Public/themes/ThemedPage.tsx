import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Link } from "./TanstackRouterAdapter";
import { publicEventAPI } from "@/services/api";
import { mapEventlooToSiteData } from "@/lib/site-data";
import { resolveTheme, themes } from "./themeRegistry";
import { useThemeFavicon } from "./ThemedEventlooLogo";
import type { ThemePageKey } from "./themeTypes";
import type { SiteData } from "@/lib/site-types";
import { RefreshCw, AlertCircle } from "lucide-react";

/** Central theme resolver: reads the event's saved theme (or an admin preview) and renders that theme's page. */
export function ThemedPage({
  page = "landing",
  preview: propPreview,
  code: propCode,
  scan: propScan,
  initialData,
}: {
  page: ThemePageKey;
  preview?: string;
  code?: string;
  scan?: boolean;
  initialData?: SiteData;
}) {
  const { eventId: paramEventId } = useParams();
  const [searchParams] = useSearchParams();
  const eventId = paramEventId || "2";

  const preview = propPreview || searchParams.get("preview") || undefined;
  const code = propCode || searchParams.get("code") || undefined;
  const scan = propScan ?? (searchParams.has("scan") ? (searchParams.get("scan") !== "false" && searchParams.get("scan") !== "0") : true);

  const [siteData, setSiteData] = useState<SiteData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useThemeFavicon(preview || siteData?.event?.website_theme || "enchanted-illustrated");

  useEffect(() => {
    if (initialData) return;
    let active = true;
    const fetchPortal = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await publicEventAPI.getPublicPortal(eventId);
        if (active) {
          const mapped = mapEventlooToSiteData(res.data);
          setSiteData(mapped);
        }
      } catch (err: any) {
        if (active) {
          console.error("Failed to load public portal:", err);
          setError(err?.response?.data?.error || "This event public portal is unavailable.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchPortal();
    return () => {
      active = false;
    };
  }, [eventId, initialData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090817] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 animate-pulse">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs uppercase tracking-widest text-amber-200/80 font-bold">
          Loading Festival Experience...
        </p>
      </div>
    );
  }

  if (error || !siteData) {
    return (
      <div className="min-h-screen bg-[#090817] flex flex-col items-center justify-center text-center p-6">
        <div className="max-w-md w-full bg-[#15122F] border border-amber-500/30 rounded-3xl p-8 shadow-2xl space-y-4 text-white">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold">Portal Unavailable</h2>
          <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  const theme = resolveTheme(siteData.event?.website_theme, preview);
  const PageComponent = theme.pages?.[page] || theme.pages?.landing;
  const previewing = preview && themes.some((t) => t.id === preview) && preview !== siteData.event?.website_theme;

  if (!PageComponent) {
    return <div>Theme page not found</div>;
  }

  return (
    <>
      {previewing && (
        <div className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-[#111] border-t border-amber-400/40 px-4 py-2.5 text-xs text-amber-200 shadow-2xl">
          <span>
            Previewing <strong>{theme.name}</strong> &mdash; visitors see the active published theme.
          </span>
          <Link
            to="/admin"
            className="rounded-full bg-amber-400 px-3 py-1 font-bold text-slate-950 hover:bg-amber-300 transition-colors"
          >
            Back to settings
          </Link>
        </div>
      )}
      <PageComponent data={siteData} preview={previewing ? preview : undefined} code={code} scan={scan} />
    </>
  );
}

export default ThemedPage;
