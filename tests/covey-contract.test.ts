// Contract tests for the three Covey agents' pure logic, using the handoff.txt fixtures.
// Run from the repo root with: node --test "tests/**/*.test.ts"   (Node 25 does not accept a bare directory)
import { test } from "node:test";
import assert from "node:assert/strict";

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Each function is one deployable file: pure logic first, then the Deno handler after this marker.
const HANDLER_MARKER = "// ===== HTTP handler";
const scratch = mkdtempSync(join(tmpdir(), "yls-covey-"));
const load = async (name: string) => {
  const source = readFileSync(`supabase/functions/${name}/index.ts`, "utf8");
  const pure = source.slice(0, source.indexOf(HANDLER_MARKER));
  assert.ok(pure.length > 0 && pure.includes("export function"), `${name}: marker not found`);
  const file = join(scratch, `${name}.ts`);
  writeFileSync(file, pure);
  return import(pathToFileURL(file).href);
};

const intake = await load("yls-document-check");
const triage = await load("yls-triage");
const brief = await load("yls-handoff-brief");
type DocumentCheckRequest = ReturnType<typeof intake.validateDocumentCheckRequest>;
type TriageRequest = ReturnType<typeof triage.validateTriageRequest>;

const checklist = [
  {
    item_id: "declarations_page",
    label: "Current auto insurance declarations page",
    review_criteria: "A readable copy of the current declarations page",
  },
];
const intakeBody = (documents: unknown[], extra: Record<string, unknown> = {}) => ({
  submission_id: "demo-auto-001",
  client_language: "en",
  line_of_business: "auto",
  checklist,
  documents,
  ...extra,
});
const syntheticDoc = {
  document_id: "doc-01",
  filename: "synthetic_declarations.txt",
  access_status: "available",
  content_or_attachment:
    "SYNTHETIC TEST DOCUMENT. Auto Insurance Declarations. Policy term 2026-11-01 to 2027-11-01. Named insured Demo Client. Vehicle Demo Sedan. Liability limits and deductible listed. End of readable declarations page.",
};
const verdict = (fields: Record<string, unknown>) =>
  JSON.stringify({
    submission_id: "demo-auto-001",
    document_id: "doc-01",
    item_id: "declarations_page",
    readable: true,
    satisfies_criteria: true,
    ...fields,
  });

/** Runs the per-document flow the edge function runs, with a canned model answer per document. */
function reviewIntake(body: unknown, answers: Record<string, string>, attachmentLoaded = false) {
  const request: DocumentCheckRequest = intake.validateDocumentCheckRequest(body);
  const verdicts = request.documents.map((document) => {
    const mode = intake.contentMode(document, attachmentLoaded);
    assert.match(intake.buildDocumentPrompt(request, document, mode), /^BEGIN UNTRUSTED INPUT[\s\S]*END UNTRUSTED INPUT$/);
    return intake.parseDocumentVerdict(answers[document.document_id], request, document.document_id, mode);
  });
  return intake.aggregateIntake(request, verdicts);
}

const assertHttp = (fn: () => unknown, status: number) =>
  assert.throws(fn, (error: unknown) => error instanceof Error && (error as { status?: number }).status === status);

// ---------- Agent 1: Document Intake Reviewer ----------

test("Agent 1: no documents -> missing, intake_incomplete", () => {
  const result = reviewIntake(intakeBody([]), {});
  assert.deepEqual(result, {
    submission_id: "demo-auto-001",
    packet_status: "intake_incomplete",
    items: [{ item_id: "declarations_page", status: "missing", document_ids: [] }],
    client_message: "Please upload: Current auto insurance declarations page.",
  });
});

test("Agent 1: readable synthetic declarations -> received, ready_for_agent_review", () => {
  const result = reviewIntake(intakeBody([syntheticDoc]), { "doc-01": verdict({}) });
  assert.equal(result.packet_status, "ready_for_agent_review");
  assert.deepEqual(result.items, [{ item_id: "declarations_page", status: "received", document_ids: ["doc-01"] }]);
  assert.deepEqual(Object.keys(result), ["submission_id", "packet_status", "items", "client_message"]);
});

test("Agent 1: unreadable candidate -> needs_review, intake_incomplete", () => {
  const result = reviewIntake(intakeBody([syntheticDoc]), {
    "doc-01": verdict({ readable: false, satisfies_criteria: false }),
  });
  assert.equal(result.packet_status, "intake_incomplete");
  assert.deepEqual(result.items, [{ item_id: "declarations_page", status: "needs_review", document_ids: ["doc-01"] }]);
  assert.match(result.client_message, /need review/);
});

