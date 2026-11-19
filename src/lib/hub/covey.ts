import type { DocId, HandoffReason, SubmissionItem } from "./types";

/**
 * Contracts for the three YLS concierge agents (Document Intake Reviewer, Multilingual
 * Client Triage, Agent Handoff Writer). They run as edge functions; these types mirror
 * the JSON each function returns. Keys and enum values stay in English.
 */

export type PacketStatus = "ready_for_agent_review" | "intake_incomplete" | "review_unavailable";
export type ItemStatus = "received" | "missing" | "needs_review";

export type IntakeResult = {
  submission_id: string;
  packet_status: PacketStatus;
  items: { item_id: string; status: ItemStatus; document_ids: string[] }[];
  client_message: string;
};

export type TriageRoute = "answer_faq" | "answer_intake_status" | "clarify" | "offer_handoff";
export type CoveyHandoffReason =
  | "policy_specific"
  | "policy_change"
  | "claims"
  | "recommendation"
  | "human_requested"
  | "unsupported_question";

export type TriageResult = {
  submission_id: string;
  route: TriageRoute;
  handoff_reason: CoveyHandoffReason | null;
  source_ids: string[];
  client_reply: string;
};

export type CallbackPreference = { preferred_day: string; preferred_time: string } | null;

export type BriefResult = {
  submission_id: string;
  title: string;
  preferred_language: string;
  line_of_business: string;
  handoff_reason: CoveyHandoffReason;
  summary_en: string;
  packet_status: PacketStatus;
  open_item_ids: string[];
  callback_preference: CallbackPreference;
  next_action_en: string;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ApprovedFaq = { source_id: string; question: string; answer: string };

// Only reasons whose agent-queue wording stays true for any line map one-to-one; the rest
// become a plain callback request carrying the client's own words as the topic.
const TO_APP_REASON: Record<CoveyHandoffReason, HandoffReason> = {
  policy_specific: "callback_request",
  policy_change: "callback_request",
  claims: "callback_request",
  recommendation: "callback_request",
  human_requested: "human_request",
  unsupported_question: "unanswered",
};

const TO_COVEY_REASON: Record<HandoffReason, CoveyHandoffReason> = {
  immediate_coverage_change: "policy_change",
  commercial_complex: "claims",
  medicare_comparison: "recommendation",
  frustrated: "human_requested",
  human_request: "human_requested",
  unanswered: "unsupported_question",
  document_request: "unsupported_question",
  callback_request: "policy_specific",
};

export const toAppReason = (reason: CoveyHandoffReason | null): HandoffReason =>
  TO_APP_REASON[reason ?? "unsupported_question"] ?? "unanswered";
export const toCoveyReason = (reason: HandoffReason): CoveyHandoffReason => TO_COVEY_REASON[reason];

/** English label and review criteria the document reviewer checks each upload against. */
export const DOC_CRITERIA: Partial<Record<DocId, { label: string; criteria: string }>> = {
  driver_license: {
    label: "Driver's license",
    criteria: "A readable photo or scan of a driver's license (front and/or back)",
  },
  teen_driver_license: {
    label: "Teen driver's permit or license",
    criteria: "A readable learner permit or driver's license for the teen driver",
  },
  vin_registration: {
    label: "Vehicle registration or VIN photo",
    criteria: "A readable registration card, or a document or photo clearly showing the vehicle's VIN",
  },
  auto_declarations: {
    label: "Auto insurance declarations page",
    criteria: "A readable copy of the current auto insurance declarations page",
  },
  home_declarations: {
    label: "Home or renters declarations page",
    criteria: "A readable copy of the current homeowners or renters insurance declarations page",
  },
  mortgagee_clause: {
    label: "Mortgagee clause",
    criteria: "A mortgagee clause, or a lender or mortgage statement naming the mortgagee",
  },
  medicare_card: {
    label: "Medicare card",
    criteria: "A readable Medicare card showing the Part A and Part B effective dates",
  },
  prescription_list: {
    label: "Current prescription list",
    criteria: "A readable list of current prescriptions or medications",
  },
  loss_runs: {
    label: "Loss runs",
    criteria: "A readable insurance loss run report",
  },
  current_coi: {
    label: "Certificate of insurance (COI)",
    criteria: "A readable current certificate of insurance",
  },
  photo_id: {
    label: "Government photo ID",
    criteria: "A readable government-issued photo ID (passport, state ID or driver's license)",
  },
  health_questionnaire: {
    label: "Health questionnaire",
    criteria: "A completed health questionnaire",
  },
  existing_life_statement: {
    label: "Existing life policy statement",
    criteria: "A readable statement for an existing life insurance policy",
  },
};

/**
 * The intake status the triage and brief agents are given, built from the saved
 * checklist so it always matches what the client sees. Optional items count only once received.
 */
export function intakeStatusFor(submissionId: string, items: SubmissionItem[]): IntakeResult {
  const relevant = items.filter((entry) => !entry.optional || entry.received);
  // A file the client placed by hand was not confirmed by the reviewer, so it is not "received".
  const statusOf = (entry: SubmissionItem): ItemStatus =>
    !entry.received ? "missing" : entry.kind === "file" && entry.aiVerified !== true ? "needs_review" : "received";
  const results = relevant.map((entry) => ({
    item_id: entry.id as string,
    status: statusOf(entry),
    document_ids: entry.received ? [`doc-${entry.id}`] : [],
  }));
  const open = results.some((entry) => entry.status !== "received");
  return {
    submission_id: submissionId,
    packet_status: results.length === 0 ? "review_unavailable" : open ? "intake_incomplete" : "ready_for_agent_review",
    items: results,
    client_message: "",
  };
}

const PACKET: readonly string[] = ["ready_for_agent_review", "intake_incomplete", "review_unavailable"];
const ITEM: readonly string[] = ["received", "missing", "needs_review"];
const ROUTES: readonly string[] = ["answer_faq", "answer_intake_status", "clarify", "offer_handoff"];

/** The edge functions validate the model output; this guards against a wrong or stale response shape. */
export function isIntakeResult(value: unknown): value is IntakeResult {
  const v = value as IntakeResult | null;
  return (
    !!v &&
    typeof v.submission_id === "string" &&
    PACKET.includes(v.packet_status) &&
    Array.isArray(v.items) &&
    v.items.every(
      (entry) =>
        typeof entry?.item_id === "string" &&
        ITEM.includes(entry.status) &&
        Array.isArray(entry.document_ids),
    )
  );
}

export function isTriageResult(value: unknown): value is TriageResult {
  const v = value as TriageResult | null;
  return (
    !!v &&
    typeof v.submission_id === "string" &&
    ROUTES.includes(v.route) &&
    typeof v.client_reply === "string" &&
    v.client_reply.length > 0
  );
}

export function isBriefResult(value: unknown): value is BriefResult {
  const v = value as BriefResult | null;
  return (
    !!v &&
    typeof v.summary_en === "string" &&
    typeof v.next_action_en === "string" &&
    typeof v.title === "string" &&
    Array.isArray(v.open_item_ids)
  );
}
