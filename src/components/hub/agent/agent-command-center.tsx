import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  FileWarning,
  Languages,
  Lightbulb,
  Mail,
  MessageCircleReply,
  Phone,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { completion } from "@/lib/hub/checklists";
import { useHub } from "@/lib/hub/hub-context";
import {
  LANGUAGE_NAME_EN,
  LINE_NAME_EN,
  REQUEST_NAME_EN,
  docLabel,
} from "@/lib/hub/labels";
import type { Handoff, HandoffReason, Submission } from "@/lib/hub/types";

// The Agent Command Center is always in English, so its copy lives here, not in the locale files.

/** Sample history shown before live activity accumulates. */
const BASELINE_INCOMPLETE_CAUGHT = 37;
const BASELINE_AUTO_RESOLVED = 112;
const PREP_MINUTES_SAVED = 12;

const REASON_LABEL: Record<HandoffReason, string> = {
  immediate_coverage_change: "Immediate coverage change",
  commercial_complex: "Complex commercial / claims",
  medicare_comparison: "Medicare plan comparison",
  frustrated: "Frustrated client",
  human_request: "Asked for an agent",
  unanswered: "AI could not answer",
  document_request: "Document request",
  callback_request: "Callback request",
};

const REASON_ACTION: Record<HandoffReason, string> = {
  immediate_coverage_change:
    "Call the client back today. Confirm the requested change and effective date directly with them before processing it with the carrier.",
  commercial_complex:
    "Review the policy file and loss history, then call the client to discuss the underwriting or claim issue.",
  medicare_comparison:
    "Schedule a licensed Medicare review call. Confirm current prescriptions and physician before comparing plans.",
  frustrated: "Call the client promptly, acknowledge the issue and take ownership of the next step.",
  human_request: "Call the client back in their preferred language.",
  unanswered: "Contact the client to answer the question the concierge could not.",
  document_request: "Send the requested ID card or COI to the client and confirm receipt.",
  callback_request: "Call the client to discuss the requested coverage review.",
};

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

const intakeTitle = (submission: Submission) =>
  submission.seedTitle === "teenDriverHome"
    ? "Add Teen Driver + New Quote (Home)"
    : `${submission.lines.map((line) => LINE_NAME_EN[line]).join(" & ")} · ${
        submission.requestType ? REQUEST_NAME_EN[submission.requestType] : "Request"
      }`;

type Selection = { type: "intake" | "handoff"; id: string } | null;