test("Agent 1: filename alone never makes an item received", () => {
  const unavailable = { document_id: "doc-01", filename: "declarations.pdf", access_status: "unavailable" };
  const noContent = { document_id: "doc-02", filename: "declarations_page.pdf", access_status: "available" };
  const result = reviewIntake(intakeBody([unavailable, noContent]), {
    "doc-01": verdict({}),
    "doc-02": verdict({ document_id: "doc-02" }),
  });
  assert.deepEqual(result.items, [
    { item_id: "declarations_page", status: "needs_review", document_ids: ["doc-01", "doc-02"] },
  ]);
  assert.equal(result.packet_status, "intake_incomplete");
});

test("Agent 1: an attachment that loaded counts as inspected content", () => {
  const upload = {
    document_id: "doc-01",
    filename: "scan.pdf",
    access_status: "available",
    path: "intake/11111111-2222-3333-4444-555555555555/66666666-7777-8888-9999-000000000000.pdf",
  };
  assert.equal(reviewIntake(intakeBody([upload]), { "doc-01": verdict({}) }, true).packet_status, "ready_for_agent_review");
  assert.equal(reviewIntake(intakeBody([upload]), { "doc-01": verdict({}) }, false).items[0].status, "needs_review");
});

test("Agent 1: a document that is not a candidate leaves the item missing", () => {
  const result = reviewIntake(intakeBody([syntheticDoc]), {
    "doc-01": verdict({ item_id: "none", satisfies_criteria: false }),
  });
  assert.deepEqual(result.items, [{ item_id: "declarations_page", status: "missing", document_ids: [] }]);
});

test("Agent 1: absent, empty or unusable checklist -> review_unavailable with no items", () => {
  for (const bad of [undefined, [], "x", [{ item_id: "a" }], [checklist[0], checklist[0]]]) {
    const request = intake.validateDocumentCheckRequest(intakeBody([syntheticDoc], { checklist: bad }));
    assert.equal(request.checklist.length, 0);
    const result = intake.aggregateIntake(request, []);
    assert.deepEqual(result.items, []);
    assert.equal(result.packet_status, "review_unavailable");
    assert.match(result.client_message, /checklist needs review/);
  }
});

test("Agent 1: client message follows client_language", () => {
  const vi = reviewIntake(intakeBody([], { client_language: "vi" }), {});
  assert.match(vi.client_message, /^Vui lòng tải lên/);
  const zh = intake.reviewUnavailable("s", "zh-HK");
  assert.match(zh.client_message, /YLS/);
});

test("Agent 1: malformed per-document model output is rejected", () => {
  const request = intake.validateDocumentCheckRequest(intakeBody([syntheticDoc]));
  const parse = (output: string) => intake.parseDocumentVerdict(output, request, "doc-01", "text");
  assertHttp(() => parse("not json"), 502);
  assertHttp(() => parse("```json\n" + verdict({}) + "\n```"), 502);
  assertHttp(() => parse("[]"), 502);
  assertHttp(() => parse(verdict({ note: "extra key" })), 502);
  assertHttp(() => parse(verdict({ item_id: "invented_item" })), 502);
  assertHttp(() => parse(verdict({ document_id: "doc-99" })), 502);
  assertHttp(() => parse(verdict({ submission_id: "other" })), 502);
  assertHttp(() => parse(verdict({ readable: "yes" })), 502);
});

test("Agent 1: request validation", () => {
  assertHttp(() => intake.validateDocumentCheckRequest(null), 400);
  assertHttp(() => intake.validateDocumentCheckRequest(intakeBody([], { client_language: "fr" })), 400);
  assertHttp(() => intake.validateDocumentCheckRequest(intakeBody([syntheticDoc, syntheticDoc])), 400);
  assertHttp(() => intake.validateDocumentCheckRequest(intakeBody(Array.from({ length: 13 }, (_, i) => ({ ...syntheticDoc, document_id: `d${i}` })))), 400);
  assertHttp(() => intake.validateDocumentCheckRequest(intakeBody([{ ...syntheticDoc, path: "../secret.pdf" }])), 400);
  assert.equal(intake.pathOwner("intake/11111111-2222-3333-4444-555555555555/66666666-7777-8888-9999-000000000000.png"), "11111111-2222-3333-4444-555555555555");
});

// ---------- Agent 2: Multilingual Client Triage ----------

