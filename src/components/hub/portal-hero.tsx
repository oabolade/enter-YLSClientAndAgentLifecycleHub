import { HeartHandshake, Languages, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/** Banner photo supplied by YLS (made in Framia), re-encoded for the web. */
const HERO_IMAGE = { src: "/images/yls-hero-banner.jpg", width: 1600, height: 893 };

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
        "relative isolate overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-raised",
        className,
      )}
    >
      {/*
        The photo is a strip above the text on phones and tablets. On large screens it fills
        the banner, anchored right, so the people sit beside the text and its own navy
        left side carries the text.
      */}
      <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-auto sm:h-72 lg:absolute lg:inset-0 lg:-z-10 lg:h-auto motion-safe:animate-hero-settle">
        <img
          src={HERO_IMAGE.src}
          width={HERO_IMAGE.width}
          height={HERO_IMAGE.height}
          alt={t("hero.imageAlt")}
          decoding="async"
          className="h-full w-full object-cover object-[100%_30%] motion-safe:animate-hero-drift"
        />
        <div
          className="absolute inset-0 bg-gradient-hero-fade-up lg:bg-gradient-hero-fade"
          aria-hidden
        />
      </div>
      <div
        className="absolute -left-16 -top-24 -z-10 h-64 w-64 rounded-full bg-gold/20 blur-3xl motion-safe:animate-glow"
        aria-hidden
      />

      <div className="relative flex max-w-2xl flex-col justify-center gap-4 px-6 pb-8 pt-2 sm:px-10 sm:pb-10 lg:min-h-[400px] lg:max-w-[40%] lg:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold motion-safe:animate-hero-in">
          {t("nav.brandSub")}
        </p>
        <span
          className="block h-1 w-16 origin-left rounded-full bg-gradient-gold-line motion-safe:animate-line-grow"
          aria-hidden
        />
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl xl:text-5xl motion-safe:animate-hero-in motion-safe:[animation-delay:120ms]">
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