export const AgentCommandCenter = () => {
  const hub = useHub();
  const [selection, setSelection] = useState<Selection>(null);

  const clientOf = (id: string | null) => hub.clients.find((client) => client.id === id) ?? null;
  const incomplete = hub.submissions.filter((entry) => completion(entry.items).missing.length > 0);

  const kpis = [
    {
      icon: FileWarning,
      label: "Incomplete Submissions Caught",
      value: String(BASELINE_INCOMPLETE_CAUGHT + incomplete.length),
      note: "Sample history plus open items in this hub",
    },
    {
      icon: MessageCircleReply,
      label: "Routine Inquiries Auto-Resolved",
      value: String(BASELINE_AUTO_RESOLVED + hub.autoResolved),
      note: "Sample history plus concierge answers recorded in this hub",
    },
    {
      icon: Clock3,
      label: "Avg. Agent Prep Time Saved",
      value: `~${PREP_MINUTES_SAVED} min`,
      note: "Illustrative estimate per request, not measured",
    },
  ];

  const rowProps = (next: NonNullable<Selection>) => ({
    tabIndex: 0,
    role: "button",
    className: "cursor-pointer",
    onClick: () => setSelection(next),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSelection(next);
      }
    },
  });

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-semibold sm:text-4xl">Agent Command Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every intake and escalated chat, summarized in English and ready to act on.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="shadow-card">
            <CardContent className="flex items-start gap-4 pt-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <kpi.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </p>
                <p className="font-display text-3xl font-semibold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.note}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-xl">
              Incoming Client Intakes
              <Badge variant="muted">{hub.submissions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hub.submissions.map((submission) => {
                  const client = clientOf(submission.clientId);
                  const missing = completion(submission.items).missing.length;
                  return (
                    <TableRow
                      key={submission.id}
                      {...rowProps({ type: "intake", id: submission.id })}
                    >
                      <TableCell>
                        <p className="font-medium">{client?.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {client ? LANGUAGE_NAME_EN[client.preferredLanguage] : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{intakeTitle(submission)}</p>
                        <p className="text-xs text-muted-foreground">
                          {submission.id}
                          {submission.sample ? " · Sample" : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={missing ? "danger" : "success"}>
                          {missing ? `${missing} missing` : "Complete"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                        {ago(submission.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-xl">
              Escalated Chat Handoffs
              <Badge variant="crimson">{hub.handoffs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="hidden sm:table-cell">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hub.handoffs.map((handoff) => (
                  <TableRow key={handoff.id} {...rowProps({ type: "handoff", id: handoff.id })}>
                    <TableCell>
                      <p className="font-medium">{handoff.contactName}</p>
                      <p className="text-xs text-muted-foreground">
                        {LANGUAGE_NAME_EN[handoff.language]}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="crimson">{REASON_LABEL[handoff.reason]}</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {handoff.id}
                        {handoff.sample ? " · Sample" : ""}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {ago(handoff.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Sheet open={selection !== null} onOpenChange={(open) => !open && setSelection(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selection ? <PrepDrawer selection={selection} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Phone;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-2 rounded-xl border bg-card p-4">
    <h3 className="flex items-center gap-2 font-sans text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-4 w-4 text-crimson" aria-hidden />
      {title}
    </h3>
    {children}
  </section>
);

const PrepDrawer = ({ selection }: { selection: NonNullable<Selection> }) => {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT("en");
  const hub = useHub();
  const [sending, setSending] = useState(false);

  const sendReminder = async (submissionId: string) => {
    setSending(true);
    try {
      await hub.sendReminder(submissionId);
    } catch (error) {
      console.error("Reminder could not be saved", error);
      toast.error("The reminder could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handoff: Handoff | null =
    selection.type === "handoff"
      ? (hub.handoffs.find((entry) => entry.id === selection.id) ?? null)
      : null;
  const clientId =
    selection.type === "intake"
      ? (hub.submissions.find((entry) => entry.id === selection.id)?.clientId ?? null)
      : (handoff?.clientId ?? null);
  const client = hub.clients.find((entry) => entry.id === clientId) ?? null;

  // For a handoff, show the client's open submission (if any) so the agent sees document gaps.
  const submission: Submission | null =
    selection.type === "intake"
      ? (hub.submissions.find((entry) => entry.id === selection.id) ?? null)
      : (hub.submissions.find(
          (entry) => entry.clientId === clientId && completion(entry.items).missing.length > 0,
        ) ?? null);

  const progress = submission ? completion(submission.items) : null;
  const language = handoff?.language ?? client?.preferredLanguage ?? "en";
  const languageName = LANGUAGE_NAME_EN[language];
  const reminders = submission
    ? hub.reminders.filter((entry) => entry.submissionId === submission.id)
    : [];

  const intakeSummary =
    submission && progress && client
      ? `${client.fullName} submitted "${intakeTitle(submission)}". ${progress.done} of ${progress.total} required items received.${
          progress.missing.length
            ? ` Missing: ${progress.missing.map((entry) => docLabel(t, entry.id)).join("; ")}.`
            : " Nothing is missing."
        } Preferred language: ${languageName}.`
      : "";

  const nextAction = handoff
    ? REASON_ACTION[handoff.reason]
    : progress?.missing.length
      ? `Send the automated reminder for the ${progress.missing.length} missing item(s) in ${languageName}, then follow up by phone if nothing arrives.`
      : "All required items are in. Review the documents and prepare the quote or change request.";

  return (
    <div className="space-y-4">
      <SheetHeader className="text-left">
        <SheetTitle className="text-2xl">Agent Prep · {selection.id}</SheetTitle>
        <SheetDescription>
          {handoff ? REASON_LABEL[handoff.reason] : submission ? intakeTitle(submission) : ""}
        </SheetDescription>
      </SheetHeader>

      <Section icon={Languages} title="Client">
        <p className="text-lg font-semibold">{handoff?.contactName ?? client?.fullName}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">Prefers {languageName}</Badge>
        </div>
        <p className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
          {handoff?.contactPhone ?? client?.phone}
        </p>
        {client?.email ? (
          <p className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
            {client.email}
          </p>
        ) : null}
      </Section>

      <Section icon={MessageCircleReply} title="AI English Summary (simulated)">
        <p className="text-sm">{handoff ? handoff.englishSummary : intakeSummary}</p>
        {handoff ? (
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Client's original wording ({languageName})
            </p>
            <p className="mt-1 text-sm">{handoff.originalMessage}</p>
          </div>
        ) : null}
      </Section>

      <Section icon={FileWarning} title="Document Completeness Checklist">
        {submission && progress ? (
          <>
            <p className="text-xs text-muted-foreground">
              {submission.id} · {intakeTitle(submission)} · {submission.completionPct}% complete
            </p>
            <ul className="space-y-1.5">
              {submission.items
                .filter((entry) => entry.received || !entry.optional)
                .map((entry) => (
                  <li key={entry.id} className="flex items-start gap-2 text-sm">
                    {entry.received ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                    )}
                    <span className={entry.received ? "" : "font-medium text-destructive"}>
                      {docLabel(t, entry.id)}
                      {entry.fileName ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {entry.fileName}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
            </ul>
            <Button
              variant="crimson"
              className="h-auto w-full whitespace-normal py-2"
              disabled={progress.missing.length === 0 || sending}
              onClick={() => void sendReminder(submission.id)}
            >
              <BellRing />
              Send Automated Reminder in Client's Language
            </Button>
            {reminders.map((reminder) => (
              <div key={reminder.id} className="space-y-2 rounded-lg border bg-success-soft/60 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Sent to the client's Policy Vault {ago(reminder.sentAt)} (in-app only)
                </p>
                <p className="text-sm">{reminder.message}</p>
                <p className="text-xs text-muted-foreground">
                  English reference: {reminder.englishReference}
                </p>
              </div>
            ))}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No open submission for this client.</p>
        )}
      </Section>

      <Section icon={Lightbulb} title="Suggested Next Action">
        <p className="text-sm font-medium">{nextAction}</p>
      </Section>
    </div>
  );
};
