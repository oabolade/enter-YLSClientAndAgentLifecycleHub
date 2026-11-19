import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Car,
  CheckCircle2,
  HeartPulse,
  Home,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ChecklistEditor } from "@/components/hub/client/checklist-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LINES,
  REQUEST_TYPES,
  buildChecklist,
  completion,
  toSubmissionItems,
} from "@/lib/hub/checklists";
import { useHub } from "@/lib/hub/hub-context";
import { docLabel, lineLabel, requestDesc, requestLabel } from "@/lib/hub/labels";
import type { LineId, RequestTypeId, Submission, SubmissionItem } from "@/lib/hub/types";
import { cn } from "@/lib/utils";

const LINE_ICONS: Record<LineId, LucideIcon> = {
  auto: Car,
  home: Home,
  medicare: HeartPulse,
  commercial: Building2,
  life: Users,
};

export const IntakeWizard = () => {
  const { currentClient, resumeSubmissionId, intakePreset, submissions } = useHub();
  const { setResumeSubmissionId, setIntakePreset } = useHub();
  const [nonce, setNonce] = useState(0);
  const resume = submissions.find((entry) => entry.id === resumeSubmissionId) ?? null;

  return (
    <WizardForm
      key={`${currentClient?.id ?? ""}:${resumeSubmissionId ?? ""}:${intakePreset ?? ""}:${nonce}`}
      resume={resume}
      presetLine={intakePreset}
      onReset={() => {
        setResumeSubmissionId(null);
        setIntakePreset(null);
        setNonce((value) => value + 1);
      }}
    />
  );
};

type WizardFormProps = {
  resume: Submission | null;
  presetLine: LineId | null;
  onReset: () => void;
};

