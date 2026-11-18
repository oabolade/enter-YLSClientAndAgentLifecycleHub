import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import i18n from "@/i18n/config";
import { translateForAgent } from "./agents";
import { completion } from "./checklists";
import {
  EMPTY_HUB_DATA,
  fetchHubData,
  insertAutoResolved,
  insertGuestClient,
  insertHandoff,
  insertReminder,
  insertSubmission,
  saveSubmissionItems,
  subscribeHub,
  type HubData,
} from "./hub-api";
import {
  HubContext,
  type GuestContact,
  type HandoffInput,
  type HubContextValue,
  type HubStatus,
  type IntakeInput,
} from "./hub-context";
import { buildReminder } from "./labels";
import { buildSummary } from "./triage";
import {
  GUEST_PERSONA,
  type ChatMessage,
  type ClientTab,
  type HubView,
  type LangCode,
  type LineId,
  type SubmissionItem,
} from "./types";

const INITIAL_PERSONA = "CLT-101";

/** Puts a saved record first, replacing any copy a live refresh already delivered. */
const upsertFirst = <T extends { id: string }>(list: T[], row: T) => [
  row,
  ...list.filter((entry) => entry.id !== row.id),
];

export const HubProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<HubData>(EMPTY_HUB_DATA);
  const [status, setStatus] = useState<HubStatus>("loading");
  const dataRef = useRef(data);
  dataRef.current = data;
  const languageApplied = useRef(false);

  const [view, setView] = useState<HubView>("client");
  const [personaId, setPersonaId] = useState(INITIAL_PERSONA);
  const [guestClientId, setGuestClientId] = useState<string | null>(null);
  const [clientTab, setClientTab] = useState<ClientTab>("intake");
  const [resumeSubmissionId, setResumeSubmissionId] = useState<string | null>(null);
  const [intakePreset, setIntakePreset] = useState<LineId | null>(null);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});

  const reload = useCallback(async () => {
    try {
      const next = await fetchHubData();
      setData(next);
      setStatus("ready");
      // The first persona opens in their preferred language.
      if (!languageApplied.current) {
        languageApplied.current = true;
        const first = next.clients.find((client) => client.id === INITIAL_PERSONA);
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

  const pushChat = useCallback(
    (messages: ChatMessage[]) =>
      setChats((prev) => ({ ...prev, [personaId]: [...(prev[personaId] ?? []), ...messages] })),
    [personaId],
  );

  const replaceChatMessage = useCallback(
    (id: string, message: ChatMessage) =>
      setChats((prev) => ({
        ...prev,
        [personaId]: (prev[personaId] ?? []).map((entry) => (entry.id === id ? message : entry)),
      })),
    [personaId],
  );

  const registerGuest = useCallback(async (contact: GuestContact) => {
    const client = await insertGuestClient(contact);
    setData((current) => ({
      ...current,
      clients: [...current.clients.filter((entry) => entry.id !== client.id), client],
    }));
    setGuestClientId(client.id);
    return client;
  }, []);

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

  const createHandoff = useCallback(async (input: HandoffInput) => {
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
      // The handoff must reach the queue even if the AI rendering is unavailable.
      try {
        const english = await translateForAgent(input.originalMessage);
        englishSummary += ` In the client's words (AI translation): ${english}`;
      } catch (error) {
        console.error("AI handoff summary unavailable", error);
        englishSummary +=
          " The AI translation of the client's message was unavailable; see the original wording.";
      }
    }
    const handoff = await insertHandoff({
      clientId: input.client?.id ?? null,
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

  const value = useMemo<HubContextValue>(() => {
    const activeId = personaId === GUEST_PERSONA ? guestClientId : personaId;
    return {
      ...data,
      status,
      retry,
      view,
      setView,
      personaId,
      setPersona,
      personas: data.clients.filter((client) => client.isPersona),
      currentClient: data.clients.find((client) => client.id === activeId) ?? null,
      clientTab,
      setClientTab,
      resumeSubmissionId,
      setResumeSubmissionId,
      intakePreset,
      setIntakePreset,
      chat: chats[personaId] ?? [],
      pushChat,
      replaceChatMessage,
      registerGuest,
      submitIntake,
      updateSubmissionItems,
      createHandoff,
      sendReminder,
      recordAutoResolved,
    };
  }, [
    data,
    status,
    retry,
    view,
    personaId,
    guestClientId,
    clientTab,
    resumeSubmissionId,
    intakePreset,
    chats,
    setPersona,
    pushChat,
    replaceChatMessage,
    registerGuest,
    submitIntake,
    updateSubmissionItems,
    createHandoff,
    sendReminder,
    recordAutoResolved,
  ]);

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
};
