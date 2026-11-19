import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { lineLabel, requestLabel } from "@/lib/hub/labels";
import { LINE_ICONS } from "@/lib/hub/line-icons";
import type { LineId, RequestTypeId } from "@/lib/hub/types";

type IntakeSelectionSummaryProps = {
  line: LineId | null;
  requestType: RequestTypeId | null;
};

/** Shows the insurance line (and request type, once chosen) the client picked in the intake. */
export const IntakeSelectionSummary = ({ line, requestType }: IntakeSelectionSummaryProps) => {
  const { t } = useTranslation();
  if (!line) return null;
  const Icon = LINE_ICONS[line];

  return (
    <div className="flex flex-wrap items-center gap-2 motion-safe:animate-fade-up">
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-secondary py-1 pl-1 pr-3 text-sm">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="text-muted-foreground">{t("intake.step.line")}:</span>
        <span className="font-semibold text-foreground">{lineLabel(t, line)}</span>
      </span>
      {requestType ? (
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm">
          <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="text-muted-foreground">{t("intake.step.request")}:</span>
          <span className="font-semibold text-foreground">{requestLabel(t, requestType)}</span>
        </span>
      ) : null}
    </div>
  );
};
