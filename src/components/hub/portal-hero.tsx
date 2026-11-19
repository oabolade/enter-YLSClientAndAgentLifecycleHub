import { HeartHandshake, Languages, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * The banner photo, created in Framia. Null until the file is delivered; the banner
 * then shows its navy backdrop alone rather than a stand-in picture.
 */
const HERO_IMAGE_URL: string | null = null;

type PortalHeroProps = {
  title: string;
  body: string;
  className?: string;
};

/** Welcome banner shown to visitors on the sign-in screen and to clients in their portal. */
export const PortalHero = ({ title, body, className }: PortalHeroProps) => {
  const { t } = useTranslation();

  const points = [
    { icon: Languages, label: t("hero.pointLanguages") },
    { icon: ShieldCheck, label: t("hero.pointPrivate") },
    { icon: HeartHandshake, label: t("hero.pointPeople") },
  ];

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-gradient-navy text-primary-foreground shadow-raised",
        className,
      )}
    >
      {HERO_IMAGE_URL ? (
        <div className="absolute inset-y-0 right-0 -z-10 w-full motion-safe:animate-hero-settle sm:w-[78%]">
          <img
            src={HERO_IMAGE_URL}
            alt={t("hero.imageAlt")}
            crossOrigin="anonymous"
            className="h-full w-full object-cover object-[70%_center] motion-safe:animate-hero-drift"
          />
        </div>
      ) : null}
      {/* Keeps the text side calm and readable over the photo. */}
      <div className="absolute inset-0 -z-10 bg-gradient-hero-fade" aria-hidden />
      <div
        className="absolute -left-16 -top-24 -z-10 h-64 w-64 rounded-full bg-gold/20 blur-3xl motion-safe:animate-glow"
        aria-hidden
      />

      <div className="flex min-h-[300px] max-w-xl flex-col justify-center gap-4 px-6 py-10 sm:min-h-[360px] sm:px-10 lg:min-h-[400px]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold motion-safe:animate-hero-in">
          {t("nav.brandSub")}
        </p>
        <span
          className="block h-1 w-16 origin-left rounded-full bg-gradient-gold-line motion-safe:animate-line-grow"
          aria-hidden
        />
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl motion-safe:animate-hero-in motion-safe:[animation-delay:120ms]">
          {title}
        </h1>
        <p className="max-w-md text-sm text-primary-foreground/85 sm:text-base motion-safe:animate-hero-in motion-safe:[animation-delay:240ms]">
          {body}
        </p>
        <ul className="mt-2 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5 motion-safe:animate-hero-in motion-safe:[animation-delay:360ms]">
          {points.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 text-primary-foreground/90">
              <Icon className="h-4 w-4 shrink-0 text-gold" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
