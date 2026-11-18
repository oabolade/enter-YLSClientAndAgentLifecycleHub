import type { TFunction } from "i18next";

import i18n from "@/i18n/config";
import type { DocId, LangCode, LineId, RequestTypeId, Submission } from "./types";

// Translation keys must be string literals, so every lookup is enumerated here.

export function docLabel(t: TFunction, id: DocId): string {
  switch (id) {
    case "driver_license":
      return t("doc.driverLicense");
    case "teen_driver_license":
      return t("doc.teenDriverLicense");
    case "vin_registration":
      return t("doc.vinRegistration");
    case "auto_declarations":
      return t("doc.autoDeclarations");
    case "garaging_address":
      return t("doc.garagingAddress");
    case "property_address":
      return t("doc.propertyAddress");
    case "home_declarations":
      return t("doc.homeDeclarations");
    case "roof_year":
      return t("doc.roofYear");
    case "mortgagee_clause":
      return t("doc.mortgageeClause");
    case "medicare_card":
      return t("doc.medicareCard");
    case "zip_code":
      return t("doc.zipCode");
    case "prescription_list":
      return t("doc.prescriptionList");
    case "pcp_name":
      return t("doc.pcpName");
    case "business_name_fein":
      return t("doc.businessNameFein");
    case "business_description":
      return t("doc.businessDescription");
    case "revenue_payroll":
      return t("doc.revenuePayroll");
    case "loss_runs":
      return t("doc.lossRuns");
    case "current_coi":
      return t("doc.currentCoi");
    case "photo_id":
      return t("doc.photoId");
    case "dob_beneficiary":
      return t("doc.dobBeneficiary");
    case "health_questionnaire":
      return t("doc.healthQuestionnaire");
    case "existing_life_statement":
      return t("doc.existingLifeStatement");
  }
}

export function lineLabel(t: TFunction, id: LineId): string {
  switch (id) {
    case "auto":
      return t("line.auto");
    case "home":
      return t("line.home");
    case "medicare":
      return t("line.medicare");
    case "commercial":
      return t("line.commercial");
    case "life":
      return t("line.life");
  }
}

export function requestLabel(t: TFunction, id: RequestTypeId): string {
  switch (id) {
    case "new_quote":
      return t("req.newQuote");
    case "policy_change":
      return t("req.policyChange");
    case "renewal":
      return t("req.renewal");
  }
}

export function requestDesc(t: TFunction, id: RequestTypeId): string {
  switch (id) {
    case "new_quote":
      return t("req.newQuote.desc");
    case "policy_change":
      return t("req.policyChange.desc");
    case "renewal":
      return t("req.renewal.desc");
  }
}

export function submissionTitle(t: TFunction, submission: Submission): string {
  if (submission.seedTitle === "teenDriverHome") return t("sub.title.teenDriverHome");
  const line = submission.lines.map((id) => lineLabel(t, id)).join(" + ");
  if (!submission.requestType) return line;
  return t("sub.title.generic", {
    line,
    request: requestLabel(t, submission.requestType),
  });
}

/** Reminder text in a specific language, regardless of the language on screen. */
export function buildReminder(lang: LangCode, name: string, id: string, missing: DocId[]): string {
  const t = i18n.getFixedT(lang);
  const items = missing.map((doc) => docLabel(t, doc)).join("; ");
  return t("reminder.message", { name, id, items });
}

/** English names used in the always-English agent view. */
export const LANGUAGE_NAME_EN: Record<LangCode, string> = {
  en: "English",
  "zh-CN": "Mandarin",
  "zh-HK": "Cantonese",
  vi: "Vietnamese",
  tl: "Filipino",
};

export const LINE_NAME_EN: Record<LineId, string> = {
  auto: "Auto",
  home: "Home",
  medicare: "Medicare / Medical",
  commercial: "Commercial",
  life: "Life",
};

export const REQUEST_NAME_EN: Record<RequestTypeId, string> = {
  new_quote: "New Quote",
  policy_change: "Policy Change",
  renewal: "Renewal",
};
