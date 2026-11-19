import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

import i18n from "@/i18n/config";
import { writeBrief } from "./agents";
import { completion } from "./checklists";
import { intakeStatusFor, toCoveyReason } from "./covey";
import {
  EMPTY_HUB_DATA,
  fetchHubData,
  insertAutoResolved,
  insertHandoff,
  insertReminder,
  insertSubmission,
  resolveAccess,
  saveSubmissionItems,
  subscribeHub,
  type HubAccess,
  type HubData,
} from "./hub-api";
import {
  HubContext,
  type HandoffInput,
  type HubContextValue,
  type HubStatus,
  type IntakeInput,
} from "./hub-context";
import { buildReminder } from "./labels";
import { buildSummary } from "./triage";
import type {
  ChatMessage,
  ClientTab,
  Handoff,
  HubView,
  LangCode,
  LineId,
  SubmissionItem,
} from "./types";

/** The sample client staff see first when they open the Client Portal. */
const INITIAL_PERSONA = "CLT-101";
const NO_ACCESS: HubAccess = { isStaff: false, ownClientId: null };

/** Puts a saved record first, replacing any copy a live refresh already delivered. */
const upsertFirst = <T extends { id: string }>(list: T[], row: T) => [
  row,
  ...list.filter((entry) => entry.id !== row.id),
];

type HubProviderProps = {
  /** The signed-in account. The provider is remounted when the account changes. */
  user: User;
  children: ReactNode;
};

