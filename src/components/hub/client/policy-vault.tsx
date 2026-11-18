import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  FolderOpen,
  Lightbulb,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ProgressBar } from "@/components/hub/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fallbackLng, normalizeLanguage } from "@/i18n/config";
import { completion } from "@/lib/hub/checklists";
import { useHub } from "@/lib/hub/hub-context";
import { docLabel, lineLabel, submissionTitle } from "@/lib/hub/labels";
import { downloadSampleDocument } from "@/lib/hub/sample-pdf";
import type { LangCode, Policy } from "@/lib/hub/types";
import { useNudge } from "@/lib/hub/use-nudge";

const RENEWAL_WARNING_DAYS = 30;
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const daysUntil = (date: string) =>
  Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000);

export const PolicyVault = () => {
  const { t, i18n } = useTranslation();
  const hub = useHub();
  const { currentClient } = hub;
  const [callbacks, setCallbacks] = useState<Record<string, string>>({});
  const [requesting, setRequesting] = useState(false);

  const language = (normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) ??
    fallbackLng) as LangCode;
  const nudge = useNudge(currentClient, language);
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(value));

  const startIntake = () => {
    hub.setResumeSubmissionId(null);
    hub.setIntakePreset(null);
    hub.setClientTab("intake");
  };

  const mySubmissions = hub.submissions.filter((entry) => entry.clientId === currentClient?.id);
  const myReminders = hub.reminders.filter((entry) => entry.clientId === currentClient?.id);

  if (!currentClient || (currentClient.policies.length === 0 && mySubmissions.length === 0)) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground" aria-hidden />
          <h2 className="text-2xl font-semibold">{t("vault.emptyTitle")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t("vault.emptyBody")}</p>
          <Button variant="crimson" onClick={startIntake}>
            {t("vault.emptyCta")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // The nudge agent picks the suggestion and writes it; the standard wording is the fallback.
  const recommendation = nudge.recommendation;
  const medicarePolicy = currentClient.policies.find((policy) => policy.line === "medicare");
  const callbackId = callbacks[currentClient.id];

  const requestCallback = async (topic: string, title: string, line: Policy["line"]) => {
    if (requesting) return;
    setRequesting(true);
    try {
      const handoff = await hub.createHandoff({
        client: currentClient,
        contactName: currentClient.fullName,
        contactPhone: currentClient.phone,
        language,
        reason: "callback_request",
        line,
        action: null,
        originalMessage: title,
        topic,
        // Fixed English topic for the agent's brief; no AI translation needed.
        skipBrief: true,
      });
      setCallbacks((prev) => ({ ...prev, [currentClient.id]: handoff.id }));
    } catch (error) {
      console.error("Callback request could not be saved", error);
      toast.error(t("common.saveError"));
    } finally {
      setRequesting(false);
    }
  };

  const recTitle =
    recommendation === "bundleHome"
      ? t("vault.rec.bundleHome.title")
      : recommendation === "group"
        ? t("vault.rec.group.title")
        : t("vault.rec.medicareReview.title");
  const recBody =
    recommendation === "bundleHome"
      ? t("vault.rec.bundleHome.body")
      : recommendation === "group"
        ? t("vault.rec.group.body")
        : t("vault.rec.medicareReview.body", {
            date: medicarePolicy ? formatDate(medicarePolicy.renewalDate) : "",
          });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {currentClient.policies.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">{t("vault.policies")}</h2>
            <div className="grid gap-4">
              {currentClient.policies.map((policy) => {
                const days = daysUntil(policy.renewalDate);
                return (
                  <Card key={policy.policyNumber} className="overflow-hidden shadow-card">
                    <div className="h-1.5 bg-gradient-navy" />
                    <CardHeader className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {lineLabel(t, policy.line)}
                          </p>
                          <CardTitle className="text-2xl">{policy.policyNumber}</CardTitle>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={policy.status === "active" ? "success" : "warning"}>
                            {policy.status === "active"
                              ? t("vault.status.active")
                              : t("vault.status.renewalReview")}
                          </Badge>
                          <Badge
                            variant={days < RENEWAL_WARNING_DAYS ? "warning" : "muted"}
                            className="gap-1"
                          >
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                            {days >= 0 ? t("vault.renewsIn", { days }) : t("vault.renewalPassed")}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Fact label={t("vault.policyNumber")} value={policy.policyNumber} />
                        <Fact label={t("vault.carrier")} value={policy.carrier} />
                        <Fact
                          label={t("vault.premium")}
                          value={currency.format(policy.premiumMonthly)}
                        />
                        <Fact label={t("vault.deductible")} value={policy.deductible} />
                      </dl>
                      <p className="text-xs text-muted-foreground">
                        {t("vault.renewsOn", { date: formatDate(policy.renewalDate) })}
                      </p>
                      <div className="space-y-2 border-t pt-4">
                        <p className="text-sm font-semibold">{t("vault.documents")}</p>
                        <div className="flex flex-wrap gap-2">
                          {policy.documents.map((name) => (
                            <Button
                              key={name}
                              variant="outline"
                              size="sm"
                              className="h-auto max-w-full whitespace-normal py-1.5 text-left"
                              onClick={() => downloadSampleDocument(currentClient, policy, name)}
                            >
                              <Download />
                              <span className="break-all">{name}</span>
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{t("vault.sampleNote")}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("vault.tracker")}</h2>
          {mySubmissions.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-6 text-sm text-muted-foreground">
                {t("vault.trackerEmpty")}
              </CardContent>
            </Card>
          ) : (
            mySubmissions.map((submission) => {
              const progress = completion(submission.items);
              const open = progress.missing.length > 0;
              return (
                <Card key={submission.id} className="shadow-card">
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">{submission.id}</p>
                        <p className="font-semibold">{submissionTitle(t, submission)}</p>
                      </div>
                      <Badge variant={open ? "warning" : "success"}>
                        {open ? t("vault.trackerAction") : t("vault.trackerComplete")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <ProgressBar
                        value={submission.completionPct}
                        tone={open ? "warning" : "success"}
                      />
                      <span className="text-sm font-semibold tabular-nums">
                        {submission.completionPct}%
                      </span>
                    </div>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {submission.items
                        .filter((entry) => entry.received || !entry.optional)
                        .map((entry) => (
                          <li key={entry.id} className="flex items-start gap-2 text-sm">
                            {entry.received ? (
                              <CheckCircle2
                                className="mt-0.5 h-4 w-4 shrink-0 text-success"
                                aria-hidden
                              />
                            ) : (
                              <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                                aria-hidden
                              />
                            )}
                            <span>{docLabel(t, entry.id)}</span>
                          </li>
                        ))}
                    </ul>
                    {open ? (
                      <Button
                        variant="crimson"
                        size="sm"
                        onClick={() => {
                          hub.setIntakePreset(null);
                          hub.setResumeSubmissionId(submission.id);
                          hub.setClientTab("intake");
                        }}
                      >
                        {t("vault.finish")}
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>
      </div>

      <aside className="space-y-6">
        {recommendation ? (
          <Card className="border-crimson/30 bg-crimson-soft shadow-card">
            <CardHeader className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-crimson">
                <Lightbulb className="h-4 w-4" aria-hidden />
                {t("vault.rec.title")}
              </p>
              <CardTitle className="text-xl">{recTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {nudge.loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
              ) : (
                <div className="space-y-1">
                  <p className="text-sm">{nudge.body ?? recBody}</p>
                  {nudge.body ? (
                    <p className="text-xs text-muted-foreground">{t("vault.rec.aiNote")}</p>
                  ) : null}
                </div>
              )}
              {recommendation === "bundleHome" ? (
                <Button
                  variant="crimson"
                  onClick={() => {
                    hub.setResumeSubmissionId(null);
                    hub.setIntakePreset("home");
                    hub.setClientTab("intake");
                  }}
                >
                  {t("vault.rec.startIntake")}
                </Button>
              ) : callbackId ? (
                <p className="text-sm font-medium text-success">
                  {t("vault.rec.callbackSent", { id: callbackId })}
                </p>
              ) : (
                <Button
                  variant="crimson"
                  disabled={requesting}
                  onClick={() =>
                    void (recommendation === "group"
                      ? requestCallback(
                          "Group Insurance review for employees",
                          recTitle,
                          "commercial",
                        )
                      : requestCallback(
                          `Medicare renewal review before ${medicarePolicy?.renewalDate ?? "renewal"}`,
                          recTitle,
                          "medicare",
                        ))
                  }
                >
                  {t("vault.rec.requestCallback")}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : null}

        {myReminders.length > 0 ? (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquareText className="h-4 w-4 text-crimson" aria-hidden />
                {t("vault.reminders")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {myReminders.map((reminder) => (
                <div key={reminder.id} className="rounded-lg border bg-secondary/60 p-3">
                  <p className="text-sm">{reminder.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("vault.reminderSent", { date: formatDate(reminder.sentAt) })}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </aside>
    </div>
  );
};

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm font-semibold">{value}</dd>
  </div>
);
