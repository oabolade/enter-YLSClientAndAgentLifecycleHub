export type LangCode = "en" | "zh-CN" | "zh-HK" | "vi" | "tl";
export type LineId = "auto" | "home" | "medicare" | "commercial" | "life";
export type RequestTypeId = "new_quote" | "policy_change" | "renewal";

export type DocId =
  | "driver_license"
  | "teen_driver_license"
  | "vin_registration"
  | "auto_declarations"
  | "garaging_address"
  | "property_address"
  | "home_declarations"
  | "roof_year"
  | "mortgagee_clause"
  | "medicare_card"
  | "zip_code"
  | "prescription_list"
  | "pcp_name"
  | "business_name_fein"
  | "business_description"
  | "revenue_payroll"
  | "loss_runs"
  | "current_coi"
  | "photo_id"
  | "dob_beneficiary"
  | "health_questionnaire"
  | "existing_life_statement";

export type ChecklistItem = {
  id: DocId;
  /** "file" items are uploaded; "info" items are typed in. */
  kind: "file" | "info";
  optional: boolean;
};

export type SubmissionItem = ChecklistItem & {
  received: boolean;
  fileName?: string;
  value?: string;
  /** Where the uploaded file sits in the private document store. */
  filePath?: string;
  /** True when the document agent confirmed the match; false when the client chose it. */
  aiVerified?: boolean;
  /** The document agent's short English note for the licensed agent. */
  aiNote?: string;
};

export type PolicyStatus = "active" | "renewal_review";

export type Policy = {
  policyNumber: string;
  line: LineId;
  carrier: string;
  status: PolicyStatus;
  renewalDate: string;
  premiumMonthly: number;
  deductible: string;
  documents: string[];
};

export type Client = {
  id: string;
  fullName: string;
  preferredLanguage: LangCode;
  phone: string;
  email: string;
  /** Sample clients that staff can open the Client Portal as. */
  isPersona: boolean;
  policies: Policy[];
};

export type Submission = {
  id: string;
  clientId: string;
  lines: LineId[];
  requestType: RequestTypeId | null;
  /** Seeded submissions with a custom combined title. */
  seedTitle?: "teenDriverHome";
  items: SubmissionItem[];
  completionPct: number;
  createdAt: string;
  sample?: boolean;
};

export type HandoffReason =
  | "immediate_coverage_change"
  | "commercial_complex"
  | "medicare_comparison"
  | "frustrated"
  | "human_request"
  | "unanswered"
  | "document_request"
  | "callback_request";

export type CoverageAction = "change" | "cancel" | "bind";

export type Handoff = {
  id: string;
  clientId: string | null;
  contactName: string;
  contactPhone: string;
  language: LangCode;
  reason: HandoffReason;
  line: LineId | null;
  originalMessage: string;
  englishSummary: string;
  createdAt: string;
  sample?: boolean;
};

export type Reminder = {
  id: string;
  submissionId: string;
  clientId: string;
  language: LangCode;
  message: string;
  englishReference: string;
  sentAt: string;
};

export type ChipId = "addDriver" | "downloadCoi" | "urgentCommercial" | "status";

export type PendingHandoff = {
  reason: HandoffReason;
  line: LineId | null;
  action: CoverageAction | null;
  originalMessage: string;
  /** Set when the message is a button label, so there is nothing to translate. */
  skipBrief?: boolean;
};

export type Reply =
  | { kind: "greeting" }
  | { kind: "docs"; line: LineId | null; addDriver: boolean }
  | { kind: "download"; policyNumber: string; documents: string[] }
  | { kind: "noDocument"; originalMessage: string }
  | { kind: "contact" }
  | { kind: "payment"; carrier: string | null }
  | { kind: "status" }
  | { kind: "fallback"; originalMessage: string }
  | { kind: "unavailable"; originalMessage: string }
  | { kind: "handoff"; handoffId: string; phone: string };

export type ChatMessage =
  | { id: string; role: "user"; text?: string; chip?: ChipId }
  | { id: string; role: "assistant"; reply: Reply };

export type ClientTab = "intake" | "concierge" | "vault";
export type HubView = "client" | "agent";