const missingIntake = {
  submission_id: "demo-auto-001",
  packet_status: "intake_incomplete",
  items: [{ item_id: "declarations_page", status: "missing", document_ids: [] }],
  client_message: "Please upload a readable copy of your current auto insurance declarations page.",
};
const policyBody = (extra: Record<string, unknown> = {}) => ({
  submission_id: "demo-auto-001",
  client_language: "en",
  client_message: "Does my current policy cover another person driving my car?",
  recent_messages: [],
  intake_status: missingIntake,
  approved_faqs: [],
  ...extra,
});
const faqBody = {
  submission_id: "demo-auto-002",
  client_language: "en",
  client_message: "How do I send my documents through this portal?",
  recent_messages: [],
  intake_status: null,
  approved_faqs: [
    {
      source_id: "demo-portal-upload-001",
      question: "How do I send documents through the portal?",
      answer:
        "Open your intake checklist, select the requested item, and upload a readable document. Check the updated checklist for any remaining items.",
    },
  ],
};

test("Agent 2: policy-specific question -> offer_handoff/policy_specific", () => {
  const request: TriageRequest = triage.validateTriageRequest(policyBody());
  const expected = {
    submission_id: "demo-auto-001",
    route: "offer_handoff",
    handoff_reason: "policy_specific",
    source_ids: [],
    client_reply:
      "A YLS agent can review your policy and confirm how it applies when another person drives your car. Would you like to request a callback?",
  };
  assert.deepEqual(triage.parseTriageResponse(JSON.stringify(expected), request), expected);
  assert.match(triage.buildTriagePrompt(request), /^BEGIN UNTRUSTED INPUT[\s\S]*END UNTRUSTED INPUT$/);
});

test("Agent 2: approved FAQ answer keeps its source id", () => {
  const request = triage.validateTriageRequest(faqBody);
  const expected = {
    submission_id: "demo-auto-002",
    route: "answer_faq",
    handoff_reason: null,
    source_ids: ["demo-portal-upload-001"],
    client_reply:
      "Open your intake checklist, select the requested item, and upload a readable document. Then check the updated checklist for any remaining items.",
  };
  assert.deepEqual(triage.parseTriageResponse(JSON.stringify(expected), request), expected);
});

test("Agent 2: unknown source id or broken routing rule -> safe handoff fallback", () => {
  const request = triage.validateTriageRequest({ ...faqBody, client_language: "vi" });
  const answer = (fields: Record<string, unknown>) =>
    JSON.stringify({
      submission_id: "demo-auto-002",
      route: "answer_faq",
      handoff_reason: null,
      source_ids: ["demo-portal-upload-001"],
      client_reply: "Mở danh sách giấy tờ của bạn.",
      ...fields,
    });
  const fallback = triage.triageFallback(request);
  assert.equal(fallback.route, "offer_handoff");
  assert.equal(fallback.handoff_reason, "unsupported_question");
  assert.match(fallback.client_reply, /nhân viên YLS/);
  for (const broken of [
    { source_ids: ["invented-faq-999"] },
    { source_ids: [] },
    { route: "clarify", source_ids: ["demo-portal-upload-001"] },
    { route: "clarify", source_ids: [], handoff_reason: "claims" },
    { route: "offer_handoff", source_ids: [], handoff_reason: null },
    { route: "answer_intake_status", source_ids: [] }, // intake_status is null here
    { client_reply: "   " },
  ]) {
    assert.deepEqual(triage.parseTriageResponse(answer(broken), request), fallback, JSON.stringify(broken));
  }
});

test("Agent 2: handoff with a valid reason keeps it and drops stray source ids", () => {
  const request = triage.validateTriageRequest(faqBody);
  const result = triage.parseTriageResponse(
    JSON.stringify({
      submission_id: "demo-auto-002",
      route: "offer_handoff",
      handoff_reason: "human_requested",
      source_ids: ["demo-portal-upload-001"],
      client_reply: "A YLS agent can help. Would you like to request a callback?",
    }),
    request,
  );
  assert.equal(result.handoff_reason, "human_requested");
  assert.deepEqual(result.source_ids, []);
});

test("Agent 2: Vietnamese reply passes through unchanged", () => {
  const request = triage.validateTriageRequest(policyBody({ client_language: "vi" }));
  const reply =
    "Một nhân viên YLS có thể xem xét hợp đồng của bạn và xác nhận cách áp dụng khi người khác lái xe của bạn. Bạn có muốn yêu cầu được gọi lại không?";
  const result = triage.parseTriageResponse(
    JSON.stringify({
      submission_id: "demo-auto-001",
      route: "offer_handoff",
      handoff_reason: "policy_specific",
      source_ids: [],
      client_reply: reply,
    }),
    request,
  );
  assert.equal(result.client_reply, reply);
  assert.equal(result.route, "offer_handoff");
});

