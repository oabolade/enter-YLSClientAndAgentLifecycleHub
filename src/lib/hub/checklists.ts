import type {
  ChecklistItem,
  DocId,
  LineId,
  RequestTypeId,
  SubmissionItem,
} from "./types";

export const LINES: LineId[] = ["auto", "home", "medicare", "commercial", "life"];
export const REQUEST_TYPES: RequestTypeId[] = ["new_quote", "policy_change", "renewal"];

const item = (id: DocId, kind: ChecklistItem["kind"], optional = false): ChecklistItem => ({
  id,
  kind,
  optional,
});

/**
 * Required-document rules from the YLS knowledge file. The Life checklist is an
 * assumption pending confirmation by the business owner.
 */
export function buildChecklist(line: LineId, request: RequestTypeId): ChecklistItem[] {
  switch (line) {
    case "auto":
      return [
        item("driver_license", "file"),
        item("vin_registration", "file"),
        item("garaging_address", "info"),
        // Declarations page: required when renewing, optional otherwise (only if switching).
        item("auto_declarations", "file", request !== "renewal"),
      ];
    case "home":
      return [
        item("property_address", "info"),
        item("home_declarations", "file"),
        item("roof_year", "info"),
        item("mortgagee_clause", "file", true),
      ];
    case "medicare":
      return [
        item("medicare_card", "file"),
        item("zip_code", "info"),
        item("pcp_name", "info"),
        item("prescription_list", "file", true),
      ];
    case "commercial":
      return [
        item("business_name_fein", "info"),
        item("business_description", "info"),
        item("revenue_payroll", "info"),
        item("current_coi", "file"),
        ...(request === "renewal" ? [item("loss_runs", "file")] : []),
      ];
    case "life":
      return [
        item("photo_id", "file"),
        item("dob_beneficiary", "info"),
        item("health_questionnaire", "file"),
        item("existing_life_statement", "file", true),
      ];
  }
}

const FILE_PATTERNS: [DocId, RegExp][] = [
  ["teen_driver_license", /(teen|permit)/],
  ["driver_license", /(driver|licen[sc]e|\bdl\b|驾照|駕照|bang ?lai|lisensya)/],
  ["vin_registration", /(\bvin\b|regist)/],
  ["auto_declarations", /(decl|dec ?page)/],
  ["home_declarations", /(decl|dec ?page)/],
  ["mortgagee_clause", /mortgage/],
  ["medicare_card", /medicare/],
  ["prescription_list", /(prescri|\brx\b|medication)/],
  ["loss_runs", /loss/],
  ["current_coi", /(\bcoi\b|certificate)/],
  ["photo_id", /(passport|photo ?id|\bid\b|licen[sc]e)/],
  ["health_questionnaire", /(health|questionnaire)/],
  ["existing_life_statement", /(statement|life)/],
];

/** Simulated document check: match an uploaded file to a checklist item by its name. */
export function matchFile(fileName: string, candidates: DocId[]): DocId | null {
  const normalized = fileName.toLowerCase().replace(/[_\-.]+/g, " ");
  const hit = FILE_PATTERNS.find(
    ([id, pattern]) => candidates.includes(id) && pattern.test(normalized),
  );
  return hit ? hit[0] : null;
}

export function toSubmissionItems(checklist: ChecklistItem[]): SubmissionItem[] {
  return checklist.map((entry) => ({ ...entry, received: false }));
}

export function completion(items: SubmissionItem[]) {
  const required = items.filter((entry) => !entry.optional);
  const done = required.filter((entry) => entry.received).length;
  const total = required.length;
  return {
    done,
    total,
    pct: total === 0 ? 100 : Math.round((done / total) * 100),
    missing: required.filter((entry) => !entry.received),
  };
}
