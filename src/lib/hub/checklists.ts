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
