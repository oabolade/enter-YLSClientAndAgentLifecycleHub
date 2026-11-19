import type { ApprovedFaq } from "./covey";

/**
 * SYNTHETIC DEMO CONTENT. These answers describe the portal and facts from YLS's public
 * brief only. YLS must confirm or replace them before they are shown to real clients.
 * Answers are written in English; the triage agent replies in the client's language.
 */
export const APPROVED_FAQS: ApprovedFaq[] = [
  {
    source_id: "demo-portal-upload-001",
    question: "How do I send documents through the portal?",
    answer:
      "Open your intake checklist, select the requested item, and upload a readable document. Check the updated checklist for any remaining items.",
  },
  {
    source_id: "demo-languages-002",
    question: "Which languages does YLS support?",
    answer:
      "YLS Financial & Insurance Services supports English, Mandarin Chinese, Cantonese, Vietnamese and Filipino.",
  },
  {
    source_id: "demo-lines-003",
    question: "What types of insurance does YLS offer?",
    answer:
      "YLS offers auto, home, medical, Medicare, life, annuity, commercial, travel and group insurance. A YLS agent can review which options fit your situation.",
  },
  {
    source_id: "demo-checklist-004",
    question: "How do I know which documents are still missing?",
    answer:
      "Your intake checklist shows each requested item as received or missing. Upload a readable document for any missing item and the checklist updates.",
  },
  {
    source_id: "demo-callback-005",
    question: "How do I talk to a person at YLS?",
    answer:
      "You can ask for a callback in this chat. A YLS agent will review your request and follow up. The callback time is not guaranteed.",
  },
];
