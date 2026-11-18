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

export type IntakeInput = {
  clientId: string;
  line: LineId;
  requestType: RequestTypeId;
  items: SubmissionItem[];
};

export type HandoffInput = {
  client: Client;
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
  /**
   * Whether the signed-in account is YLS staff. This only decides what is shown;
   * the database decides what each account can actually read and change.
   */
  isStaff: boolean;
  view: HubView;
  setView: (view: HubView) => void;
  personaId: string;
  setPersona: (id: string) => void;
  /** Sample clients that staff can open the Client Portal as. Empty for clients. */
  personas: Client[];
  /** The signed-in client, or the sample client a staff member is viewing as. */
  currentClient: Client | null;
  clientTab: ClientTab;
  setClientTab: (tab: ClientTab) => void;
  resumeSubmissionId: string | null;
  setResumeSubmissionId: (id: string | null) => void;
  intakePreset: LineId | null;
  setIntakePreset: (line: LineId | null) => void;
  chat: ChatMessage[];
  pushChat: (messages: ChatMessage[]) => void;
  // Writes go to the shared database and reject if the save fails.
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
