import type { User } from "@supabase/supabase-js";

import { fallbackLng, normalizeLanguage } from "@/i18n/config";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

import { completion } from "./checklists";
import type {
  Client,
  Handoff,
  HandoffReason,
  LangCode,
  LineId,
  Policy,
  PolicyStatus,
  Reminder,
  RequestTypeId,
  Submission,
  SubmissionItem,
} from "./types";

export type HubData = {
  clients: Client[];
  submissions: Submission[];
  handoffs: Handoff[];
  reminders: Reminder[];
  /** Routine inquiries the concierge resolved without an agent. */
  autoResolved: number;
};

export const EMPTY_HUB_DATA: HubData = {
  clients: [],
  submissions: [],
  handoffs: [],
  reminders: [],
  autoResolved: 0,
};

type SubmissionRow = {
  id: string;
  client_id: string;
  lines: string[];
  request_type: string | null;
  seed_title: string | null;
  items: Json;
  completion_pct: number;
  is_sample: boolean;
  created_at: string;
};

type HandoffRow = {
  id: string;
  client_id: string | null;
  contact_name: string;
  contact_phone: string;
  language: string;
  reason: string;
  line: string | null;
  original_message: string;
  english_summary: string;
  is_sample: boolean;
  created_at: string;
};

type ReminderRow = {
  id: string;
  submission_id: string;
  client_id: string;
  language: string;
  message: string;
  english_reference: string;
  sent_at: string;
};

const toSubmission = (row: SubmissionRow): Submission => ({
  id: row.id,
  clientId: row.client_id,
  lines: row.lines as LineId[],
  requestType: row.request_type as RequestTypeId | null,
  seedTitle: row.seed_title === "teenDriverHome" ? "teenDriverHome" : undefined,
  items: row.items as unknown as SubmissionItem[],
  completionPct: row.completion_pct,
  createdAt: row.created_at,
  sample: row.is_sample,
});

const toHandoff = (row: HandoffRow): Handoff => ({
  id: row.id,
  clientId: row.client_id,
  contactName: row.contact_name,
  contactPhone: row.contact_phone,
  language: row.language as LangCode,
  reason: row.reason as HandoffReason,
  line: row.line as LineId | null,
  originalMessage: row.original_message,
  englishSummary: row.english_summary,
  createdAt: row.created_at,
  sample: row.is_sample,
});

const toReminder = (row: ReminderRow): Reminder => ({
  id: row.id,
  submissionId: row.submission_id,
  clientId: row.client_id,
  language: row.language as LangCode,
  message: row.message,
  englishReference: row.english_reference,
  sentAt: row.sent_at,
});

const submissionStatus = (items: SubmissionItem[]) =>
  completion(items).missing.length > 0 ? "action_required" : "complete";

export async function fetchHubData(): Promise<HubData> {
  const [clients, policies, submissions, handoffs, reminders, events] = await Promise.all([
    supabase.from("yls_clients").select("*").order("id"),
    supabase.from("yls_policies").select("*").order("policy_number"),
    supabase.from("yls_submissions").select("*").order("created_at", { ascending: false }),
    supabase.from("yls_handoffs").select("*").order("created_at", { ascending: false }),
    supabase.from("yls_reminders").select("*").order("sent_at", { ascending: false }),
    supabase
      .from("yls_concierge_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "auto_resolved"),
  ]);
  const failure = [clients, policies, submissions, handoffs, reminders, events].find(
    (result) => result.error,
  );
  if (failure?.error) throw failure.error;

  const policiesByClient = new Map<string, Policy[]>();
  for (const row of policies.data ?? []) {
    const policy: Policy = {
      policyNumber: row.policy_number,
      line: row.line as LineId,
      carrier: row.carrier,
      status: row.status as PolicyStatus,
      renewalDate: row.renewal_date,
      premiumMonthly: Number(row.premium_monthly),
      deductible: row.deductible,
      documents: row.documents as unknown as string[],
    };
    policiesByClient.set(row.client_id, [...(policiesByClient.get(row.client_id) ?? []), policy]);
  }

  return {
    clients: (clients.data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      preferredLanguage: row.preferred_language as LangCode,
      phone: row.phone,
      email: row.email,
      isPersona: row.is_persona,
      policies: policiesByClient.get(row.id) ?? [],
    })),
    submissions: (submissions.data ?? []).map(toSubmission),
    handoffs: (handoffs.data ?? []).map(toHandoff),
    reminders: (reminders.data ?? []).map(toReminder),
    autoResolved: events.count ?? 0,
  };
}

