import { createContext, useContext } from "react";

import type { HubData } from "./hub-api";
import type {
  ChatMessage,
  Client,
  ClientTab,
  CoverageAction,
  Handoff,
  HandoffReason,
  HubView,
  LangCode,
  LineId,
  Reminder,
  RequestTypeId,
  Submission,
  SubmissionItem,
} from "./types";

export type GuestContact = {
  fullName: string;
  phone: string;
  email: string;
  preferredLanguage: LangCode;
};

export type IntakeInput = {
  clientId: string;
  line: LineId;
  requestType: RequestTypeId;
  items: SubmissionItem[];
};

export type HandoffInput = {
  client: Client | null;
  contactName: string;
  contactPhone: string;
  language: LangCode;
  reason: HandoffReason;
  line: LineId | null;
  action: CoverageAction | null;
  originalMessage: string;
  topic?: string;
  /** Skip the AI English rendering when the message is a button label, not client wording. */
  skipBrief?: boolean;
};

export type HubStatus = "loading" | "ready" | "error";

export type HubContextValue = HubData & {
  status: HubStatus;
  retry: () => void;
  view: HubView;
  setView: (view: HubView) => void;
  personaId: string;
  setPersona: (id: string) => void;
  /** Seeded demo clients offered in the persona quick-select. */
  personas: Client[];
  currentClient: Client | null;
  clientTab: ClientTab;
  setClientTab: (tab: ClientTab) => void;
  resumeSubmissionId: string | null;
  setResumeSubmissionId: (id: string | null) => void;
  intakePreset: LineId | null;
  setIntakePreset: (line: LineId | null) => void;
  chat: ChatMessage[];
  pushChat: (messages: ChatMessage[]) => void;
  replaceChatMessage: (id: string, message: ChatMessage) => void;
  // Writes go to the shared database and reject if the save fails.
  registerGuest: (contact: GuestContact) => Promise<Client>;
  submitIntake: (input: IntakeInput) => Promise<Submission>;
  updateSubmissionItems: (id: string, items: SubmissionItem[]) => Promise<Submission>;
  createHandoff: (input: HandoffInput) => Promise<Handoff>;
  sendReminder: (submissionId: string) => Promise<Reminder | null>;
  recordAutoResolved: (language: LangCode) => void;
};

export const HubContext = createContext<HubContextValue | null>(null);

export function useHub(): HubContextValue {
  const value = useContext(HubContext);
  if (!value) throw new Error("useHub must be used inside HubProvider.");
  return value;
}
