import React, { useEffect } from "react";
import eventlooWhiteLogo from "@/assets/gravitas/eventloo-logo.png";
import eventlooColorLogo from "@/assets/eventloo-logo-color.png";
import eventlooBrutalistIcon from "@/assets/favicon-creative-brutalism.png";
import eventlooRetroIcon from "@/assets/favicon-retro-collegiate.png";

export { eventlooWhiteLogo, eventlooColorLogo, eventlooBrutalistIcon, eventlooRetroIcon };

/**
 * Official Eventloo Brand Logo Component
 * - variant="white": White monochrome official logo for dark backgrounds (e.g. Enchanted Illustrated)
 * - variant="color": Vibrant official logo for light/card backgrounds
 */
export function EventlooOfficialLogo({
  variant = "color",
  className = "h-7 w-auto shrink-0 object-contain",
  alt = "Eventloo",
}: {
  variant?: "color" | "white";
  className?: string;
  alt?: string;
}) {
  const src = variant === "white" ? eventlooWhiteLogo : eventlooColorLogo;
  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-contain transition-transform duration-200 hover:scale-105`}
    />
  );
}

// 1. Enchanted Illustrated (Dark sky header -> Official White Logo)
export function EnchantedGoldIcon({ className = "h-6 w-auto shrink-0" }: { className?: string }) {
  return <EventlooOfficialLogo variant="white" className={className} />;
}

// 2. Minimal Editorial (Parchment header -> Official Color Logo)
export function EditorialIcon({ className = "h-7 w-auto shrink-0" }: { className?: string }) {
  return <EventlooOfficialLogo variant="color" className={className} />;
}

// 3. Playful 3D World (Cream header -> Official Color Logo)
export function Playful3DIcon({ className = "h-8 w-auto shrink-0" }: { className?: string }) {
  return <EventlooOfficialLogo variant="color" className={className} />;
}

// 4. Retro Collegiate (Varsity header -> Authentic Retro Collegiate Seal)
export function RetroCollegiateIcon({ className = "h-7 w-7 shrink-0" }: { className?: string }) {
  return (
    <img
      src={eventlooRetroIcon}
      alt="Eventloo"
      className={`${className} object-contain transition-transform duration-200 hover:rotate-6`}
    />
  );
}

// 5. Creative Brutalism (Pop header -> Authentic Neo-Brutalist Pop Model Badge)
export function BrutalismIcon({ className = "h-7 w-auto shrink-0" }: { className?: string }) {
  return (
    <img
      src={eventlooBrutalistIcon}
      alt="Eventloo"
      className={`${className} object-contain transition-transform duration-200 hover:scale-105 hover:-rotate-3`}
    />
  );
}

// 6. Swiss Modernist (Clean modernist header -> Official Color Logo)
export function SwissModernistIcon({ className = "h-7 w-auto shrink-0" }: { className?: string }) {
  return <EventlooOfficialLogo variant="color" className={className} />;
}

/**
 * Dynamically sets the browser tab favicon to match the active theme:
 * - creative-brutalism: Neo-brutalist pop model favicon
 * - retro-collegiate: Vintage varsity collegiate seal favicon
 * - other themes / default: Official Eventloo favicon
 */
export function useThemeFavicon(themeId?: string) {
  useEffect(() => {
    const faviconPath =
      themeId === "creative-brutalism"
        ? "/favicon-creative-brutalism.png"
        : themeId === "retro-collegiate"
        ? "/favicon-retro-collegiate.png"
        : "/favicon.png";

    const links = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
    if (links.length === 0) {
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.href = faviconPath;
      document.head.appendChild(link);
    } else {
      links.forEach((link) => {
        link.href = faviconPath;
        link.type = "image/png";
      });
    }
  }, [themeId]);
}