test("Agent 2: answer_intake_status with intake supplied is accepted", () => {
  const request = triage.validateTriageRequest(policyBody({ client_message: "What document is still missing?" }));
  const result = triage.parseTriageResponse(
    JSON.stringify({
      submission_id: "demo-auto-001",
      route: "answer_intake_status",
      handoff_reason: null,
      source_ids: [],
      client_reply: "Your current auto insurance declarations page is still needed.",
    }),
    request,
  );
  assert.equal(result.route, "answer_intake_status");
});

test("Agent 2: answer_intake_status without real checklist items -> safe handoff fallback", () => {
  const request = triage.validateTriageRequest(
    policyBody({
      client_message: "What document is still missing?",
      intake_status: {
        submission_id: "demo-auto-001",
        packet_status: "review_unavailable",
        items: [],
        client_message: "",
      },
    }),
  );
  const result = triage.parseTriageResponse(
    JSON.stringify({
      submission_id: "demo-auto-001",
      route: "answer_intake_status",
      handoff_reason: null,
      source_ids: [],
      client_reply: "Nothing is missing.",
    }),
    request,
  );
  assert.equal(result.route, "offer_handoff");
  assert.equal(result.handoff_reason, "unsupported_question");
});

test("Agent 2: identifiers are masked, but numbers quoted from approved FAQs are kept", () => {
  const request = triage.validateTriageRequest({
    ...faqBody,
    approved_faqs: [{ source_id: "office-phone", question: "Phone?", answer: "Call the office at 408-555-1234." }],
  });
  const result = triage.parseTriageResponse(
    JSON.stringify({
      submission_id: "demo-auto-002",
      route: "answer_faq",
      handoff_reason: null,
      source_ids: ["office-phone"],
      client_reply: "Call the office at 408-555-1234. Your policy PA12345678 is on file.",
    }),
    request,
  );
  assert.equal(result.client_reply, "Call the office at 408-555-1234. Your policy ***5678 is on file.");
});

test("Agent 2: malformed model output is rejected", () => {
  const request = triage.validateTriageRequest(faqBody);
  const good = {
    submission_id: "demo-auto-002",
    route: "answer_faq",
    handoff_reason: null,
    source_ids: ["demo-portal-upload-001"],
    client_reply: "Upload it in the checklist.",
  };
  assertHttp(() => triage.parseTriageResponse("Sure! Here is the answer.", request), 502);
  assertHttp(() => triage.parseTriageResponse("```json\n" + JSON.stringify(good) + "\n```", request), 502);
  assertHttp(() => triage.parseTriageResponse(JSON.stringify({ ...good, confidence: 0.9 }), request), 502);
  assertHttp(() => triage.parseTriageResponse(JSON.stringify({ ...good, route: "escalate" }), request), 502);
  assertHttp(() => triage.parseTriageResponse(JSON.stringify({ ...good, handoff_reason: "angry" }), request), 502);
  assertHttp(() => triage.parseTriageResponse(JSON.stringify({ ...good, source_ids: "demo" }), request), 502);
});

test("Agent 2: request validation and caps", () => {
  assertHttp(() => triage.validateTriageRequest(policyBody({ client_message: "" })), 400);
  assertHttp(() => triage.validateTriageRequest(policyBody({ client_message: "x".repeat(1001) })), 400);
  assertHttp(() => triage.validateTriageRequest(policyBody({ intake_status: { ...missingIntake, submission_id: "other" } })), 400);
  assertHttp(() => triage.validateTriageRequest(policyBody({ intake_status: { ...missingIntake, extra: 1 } })), 400);
  const many = triage.validateTriageRequest(
    policyBody({
      recent_messages: Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `${i}`.repeat(900) })),
      approved_faqs: Array.from({ length: 25 }, (_, i) => ({ source_id: `faq-${i}`, question: "q", answer: "a" })),
    }),
  );
  assert.equal(many.recent_messages.length, 6);
  assert.equal(many.recent_messages[0].content.length, 500);
  assert.equal(many.recent_messages[5].content[0], "8");
  assert.equal(many.approved_faqs.length, 20);
});

// ---------- Agent 3: Agent Handoff Writer ----------

const briefBody = (extra: Record<string, unknown> = {}) => ({
  submission_id: "demo-auto-001",
  client_language: "en",
  line_of_business: "auto",
  handoff_reason: "policy_specific",
  client_question: "Does my current policy cover another person driving my car?",
  recent_messages: [{ role: "user", content: "Yes, please request a callback." }],
  intake_status: missingIntake,
  callback_preference: null,
  ...extra,
});
const expectedBrief = {
  submission_id: "demo-auto-001",
  title: "Auto policy question about another driver",
  preferred_language: "en",
  line_of_business: "auto",
  handoff_reason: "policy_specific",
  summary_en:
    "The client asks whether another person can drive their car under the current policy and has requested a callback. The declarations page is still missing. No callback preference was provided.",
  packet_status: "intake_incomplete",
  open_item_ids: ["declarations_page"],
  callback_preference: null,
  next_action_en: "Arrange a callback and confirm the driver details needed for policy review.",
};

