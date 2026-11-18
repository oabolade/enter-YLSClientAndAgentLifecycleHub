import { FunctionsHttpError } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

import { mandatoryHandoff, type Triage } from "./triage";
import type { DocId, LangCode } from "./types";

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

/** Bilingual Triage agent. */
export async function triageMessage(message: string): Promise<Triage> {
  // Hard-coded guardrail first: these requests go to a person whatever the AI would say.
  const mandatory = mandatoryHandoff(message);
  if (mandatory) return mandatory;
  const { triage } = await callAgent<{ triage: Triage }>("yls-triage", { message });
  if (triage?.tier !== 1 && triage?.tier !== 2) throw new Error("Triage returned no decision.");
  return triage;
}

/** Warm-Handoff Summarizer: the client's message rendered in English for the agent. */
export async function translateForAgent(message: string): Promise<string> {
  const { english } = await callAgent<{ english: string }>("yls-handoff-brief", {
    message: message.slice(0, 2000),
  });
  if (!english) throw new Error("The summary came back empty.");
  return english;
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

export type DocumentVerdict = {
  /** The open checklist item this file satisfies, if the agent confirmed one. */
  match: DocId | null;
  legible: boolean;
  /** Short English note for the licensed agent. */
  note: string;
};

/** Document Completeness & Extraction agent. */
export async function checkDocument(
  path: string,
  candidates: DocId[],
  clientName: string,
): Promise<DocumentVerdict> {
  const verdict = await callAgent<DocumentVerdict>("yls-document-check", {
    path,
    candidates,
    clientName,
  });
  return {
    match: verdict.match && candidates.includes(verdict.match) ? verdict.match : null,
    legible: verdict.legible !== false,
    note: typeof verdict.note === "string" ? verdict.note : "",
  };
}

export type NudgeId = "medicareReview" | "bundleHome" | "group";
export type Nudge = { recommendation: NudgeId | null; body: string | null };

/** Proactive Renewal & Cross-Sell Nudge agent. */
export const fetchNudge = (clientId: string, language: LangCode) =>
  callAgent<Nudge>("yls-nudge", { clientId, language });