const WizardForm = ({ resume, presetLine, onReset }: WizardFormProps) => {
  const { t } = useTranslation();
  const { currentClient, submitIntake, updateSubmissionItems, setClientTab } = useHub();

  const [step, setStep] = useState(resume ? 2 : presetLine ? 1 : 0);
  const [line, setLine] = useState<LineId | null>(presetLine);
  const [requestType, setRequestType] = useState<RequestTypeId | null>(null);
  const [items, setItems] = useState<SubmissionItem[]>(resume ? resume.items : []);
  const [result, setResult] = useState<{ id: string; complete: boolean } | null>(null);

  const rebuild = (nextLine: LineId | null, nextRequest: RequestTypeId | null) => {
    if (!nextLine || !nextRequest) return;
    const fresh = toSubmissionItems(buildChecklist(nextLine, nextRequest));
    setItems((prev) =>
      fresh.map((entry) => {
        const kept = prev.find((old) => old.id === entry.id);
        // Keep what the client already provided; take the requirement itself from the new list.
        return kept ? { ...kept, ...entry, received: kept.received } : entry;
      }),
    );
  };

  const progress = completion(items);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  // Links the reviewer's results to this intake until it is filed and gets its own id.
  const [draftId] = useState(() => `draft-${crypto.randomUUID()}`);
  const checklistEditor = (
    <ChecklistEditor
      submissionId={resume?.id ?? draftId}
      lineOfBusiness={line ?? resume?.lines[0] ?? "unknown"}
      items={items}
      onChange={setItems}
      clientName={currentClient?.fullName ?? ""}
      onBusyChange={setChecking}
    />
  );

  const saveFailed = (error: unknown) => {
    console.error("Intake could not be saved", error);
    toast.error(t("common.saveError"));
  };

  const submit = async () => {
    // The intake is filed under the signed-in client's own record.
    if (!line || !requestType || saving || !currentClient) return;
    setSaving(true);
    try {
      const submission = await submitIntake({
        clientId: currentClient.id,
        line,
        requestType,
        items,
      });
      setResult({ id: submission.id, complete: progress.missing.length === 0 });
    } catch (error) {
      saveFailed(error);
    } finally {
      setSaving(false);
    }
  };

  const saveResume = async () => {
    if (!resume || saving) return;
    setSaving(true);
    try {
      await updateSubmissionItems(resume.id, items);
      setResult({ id: resume.id, complete: progress.missing.length === 0 });
    } catch (error) {
      saveFailed(error);
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Card className="animate-fade-up shadow-card">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          {result.complete ? (
            <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
          ) : (
            <AlertTriangle className="h-12 w-12 text-warning" aria-hidden />
          )}
          <h2 className="text-2xl font-semibold">{t("intake.submittedTitle")}</h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            {result.complete
              ? t("intake.submittedComplete", { id: result.id })
              : t("intake.submittedMissing", { id: result.id })}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                setClientTab("vault");
                onReset();
              }}
            >
              {t("intake.goVault")}
            </Button>
            <Button variant="outline" onClick={onReset}>
              {t("intake.startNew")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (resume) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">{t("intake.resumeTitle", { id: resume.id })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {checklistEditor}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onReset}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="crimson"
              disabled={saving || checking}
              onClick={() => void saveResume()}
            >
              {t("intake.resumeSave")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const steps = [
    t("intake.step.line"),
    t("intake.step.request"),
    t("intake.step.documents"),
    t("intake.step.review"),
  ];
  const titles = [
    t("intake.title.line"),
    t("intake.title.request"),
    t("intake.title.documents"),
    t("intake.title.review"),
  ];

  return (
    <Card className="shadow-card">
      <CardHeader className="space-y-5">
        <ol className="grid grid-cols-4 gap-2">
          {steps.map((label, index) => (
            <li key={label} className="space-y-2">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  index <= step ? "bg-crimson" : "bg-muted",
                )}
              />
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    index <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-xs font-medium sm:inline",
                    index === step ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
            </li>
          ))}
        </ol>
        <CardTitle className="text-2xl">{titles[step]}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {step === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {LINES.map((id) => {
              const Icon = LINE_ICONS[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setLine(id);
                    rebuild(id, requestType);
                    setStep(1);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-card lg:flex-col lg:items-start",
                    line === id && "border-primary ring-2 ring-primary/20",
                  )}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold">{lineLabel(t, id)}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {REQUEST_TYPES.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setRequestType(id);
                  rebuild(line, id);
                  setStep(2);
                }}
                className={cn(
                  "rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-card",
                  requestType === id && "border-primary ring-2 ring-primary/20",
                )}
              >
                <p className="text-sm font-semibold">{requestLabel(t, id)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{requestDesc(t, id)}</p>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? checklistEditor : null}

        {step === 3 && line && requestType ? (
          <div className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-secondary p-3">
                <dt className="text-xs text-muted-foreground">{t("intake.step.line")}</dt>
                <dd className="text-sm font-semibold">{lineLabel(t, line)}</dd>
              </div>
              <div className="rounded-lg bg-secondary p-3">
                <dt className="text-xs text-muted-foreground">{t("intake.step.request")}</dt>
                <dd className="text-sm font-semibold">{requestLabel(t, requestType)}</dd>
              </div>
            </dl>

            <ul className="space-y-1.5">
              {items
                .filter((entry) => entry.received || !entry.optional)
                .map((entry) => (
                  <li key={entry.id} className="flex items-start gap-2 text-sm">
                    {entry.received ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                    )}
                    <span>{docLabel(t, entry.id)}</span>
                  </li>
                ))}
            </ul>

            <p
              className={cn(
                "rounded-lg border p-3 text-sm font-medium",
                progress.missing.length
                  ? "border-warning/50 bg-warning-soft text-warning-foreground"
                  : "border-success/40 bg-success-soft text-success",
              )}
            >
              {progress.missing.length
                ? t("intake.missingWarning", { count: progress.missing.length })
                : t("intake.allSet")}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <Button
            variant="ghost"
            disabled={step === 0 || checking}
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft />
            {t("intake.back")}
          </Button>
          {step === 2 ? (
            <Button disabled={checking} onClick={() => setStep(3)}>
              {t("intake.next")}
              <ArrowRight />
            </Button>
          ) : null}
          {step === 3 ? (
            <Button variant="crimson" disabled={saving} onClick={() => void submit()}>
              {t("intake.submit")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
