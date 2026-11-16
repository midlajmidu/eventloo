import palace from "@/assets/gravitas/palace.webp";
import logo from "@/assets/gravitas/eventloo-logo.png";

export function Footer({ organizer, name }: { organizer?: string | undefined; name?: string | undefined }) {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-secondary via-secondary to-night-deep pt-48">
      <img src={palace} alt="" aria-hidden loading="lazy" width={1920} height={912}
        className="pointer-events-none absolute bottom-0 left-1/2 w-[1000px] max-w-none -translate-x-1/2 opacity-60 brightness-[0.35] saturate-150 sm:w-[1300px] [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_55%,transparent_90%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-night-deep via-night-deep/70 to-transparent" />
      <div className="relative flex flex-col items-center px-6 pb-14 pt-24 text-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Eventloo logo" width={46} height={32} className="h-8 w-auto" />
          <span className="font-display text-3xl font-semibold text-foreground">Eventloo</span>
        </div>
        <p className="mt-3 max-w-xs text-base text-foreground/80">Event Management for Colleges, Schools and Organizations</p>
        {organizer && <p className="mt-4 text-sm text-gold">Organised by {organizer}</p>}
        <p className="mt-8 text-xs tracking-widest text-foreground/50">© {new Date().getFullYear()} {name}</p>
      </div>
    </footer>
  );
}