test("Agent 3: fixture brief passes through", () => {
  const request = brief.validateHandoffRequest(briefBody());
  assert.deepEqual(brief.buildHandoffResponse(JSON.stringify(expectedBrief), request), expectedBrief);
});

test("Agent 3: copied and computed fields come from the input, not the model", () => {
  const preference = { preferred_day: "Tuesday", preferred_time: "morning" };
  const request = brief.validateHandoffRequest(
    briefBody({
      client_language: "vi",
      callback_preference: preference,
      intake_status: {
        ...missingIntake,
        items: [
          { item_id: "declarations_page", status: "missing", document_ids: [] },
          { item_id: "driver_license", status: "needs_review", document_ids: ["doc-02"] },
          { item_id: "registration", status: "received", document_ids: ["doc-03"] },
        ],
      },
    }),
  );
  const lying = {
    ...expectedBrief,
    preferred_language: "en",
    line_of_business: "home",
    handoff_reason: "claims",
    packet_status: "ready_for_agent_review",
    open_item_ids: ["invented_item"],
    callback_preference: { preferred_day: "Friday", preferred_time: "evening" },
  };
  const result = brief.buildHandoffResponse(JSON.stringify(lying), request);
  assert.equal(result.preferred_language, "vi");
  assert.equal(result.line_of_business, "auto");
  assert.equal(result.handoff_reason, "policy_specific");
  assert.equal(result.packet_status, "intake_incomplete");
  assert.deepEqual(result.open_item_ids, ["declarations_page", "driver_license"]);
  assert.deepEqual(result.callback_preference, preference);
});

test("Agent 3: unavailable intake -> review_unavailable, no open items, summary says so", () => {
  const request = brief.validateHandoffRequest(briefBody({ intake_status: null }));
  const result = brief.buildHandoffResponse(JSON.stringify(expectedBrief), request);
  assert.equal(result.packet_status, "review_unavailable");
  assert.deepEqual(result.open_item_ids, []);
  assert.match(result.summary_en, /checklist status was unavailable\.$/);
});

test("Agent 3: model text is masked and bounded", () => {
  const request = brief.validateHandoffRequest(briefBody());
  const result = brief.buildHandoffResponse(
    JSON.stringify({ ...expectedBrief, title: "Policy PA12345678 question\n\n" + "x".repeat(300), summary_en: "Client DL D1234567 asks." }),
    request,
  );
  assert.ok(result.title.length <= 120);
  assert.ok(result.title.startsWith("Policy ***5678 question x"));
  assert.equal(result.summary_en, "Client DL ***4567 asks.");
});

test("Agent 3: malformed model output is rejected", () => {
  const request = brief.validateHandoffRequest(briefBody());
  assertHttp(() => brief.buildHandoffResponse("The client wants a callback.", request), 502);
  assertHttp(() => brief.buildHandoffResponse("```json\n" + JSON.stringify(expectedBrief) + "\n```", request), 502);
  // Extra or missing copied fields are tolerated (the code overwrites them); the three used fields are not.
  assert.equal(
    brief.buildHandoffResponse(JSON.stringify({ ...expectedBrief, priority: "high" }), request).title,
    expectedBrief.title,
  );
  const { callback_preference: _copied, ...withoutCopied } = expectedBrief;
  assert.equal(brief.buildHandoffResponse(JSON.stringify(withoutCopied), request).callback_preference, null);
  const { next_action_en: _dropped, ...missingKey } = expectedBrief;
  assertHttp(() => brief.buildHandoffResponse(JSON.stringify(missingKey), request), 502);
  assertHttp(() => brief.buildHandoffResponse(JSON.stringify({ ...expectedBrief, summary_en: "" }), request), 502);
});

test("Agent 3: request validation", () => {
  assertHttp(() => brief.validateHandoffRequest(briefBody({ handoff_reason: null })), 400);
  assertHttp(() => brief.validateHandoffRequest(briefBody({ callback_preference: { preferred_day: "Mon" } })), 400);
  assertHttp(() => brief.validateHandoffRequest(briefBody({ callback_preference: { preferred_day: "Mon", preferred_time: "am", phone: "1" } })), 400);
  assertHttp(() => brief.validateHandoffRequest(briefBody({ client_language: "es" })), 400);
});
