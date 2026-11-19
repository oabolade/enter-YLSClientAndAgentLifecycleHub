import { FunctionsHttpError } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

import {
  isBriefResult,
  isIntakeResult,
  isTriageResult,
  type ApprovedFaq,
  type BriefResult,
  type CallbackPreference,
  type ChatTurn,
  type CoveyHandoffReason,
  type IntakeResult,
  type TriageResult,
} from "./covey";
import type { LangCode } from "./types";

/**
 * The three specialist agents. Each runs as a backend function so the AI credentials
 * and the stored client documents never reach the browser.
 */

async function callAgent<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context.json().catch(() => null);
      message = detail?.error?.message ?? message;
    }
    throw new Error(message);
  }
  return data as T;
}

export type TriageInput = {
  submissionId: string;
  language: LangCode;
  message: string;
  recentMessages: ChatTurn[];
  intakeStatus: IntakeResult | null;
  faqs: ApprovedFaq[];
};

/** Multilingual Client Triage agent: one route per client message. */
export async function askTriage(input: TriageInput): Promise<TriageResult> {
  const result = await callAgent<unknown>("yls-triage", {
    submission_id: input.submissionId,
    client_language: input.language,
    client_message: input.message,
    recent_messages: input.recentMessages,
    intake_status: input.intakeStatus,
    approved_faqs: input.faqs,
  });
  if (!isTriageResult(result)) throw new Error("Triage returned no decision.");
  return result;
}

export type BriefInput = {
  submissionId: string;
  language: LangCode;
  lineOfBusiness: string;
  reason: CoveyHandoffReason;
  question: string;
  recentMessages: ChatTurn[];
  intakeStatus: IntakeResult | null;
  callbackPreference: CallbackPreference;
};

/** Agent Handoff Writer: an English brief for the licensed agent, written after the client confirms a callback. */
export async function writeBrief(input: BriefInput): Promise<BriefResult> {
  const result = await callAgent<unknown>("yls-handoff-brief", {
    submission_id: input.submissionId,
    client_language: input.language,
    line_of_business: input.lineOfBusiness,
    handoff_reason: input.reason,
    client_question: input.question.slice(0, 2000),
    recent_messages: input.recentMessages,
    intake_status: input.intakeStatus,
    callback_preference: input.callbackPreference,
  });
  if (!isBriefResult(result)) throw new Error("The summary came back empty.");
  return result;
}

const DOCUMENT_BUCKET = "yls-client-documents";
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const DOCUMENT_ACCEPT = Object.keys(EXTENSION_BY_TYPE).join(",");

/** The storage extension for an acceptable file, or null if it cannot be uploaded. */
export function documentExtension(file: File): string | null {
  if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) return null;
  return EXTENSION_BY_TYPE[file.type] ?? null;
}

/** Saves a document to the signed-in account's own folder in the private store. */
export async function storeDocument(file: File, extension: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Sign in to upload documents.");
  const path = `intake/${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export type ReviewInput = {
  submissionId: string;
  language: LangCode;
  lineOfBusiness: string;
  /** Only the items still open: the reviewer returns one result per entry. */
  checklist: { item_id: string; label: string; review_criteria: string }[];
  documents: { document_id: string; filename: string; path: string }[];
  clientName: string;
};

/** Document Intake Reviewer: checks uploads against the checklist for the selected line. */
export async function reviewIntake(input: ReviewInput): Promise<IntakeResult> {
  const result = await callAgent<unknown>("yls-document-check", {
    submission_id: input.submissionId,
    client_language: input.language,
    line_of_business: input.lineOfBusiness,
    checklist: input.checklist,
    documents: input.documents.map((doc) => ({ ...doc, access_status: "available" })),
    clientName: input.clientName,
  });
  if (!isIntakeResult(result)) throw new Error("The document review came back invalid.");
  return result;
}

export type NudgeId = "medicareReview" | "bundleHome" | "group";
export type Nudge = { recommendation: NudgeId | null; body: string | null };

/** Proactive Renewal & Cross-Sell Nudge agent. */
export const fetchNudge = (clientId: string, language: LangCode) =>
  callAgent<Nudge>("yls-nudge", { clientId, language });
