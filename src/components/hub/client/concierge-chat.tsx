import { useEffect, useRef, useState } from "react";
import { Download, Headset, PhoneCall, SendHorizontal, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fallbackLng, normalizeLanguage } from "@/i18n/config";
import { askTriage } from "@/lib/hub/agents";
import { buildChecklist, completion } from "@/lib/hub/checklists";
import { intakeStatusFor, toAppReason, type ChatTurn } from "@/lib/hub/covey";
import { APPROVED_FAQS } from "@/lib/hub/faqs";
import { useHub } from "@/lib/hub/hub-context";
import { docLabel, lineLabel } from "@/lib/hub/labels";
import { downloadSampleDocument } from "@/lib/hub/sample-pdf";
import {
  classifyChip,
  detectLine,
  mandatoryHandoff,
  relatedPolicy,
  type Triage,
} from "@/lib/hub/triage";
import type { ChatMessage, ChipId, LangCode, PendingHandoff, Reply } from "@/lib/hub/types";
import { cn } from "@/lib/utils";

const isCoi = (name: string) => /coi|certificate/i.test(name);
const uid = () => crypto.randomUUID();

export const ConciergeChat = () => {
  const { t, i18n } = useTranslation();
  const { chat, pushChat, currentClient, createHandoff, recordAutoResolved, submissions } = useHub();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chat.length, busy]);

  const language = (normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) ??
    fallbackLng) as LangCode;

  const chips: { id: ChipId; label: string }[] = [
    { id: "addDriver", label: t("chat.chip.addDriver") },
    { id: "downloadCoi", label: t("chat.chip.downloadCoi") },
    { id: "urgentCommercial", label: t("chat.chip.urgentCommercial") },
    { id: "status", label: t("chat.chip.status") },
  ];

  const saveFailed = (error: unknown) => {
    console.error("Concierge request could not be saved", error);
    toast.error(t("common.saveError"));
  };

  /** The handoff reply is only shown once the agent queue has actually received it. */
  const startHandoff = async (pending: PendingHandoff): Promise<Reply> => {
    // Every signed-in client has a record; without one the handoff cannot be filed.
    if (!currentClient) throw new Error("No client record is loaded for this account.");
    const handoff = await createHandoff({
      client: currentClient,
      contactName: currentClient.fullName,
      contactPhone: currentClient.phone,
      language,
      ...pending,
    });
    return { kind: "handoff", handoffId: handoff.id, phone: currentClient.phone };
  };

  const respond = async (
    triage: Triage,
    originalMessage: string,
    skipBrief = false,
  ): Promise<Reply> => {
    if (triage.tier === 2) {
      return startHandoff({
        reason: triage.reason,
        line: triage.line,
        action: triage.action,
        originalMessage,
        skipBrief,
      });
    }
    const resolved = (reply: Reply): Reply => {
      recordAutoResolved(language);
      return reply;
    };
    switch (triage.intent) {
      case "docs":
        return resolved({
          kind: "docs",
          line: triage.addDriver ? "auto" : (triage.line ?? currentClient?.policies[0]?.line ?? null),
          addDriver: triage.addDriver,
        });
      case "download": {
        const policy = currentClient?.policies.find((entry) =>
          triage.wantsCoi ? entry.documents.some(isCoi) : entry.documents.length > 0,
        );
        if (!policy) return { kind: "noDocument", originalMessage };
        return resolved({
          kind: "download",
          policyNumber: policy.policyNumber,
          documents: triage.wantsCoi ? policy.documents.filter(isCoi) : policy.documents,
        });
      }
      case "contact":
        return resolved({ kind: "contact" });
      case "payment":
        return resolved({
          kind: "payment",
          carrier: relatedPolicy(currentClient, triage.line)?.carrier ?? null,
        });
      case "status":
        return resolved({ kind: "status" });
      case "fallback":
        return { kind: "fallback", originalMessage };
    }
  };

  const deliver = async (userMessage: ChatMessage, build: () => Promise<Reply>) => {
    pushChat([userMessage]);
    setBusy(true);
    try {
      const reply = await build();
      pushChat([{ id: uid(), role: "assistant", reply }]);
    } catch (error) {
      saveFailed(error);
    } finally {
      setBusy(false);
    }
  };

  /** The last few turns, so the agents see the conversation. */
  const recentTurns = (): ChatTurn[] =>
    chat
      .flatMap((entry): ChatTurn[] => {
        if (entry.role === "user") return entry.text ? [{ role: "user", content: entry.text }] : [];
        return entry.reply.kind === "ai" ? [{ role: "assistant", content: entry.reply.text }] : [];
      })
      .slice(-6);

  /** A typed message goes to the triage agent; if it is down, the client is offered a person. */
  const answer = async (message: string): Promise<Reply> => {
    // Hard-coded guardrail first: these requests go to a person whatever the AI would say.
    const mandatory = mandatoryHandoff(message);
    if (mandatory) return respond(mandatory, message);

    const mine = submissions.filter((entry) => entry.clientId === currentClient?.id);
    const open = mine.find((entry) => completion(entry.items).missing.length > 0) ?? mine[0];
    const recentMessages = recentTurns();
    try {
      const result = await askTriage({
        submissionId: open?.id ?? `chat-${currentClient?.id ?? "unknown"}`,
        language,
        message,
        recentMessages,
        intakeStatus: open ? intakeStatusFor(open.id, open.items) : null,
        faqs: APPROVED_FAQS,
      });
      if (result.route === "offer_handoff") {
        // The callback is only filed once the client confirms with the button.
        return {
          kind: "ai",
          text: result.client_reply,
          offer: {
            reason: toAppReason(result.handoff_reason),
            line: detectLine(message),
            action: null,
            originalMessage: message,
            topic: message.slice(0, 200),
            recentMessages,
          },
        };
      }
      recordAutoResolved(language);
      return { kind: "ai", text: result.client_reply };
    } catch (error) {
      console.error("Triage agent unavailable", error);
      return { kind: "unavailable", originalMessage: message };
    }
  };

  const send = (text: string, chip?: ChipId) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setDraft("");
    void deliver(
      chip ? { id: uid(), role: "user", chip } : { id: uid(), role: "user", text: trimmed },
      // Quick-reply buttons have a fixed meaning, so they skip the AI.
      () => (chip ? respond(classifyChip(chip), trimmed, true) : answer(trimmed)),
    );
  };

  const talkToAgent = () => {
    if (busy) return;
    const label = t("chat.talkToAgent");
    void deliver({ id: uid(), role: "user", text: label }, () =>
      startHandoff({
        reason: "human_request",
        line: null,
        action: null,
        originalMessage: label,
        skipBrief: true,
      }),
    );
  };

  const acceptOffer = async (messageId: string, pending: PendingHandoff) => {
    if (busy) return;
    setBusy(true);
    try {
      const reply = await startHandoff(pending);
      setAccepted((prev) => [...prev, messageId]);
      pushChat([{ id: uid(), role: "assistant", reply }]);
    } catch (error) {
      saveFailed(error);
    } finally {
      setBusy(false);
    }
  };

  const lastHandoff = [...chat]
    .reverse()
    .find((entry) => entry.role === "assistant" && entry.reply.kind === "handoff");
  const bannerPhone =
    lastHandoff?.role === "assistant" && lastHandoff.reply.kind === "handoff"
      ? lastHandoff.reply.phone
      : null;

  return (
    <Card className="shadow-card">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-5 w-5 text-crimson" aria-hidden />
            {t("chat.title")}
          </CardTitle>
          <Badge variant="muted">{t("chat.aiBadge")}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{t("chat.subtitle")}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {bannerPhone ? (
          <div
            role="status"
            className="flex items-start motion-safe:animate-fade-up gap-3 rounded-xl border border-crimson/30 bg-crimson-soft p-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-crimson text-crimson-foreground">
              <PhoneCall className="h-4 w-4" aria-hidden />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-crimson">{t("chat.banner.title")}</p>
              <p className="text-sm">{t("chat.banner.body")}</p>
              <p className="text-xs text-muted-foreground">
                {t("chat.banner.callback", { phone: bannerPhone })}
              </p>
            </div>
          </div>
        ) : null}

        <div
          ref={scrollRef}
          className="h-[380px] space-y-3 overflow-y-auto rounded-xl border bg-secondary/50 p-3 sm:p-4"
        >
          <Bubble role="assistant">{t("chat.reply.greeting")}</Bubble>
          {chat.map((message, index) =>
            message.role === "user" ? (
              <Bubble key={message.id} role="user" animate={index === chat.length - 1}>
                {message.chip
                  ? chips.find((chip) => chip.id === message.chip)?.label
                  : message.text}
              </Bubble>
            ) : (
              <Bubble
                key={message.id}
                role="assistant"
                highlight={message.reply.kind === "handoff"}
                animate={index === chat.length - 1}
              >
                <ReplyContent
                  reply={message.reply}
                  offerDisabled={busy || accepted.includes(message.id)}
                  onAcceptOffer={(pending) => void acceptOffer(message.id, pending)}
                />
              </Bubble>
            ),
          )}
          {busy ? (
            <Bubble role="assistant" animate>
              <span className="flex h-4 items-center gap-1" aria-hidden>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 animate-dot rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </Bubble>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Button
              key={chip.id}
              type="button"
              variant="chip"
              size="sm"
              className="h-auto whitespace-normal py-1.5 text-left"
              disabled={busy}
              onClick={() => send(chip.label, chip.id)}
            >
              {chip.label}
            </Button>
          ))}
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <Input
            value={draft}
            maxLength={1000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
          />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 sm:flex-none" disabled={busy}>
              <SendHorizontal />
              {t("chat.send")}
            </Button>
            <Button
              type="button"
              variant="crimson"
              className="flex-1 sm:flex-none"
              disabled={busy}
              onClick={talkToAgent}
            >
              <Headset />
              {t("chat.talkToAgent")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

type BubbleProps = {
  role: "user" | "assistant";
  highlight?: boolean;
  /** Only the newest bubble pops in; older ones would replay on every tab switch. */
  animate?: boolean;
  children: React.ReactNode;
};

const Bubble = ({ role, highlight, animate, children }: BubbleProps) => (
  <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
    <div
      className={cn(
        "max-w-[88%] space-y-2 rounded-2xl px-4 py-2.5 text-sm sm:max-w-[75%]",
        animate && "motion-safe:animate-pop-in",
        role === "user"
          ? "origin-bottom-right rounded-br-sm bg-primary text-primary-foreground"
          : "origin-bottom-left rounded-bl-sm border bg-card",
        highlight && "border-crimson/40",
      )}
    >
      {children}
    </div>
  </div>
);

type ReplyContentProps = {
  reply: Reply;
  offerDisabled: boolean;
  onAcceptOffer: (pending: PendingHandoff) => void;
};

const ReplyContent = ({ reply, offerDisabled, onAcceptOffer }: ReplyContentProps) => {
  const { t } = useTranslation();
  const { currentClient, submissions, setClientTab } = useHub();

  const intakeButton = (
    <Button size="sm" variant="outline" onClick={() => setClientTab("intake")}>
      {t("chat.openIntake")}
    </Button>
  );
  const offerButton = (pending: PendingHandoff) => (
    <Button
      size="sm"
      variant="crimson"
      disabled={offerDisabled}
      onClick={() => onAcceptOffer(pending)}
    >
      {t("chat.handoffOffer")}
    </Button>
  );

  switch (reply.kind) {
    case "ai":
      return (
        <>
          <p>{reply.text}</p>
          {reply.offer ? offerButton(reply.offer) : null}
        </>
      );
    case "greeting":
      return <p>{t("chat.reply.greeting")}</p>;
    case "docs": {
      if (!reply.line) {
        return (
          <>
            <p>{t("chat.reply.docsGeneric")}</p>
            {intakeButton}
          </>
        );
      }
      const required = buildChecklist(reply.line, "new_quote").filter((entry) => !entry.optional);
      return (
        <>
          <p>
            {reply.addDriver
              ? t("chat.reply.docsAddDriver")
              : t("chat.reply.docsIntro", { line: lineLabel(t, reply.line) })}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {reply.addDriver ? (
              <>
                <li>{t("chat.reply.newDriverLicense")}</li>
                <li>{docLabel(t, "auto_declarations")}</li>
              </>
            ) : (
              required.map((entry) => <li key={entry.id}>{docLabel(t, entry.id)}</li>)
            )}
          </ul>
          <p>{t("chat.reply.docsOutro")}</p>
          {intakeButton}
        </>
      );
    }
    case "download": {
      const policy = currentClient?.policies.find(
        (entry) => entry.policyNumber === reply.policyNumber,
      );
      return (
        <>
          <p>{t("chat.reply.download", { policy: reply.policyNumber })}</p>
          <div className="flex flex-col items-start gap-2">
            {reply.documents.map((name) => (
              <Button
                key={name}
                size="sm"
                variant="outline"
                className="h-auto max-w-full whitespace-normal py-1.5 text-left"
                disabled={!currentClient || !policy}
                onClick={() => {
                  if (currentClient && policy) downloadSampleDocument(currentClient, policy, name);
                }}
              >
                <Download />
                <span className="break-all">{name}</span>
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("vault.sampleNote")}</p>
        </>
      );
    }
    case "noDocument":
      return (
        <>
          <p>{t("chat.reply.noDocument")}</p>
          {offerButton({
            reason: "document_request",
            line: null,
            action: null,
            originalMessage: reply.originalMessage,
          })}
        </>
      );
    case "contact":
      return <p>{t("chat.reply.contact")}</p>;
    case "payment":
      return (
        <p>
          {reply.carrier
            ? t("chat.reply.payment", { carrier: reply.carrier })
            : t("chat.reply.paymentGeneric")}
        </p>
      );
    case "status": {
      const mine = submissions.filter((entry) => entry.clientId === currentClient?.id);
      const open = mine.find((entry) => completion(entry.items).missing.length > 0);
      if (open) {
        return (
          <>
            <p>{t("chat.reply.statusOpen", { id: open.id, pct: open.completionPct })}</p>
            <ul className="list-disc space-y-1 pl-5">
              {completion(open.items).missing.map((entry) => (
                <li key={entry.id}>{docLabel(t, entry.id)}</li>
              ))}
            </ul>
          </>
        );
      }
      return (
        <p>
          {mine[0]
            ? t("chat.reply.statusComplete", { id: mine[0].id })
            : t("chat.reply.statusNone")}
        </p>
      );
    }
    case "fallback":
      return (
        <>
          <p>{t("chat.reply.fallback")}</p>
          {offerButton({
            reason: "unanswered",
            line: null,
            action: null,
            originalMessage: reply.originalMessage,
          })}
        </>
      );
    case "unavailable":
      return (
        <>
          <p>{t("chat.reply.unavailable")}</p>
          {offerButton({
            reason: "unanswered",
            line: null,
            action: null,
            originalMessage: reply.originalMessage,
          })}
        </>
      );
    case "handoff":
      return <p>{t("chat.reply.handoff", { id: reply.handoffId })}</p>;
  }
};