export const HubProvider = ({ user, children }: HubProviderProps) => {
  const [data, setData] = useState<HubData>(EMPTY_HUB_DATA);
  const [status, setStatus] = useState<HubStatus>("loading");
  const [access, setAccess] = useState<HubAccess>(NO_ACCESS);
  const dataRef = useRef(data);
  dataRef.current = data;
  const userRef = useRef(user);
  userRef.current = user;
  const accessRequest = useRef<Promise<HubAccess> | null>(null);
  const languageApplied = useRef(false);

  const [view, setView] = useState<HubView>("client");
  const [personaId, setPersonaId] = useState(INITIAL_PERSONA);
  const [clientTab, setClientTab] = useState<ClientTab>("intake");
  const [resumeSubmissionId, setResumeSubmissionId] = useState<string | null>(null);
  const [intakePreset, setIntakePreset] = useState<LineId | null>(null);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});

  const reload = useCallback(async () => {
    try {
      // Worked out once per sign-in, so a client's record is never created twice.
      accessRequest.current ??= resolveAccess(userRef.current);
      const nextAccess = await accessRequest.current.catch((error) => {
        accessRequest.current = null;
        throw error;
      });
      const next = await fetchHubData();
      setAccess(nextAccess);
      setData(next);
      setStatus("ready");
      if (!languageApplied.current) {
        languageApplied.current = true;
        // Staff open on the Command Center; a client opens in their preferred language.
        if (nextAccess.isStaff) setView("agent");
        const firstId = nextAccess.isStaff ? INITIAL_PERSONA : nextAccess.ownClientId;
        const first = next.clients.find((client) => client.id === firstId);
        if (first) void i18n.changeLanguage(first.preferredLanguage);
      }
    } catch (error) {
      console.error("Hub data could not be loaded", error);
      setStatus((current) => (current === "ready" ? current : "error"));
    }
  }, []);

  useEffect(() => {
    void reload();
    return subscribeHub(() => void reload());
  }, [reload]);

  const retry = useCallback(() => {
    setStatus("loading");
    void reload();
  }, [reload]);

  const setPersona = useCallback((id: string) => {
    setPersonaId(id);
    setResumeSubmissionId(null);
    setIntakePreset(null);
    const client = dataRef.current.clients.find((entry) => entry.id === id);
    if (client) void i18n.changeLanguage(client.preferredLanguage);
  }, []);

  // A client is always themselves; staff view the Client Portal as a sample client.
  const activeClientId = access.isStaff ? personaId : access.ownClientId;
  const chatKey = activeClientId ?? "";

  const pushChat = useCallback(
    (messages: ChatMessage[]) =>
      setChats((prev) => ({ ...prev, [chatKey]: [...(prev[chatKey] ?? []), ...messages] })),
    [chatKey],
  );

  const submitIntake = useCallback(async (input: IntakeInput) => {
    const submission = await insertSubmission(input);
    setData((current) => ({
      ...current,
      submissions: upsertFirst(current.submissions, submission),
    }));
    return submission;
  }, []);

  const updateSubmissionItems = useCallback(async (id: string, items: SubmissionItem[]) => {
    const submission = await saveSubmissionItems(id, items);
    setData((current) => ({
      ...current,
      submissions: current.submissions.map((entry) => (entry.id === id ? submission : entry)),
    }));
    return submission;
  }, []);

  const handoffRequests = useRef(new Map<string, Promise<Handoff>>());

  const fileHandoff = useCallback(async (input: HandoffInput) => {
    let englishSummary = buildSummary({
      name: input.contactName,
      language: input.language,
      phone: input.contactPhone,
      reason: input.reason,
      line: input.line,
      action: input.action,
      client: input.client,
      topic: input.topic,
    });
    if (!input.skipBrief) {
      // The handoff must reach the queue even if the AI brief is unavailable.
      try {
        const mine = dataRef.current.submissions.filter((entry) => entry.clientId === input.client.id);
        const open = mine.find((entry) => completion(entry.items).missing.length > 0) ?? mine[0];
        const brief = await writeBrief({
          submissionId: open?.id ?? `chat-${input.client.id}`,
          language: input.language,
          lineOfBusiness: input.line ?? open?.lines[0] ?? "unknown",
          reason: toCoveyReason(input.reason),
          question: input.originalMessage,
          recentMessages: input.recentMessages ?? [],
          intakeStatus: open ? intakeStatusFor(open.id, open.items) : null,
          callbackPreference: null,
        });
        englishSummary += ` AI agent brief: ${brief.summary_en} Suggested next step: ${brief.next_action_en}`;
      } catch (error) {
        console.error("AI handoff brief unavailable", error);
        englishSummary +=
          " The AI brief of the client's message was unavailable; see the original wording.";
      }
    }
    const handoff = await insertHandoff({
      clientId: input.client.id,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      language: input.language,
      reason: input.reason,
      line: input.line,
      originalMessage: input.originalMessage,
      englishSummary,
    });
    setData((current) => ({ ...current, handoffs: upsertFirst(current.handoffs, handoff) }));
    return handoff;
  }, []);

  /** One callback record per request: a double click or a retry within 30 seconds reuses the first. */
  const createHandoff = useCallback(
    (input: HandoffInput) => {
      const key = `${input.client.id}|${input.reason}|${input.originalMessage}`;
      const existing = handoffRequests.current.get(key);
      if (existing) return existing;
      const request = fileHandoff(input);
      handoffRequests.current.set(key, request);
      request.then(
        () => setTimeout(() => handoffRequests.current.delete(key), 30_000),
        () => handoffRequests.current.delete(key),
      );
      return request;
    },
    [fileHandoff],
  );

  const sendReminder = useCallback(async (submissionId: string) => {
    const current = dataRef.current;
    const submission = current.submissions.find((entry) => entry.id === submissionId);
    const client = current.clients.find((entry) => entry.id === submission?.clientId);
    if (!submission || !client) return null;
    const missing = completion(submission.items).missing.map((entry) => entry.id);
    if (missing.length === 0) return null;
    const reminder = await insertReminder({
      submissionId,
      clientId: client.id,
      language: client.preferredLanguage,
      message: buildReminder(client.preferredLanguage, client.fullName, submission.id, missing),
      englishReference: buildReminder("en", client.fullName, submission.id, missing),
    });
    setData((state) => ({ ...state, reminders: upsertFirst(state.reminders, reminder) }));
    return reminder;
  }, []);

  const recordAutoResolved = useCallback(
    (language: LangCode) => {
      // A missed KPI count must not interrupt the client's chat; the next refresh corrects it.
      insertAutoResolved(language)
        .then(() => reload())
        .catch((error) => console.error("Auto-resolved inquiry was not recorded", error));
    },
    [reload],
  );

  const value = useMemo<HubContextValue>(
    () => ({
      ...data,
      status,
      retry,
      isStaff: access.isStaff,
      view: access.isStaff ? view : "client",
      setView,
      personaId,
      setPersona,
      personas: access.isStaff ? data.clients.filter((client) => client.isPersona) : [],
      currentClient: data.clients.find((client) => client.id === activeClientId) ?? null,
      clientTab,
      setClientTab,
      resumeSubmissionId,
      setResumeSubmissionId,
      intakePreset,
      setIntakePreset,
      chat: chats[chatKey] ?? [],
      pushChat,
      submitIntake,
      updateSubmissionItems,
      createHandoff,
      sendReminder,
      recordAutoResolved,
    }),
    [
      data,
      status,
      retry,
      access.isStaff,
      view,
      personaId,
      activeClientId,
      clientTab,
      resumeSubmissionId,
      intakePreset,
      chats,
      chatKey,
      setPersona,
      pushChat,
      submitIntake,
      updateSubmissionItems,
      createHandoff,
      sendReminder,
      recordAutoResolved,
    ],
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
};
