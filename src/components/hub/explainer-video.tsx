import { PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

/** 30-second explainer made in Framia, streamed from the content server. */
const EXPLAINER_VIDEO_URL =
  "https://cdn.enter.pro/visual_resources/framia/793f05d9f03b440f91543d698c802783/0c0c5a9f-4fe4-4fd3-b804-6498fe3d35c1.f4v";

/** The explainer video on the homepage, with a short written outline of its three scenes. */
export const ExplainerVideo = () => {
  const { t } = useTranslation();

  const scenes = [t("video.scene1"), t("video.scene2"), t("video.scene3")];

  return (
    <section className="w-full space-y-4 motion-safe:animate-fade-up" aria-labelledby="explainer-title">
      <div className="space-y-1">
        <h2 id="explainer-title" className="flex items-center gap-2 text-2xl font-semibold">
          <PlayCircle className="h-6 w-6 shrink-0 text-crimson" aria-hidden />
          {t("video.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("video.body")}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-primary shadow-card">
        {/* Only the first frame and length load until the visitor presses play. */}
        <video
          className="aspect-video w-full"
          src={`${EXPLAINER_VIDEO_URL}#t=0.5`}
          controls
          playsInline
          preload="metadata"
          aria-label={t("video.label")}
        >
          {t("video.unsupported")}
        </video>
      </div>

      <ol className="grid gap-2 text-sm sm:grid-cols-3">
        {scenes.map((scene, index) => (
          <li key={scene} className="flex gap-2 rounded-xl border bg-card p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <span>{scene}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">{t("video.note")}</p>
    </section>
  );
};
