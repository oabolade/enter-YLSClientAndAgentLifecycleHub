import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * The 30-second explainer: the wordless Framia video with an English voiceover and soft
 * music mixed in, each narration line timed to start with its caption below.
 * showCaptions is on only for a video without words of its own: the page then shows the
 * title and scene captions over it, spelled correctly and in the visitor's language.
 */
const EXPLAINER = {
  src: "/videos/yls-explainer.mp4",
  showCaptions: true,
};

/** When each caption starts, in seconds, following the storyboard given to Framia. */
const CUE_STARTS = [0, 3, 11, 20];

const activeCue = (time: number) =>
  CUE_STARTS.reduce((active, start, index) => (time >= start ? index : active), 0);

/** The explainer video on the homepage, with a short written outline of its three scenes. */
export const ExplainerVideo = () => {
  const { t } = useTranslation();
  const [cue, setCue] = useState(0);

  const scenes = [t("video.scene1"), t("video.scene2"), t("video.scene3")];
  const captions = [t("video.headline"), ...scenes];

  return (
    <section
      className="w-full space-y-4 motion-safe:animate-fade-up"
      aria-labelledby="explainer-title"
    >
      <div className="space-y-1">
        <h2 id="explainer-title" className="flex items-center gap-2 text-2xl font-semibold">
          <PlayCircle className="h-6 w-6 shrink-0 text-crimson" aria-hidden />
          {t("video.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("video.body")}</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border bg-primary shadow-card">
        {/* Only the first frame and length load until the visitor presses play. */}
        <video
          className="aspect-video w-full"
          src={`${EXPLAINER.src}#t=0.5`}
          controls
          playsInline
          preload="metadata"
          aria-label={t("video.label")}
          onTimeUpdate={(event) => setCue(activeCue(event.currentTarget.currentTime))}
          onSeeked={(event) => setCue(activeCue(event.currentTarget.currentTime))}
        >
          {t("video.unsupported")}
        </video>

        {EXPLAINER.showCaptions ? (
          // Sits at the top, clear of the play controls, and lets clicks through to the video.
          <div
            className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-primary/85 to-transparent px-4 pb-10 pt-3 text-primary-foreground sm:px-6 sm:pt-5"
            aria-live="polite"
          >
            <p
              key={cue}
              className={cn(
                "max-w-xl motion-safe:animate-hero-in",
                cue === 0
                  ? "text-lg font-semibold leading-snug sm:text-2xl"
                  : "text-sm font-medium sm:text-base",
              )}
            >
              {captions[cue]}
            </p>
            {cue === 0 ? (
              <span
                className="mt-2 block h-1 w-14 origin-left rounded-full bg-gradient-gold-line motion-safe:animate-line-grow"
                aria-hidden
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <ol className="grid gap-2 text-sm sm:grid-cols-3">
        {scenes.map((scene, index) => (
          <li
            key={scene}
            className={cn(
              "flex gap-2 rounded-xl border bg-card p-3 transition-colors",
              EXPLAINER.showCaptions && cue === index + 1 && "border-crimson",
            )}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <span>{scene}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {EXPLAINER.showCaptions ? t("video.noteCaptions") : t("video.note")}
      </p>
    </section>
  );
};