export type HubAccess = {
  isStaff: boolean;
  /** The signed-in client's own record. Staff have none. */
  ownClientId: string | null;
};

const metadataText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** Finds the signed-in client's record, creating it from their sign-up details on first use. */
async function ensureOwnClient(user: User): Promise<string> {
  const { data: existing, error: readError } = await supabase
    .from("yls_clients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing.id;

  const details = user.user_metadata ?? {};
  const email = user.email ?? "";
  const { data, error } = await supabase
    .from("yls_clients")
    .insert({
      user_id: user.id,
      full_name: metadataText(details.full_name, 120) || email,
      phone: metadataText(details.phone, 40),
      email,
      preferred_language:
        normalizeLanguage(metadataText(details.preferred_language, 10)) ?? fallbackLng,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * What the signed-in account is. The answer shapes the screens only: the database
 * applies the same rule to every read and write, whatever the browser claims.
 */
export async function resolveAccess(user: User): Promise<HubAccess> {
  const { data: isStaff, error } = await supabase.rpc("yls_is_staff");
  if (error) throw error;
  if (isStaff) return { isStaff: true, ownClientId: null };
  return { isStaff: false, ownClientId: await ensureOwnClient(user) };
}

export async function insertSubmission(input: {
  clientId: string;
  line: LineId;
  requestType: RequestTypeId;
  items: SubmissionItem[];
}): Promise<Submission> {
  const { data, error } = await supabase
    .from("yls_submissions")
    .insert({
      client_id: input.clientId,
      lines: [input.line],
      request_type: input.requestType,
      items: input.items as unknown as Json,
      completion_pct: completion(input.items).pct,
      status: submissionStatus(input.items),
    })
    .select()
    .single();
  if (error) throw error;
  return toSubmission(data);
}

export async function saveSubmissionItems(
  id: string,
  items: SubmissionItem[],
): Promise<Submission> {
  const { data, error } = await supabase
    .from("yls_submissions")
    .update({
      items: items as unknown as Json,
      completion_pct: completion(items).pct,
      status: submissionStatus(items),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toSubmission(data);
}

export async function insertHandoff(input: {
  clientId: string;
  contactName: string;
  contactPhone: string;
  language: LangCode;
  reason: HandoffReason;
  line: LineId | null;
  originalMessage: string;
  englishSummary: string;
}): Promise<Handoff> {
  const { data, error } = await supabase
    .from("yls_handoffs")
    .insert({
      client_id: input.clientId,
      contact_name: input.contactName.slice(0, 120),
      contact_phone: input.contactPhone.slice(0, 40),
      language: input.language,
      reason: input.reason,
      line: input.line,
      original_message: input.originalMessage.slice(0, 2000),
      english_summary: input.englishSummary.slice(0, 2000),
    })
    .select()
    .single();
  if (error) throw error;
  return toHandoff(data);
}

export async function insertReminder(input: {
  submissionId: string;
  clientId: string;
  language: LangCode;
  message: string;
  englishReference: string;
}): Promise<Reminder> {
  const { data, error } = await supabase
    .from("yls_reminders")
    .insert({
      submission_id: input.submissionId,
      client_id: input.clientId,
      language: input.language,
      message: input.message,
      english_reference: input.englishReference,
    })
    .select()
    .single();
  if (error) throw error;
  return toReminder(data);
}

export async function insertAutoResolved(language: LangCode): Promise<void> {
  const { error } = await supabase
    .from("yls_concierge_events")
    .insert({ kind: "auto_resolved", language });
  if (error) throw error;
}

/** Refreshes the hub whenever another screen adds or changes a record. */
export function subscribeHub(onChange: () => void): () => void {
  const channel = supabase
    .channel("yls-hub")
    .on("postgres_changes", { event: "*", schema: "public", table: "yls_submissions" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "yls_handoffs" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "yls_reminders" }, onChange)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "yls_concierge_events" },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
