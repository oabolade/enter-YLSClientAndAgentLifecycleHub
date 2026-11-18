// Bilingual Triage agent: classifies one client chat message into a Tier 1 intent or a
// Tier 2 warm handoff. It only returns a routing decision; it never writes a reply and
// never changes coverage. The browser keeps its own keyword guardrails as a floor.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_BASE = "https://api.enter.pro";
const PROJECT_ID = "793f05d9f03b440f91543d698c802783";
const MODEL = "typesafe/jev-1.13";

const ROUTES = [
  "coverage_change",
  "claim_or_underwriting",
  "medicare_plan_advice",
  "documents_needed",
  "download_document",
  "payment",
  "request_status",
  "office_contact",
  "other",
] as const;
const LINES = ["auto", "home", "medicare", "commercial", "life", "none"] as const;
const ACTIONS = ["cancel", "bind", "change", "none"] as const;

const TIER1_INTENT: Record<string, string> = {
  documents_needed: "docs",
  download_document: "download",
  payment: "payment",
  request_status: "status",
  office_contact: "contact",
};

// Starting thresholds. A missed escalation costs more than an unnecessary one, so the
// handoff checks trigger at lower certainty than the self-serve answers.
const ESCALATE_AT = 0.5;
const SENTIMENT_AT = 0.6;
const SELF_SERVE_AT = 0.55;
const DETAIL_AT = 0.6;

const QUESTIONS = {
  route: {
    type: "choice",
    instructions:
      "Which category best fits what the insurance client is asking for in `message`? The message may be in English, Chinese, Vietnamese or Tagalog.",
    criteria: {
      coverage_change: {
        what: "Asks the agency to bind, start, cancel, or change insurance coverage (limits, deductibles, vehicles, drivers, effective dates), or says a change must happen now",
        not_for: "Only asking which documents or steps are needed before a change",
        examples: [
          "Cancel my auto policy today",
          "我要马上提高商业保险的保额",
          "Tôi muốn hủy bảo hiểm xe ngay",
          "Pakidagdag ang anak ko sa policy ko ngayon",
        ],
      },
      claim_or_underwriting: {
        what: "A disputed or denied claim, a lawsuit, or a complex commercial underwriting question",
        examples: ["My claim was denied and I want to dispute it", "保险公司拒赔，我要申诉"],
      },
      medicare_plan_advice: {
        what: "Asks which Medicare plan to choose, or asks to compare or recommend Medicare plans",
        not_for: "Asking which documents a Medicare request needs",
        examples: ["Which Medicare Advantage plan is best for me?", "Nên chọn chương trình Medicare nào?"],
      },
      documents_needed: {
        what: "Asks which documents or information are required for a quote, a policy change, or a renewal",
        examples: ["What do I need to add a driver?", "申请房屋保险需要什么文件？"],
      },
      download_document: {
        what: "Asks to get, download, or be sent an insurance ID card, a certificate of insurance (COI), or proof of insurance",
        examples: ["Download my COI", "Tôi cần thẻ bảo hiểm của tôi"],
      },
      payment: {
        what: "Asks how or where to pay a premium or a bill",
        examples: ["How do I pay my bill?", "Paano ako magbabayad ng premium?"],
      },
      request_status: {
        what: "Asks about the status or progress of a request or application already submitted, or what is still missing from it",
        examples: ["What is the status of my request?", "我的申请进度如何？"],
      },
      office_contact: {
        what: "Asks for office hours, address, phone number, or website",
        examples: ["What are your office hours?", "Địa chỉ văn phòng ở đâu?"],
      },
      other: {
        what: "Anything else, including greetings, price or quote amounts, coverage advice, and unrelated topics",
        examples: ["How much would home insurance cost me?", "Hello"],
      },
    },
  },
  coverageChange: {
    type: "noul",
    instructions:
      "Does `message` ask the insurance agency to bind, cancel, or modify insurance coverage, as opposed to only asking what is required to do so?",
  },
  frustrated: {
    type: "noul",
    instructions:
      "Does the writer of `message` express anger, frustration, or a complaint about the service they received?",
  },
  wantsHuman: {
    type: "noul",
    instructions:
      "Does `message` explicitly ask to speak with, be called by, or be connected to a human agent or representative?",
  },
  addDriver: {
    type: "noul",
    instructions: "Is `message` about adding a driver to an auto insurance policy?",
  },
  wantsCoi: {
    type: "noul",
    instructions: "Does `message` ask specifically for a certificate of insurance (COI)?",
  },
  line: {
    type: "choice",
    instructions: "Which line of insurance is `message` about?",
    criteria: {
      auto: "Car, vehicle, or driver insurance",
      home: "Homeowners, renters, or property insurance for a residence",
      medicare: "Medicare, medical, or health insurance",
      commercial: "Business or commercial insurance, including certificates of insurance for a business",
      life: "Life insurance or annuities",
      none: "No specific line of insurance is mentioned",
    },
  },
  action: {
    type: "choice",
    instructions: "Which change to insurance coverage, if any, does `message` request?",
    criteria: {
      cancel: "Cancel or terminate a policy or coverage",
      bind: "Bind or start new coverage",
      change: "Modify existing coverage, such as limits, deductibles, drivers, or vehicles",
      none: "No change to coverage is requested",
    },
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const unit = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

type ChoiceAnswer = { choice: string; confidence: number };

const choiceOf = (answer: unknown, allowed: readonly string[]): ChoiceAnswer | null => {
  const candidate = answer as { choice?: unknown; confidence?: unknown } | null;
  if (!candidate || typeof candidate.choice !== "string") return null;
  if (!allowed.includes(candidate.choice) || !unit(candidate.confidence)) return null;
  return { choice: candidate.choice, confidence: candidate.confidence };
};

const noulOf = (answer: unknown): number | null => {
  const value = (answer as { noul?: unknown } | null)?.noul;
  return unit(value) ? value : null;
};

/** The signed-in account making the request, or null. The public key alone is not an account. */
async function signedInUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("Account check is not configured");
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await createClient(supabaseUrl, serviceKey).auth.getUser(token);
  return error ? null : data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Checked before any AI call, so the link alone cannot spend AI credits.
    if (!(await signedInUser(req))) {
      return json({ error: { message: "Sign in to use the concierge." } }, 401);
    }

    const token = Deno.env.get("AI_API_TOKEN_793f05d9f03b");
    if (!token) throw new Error("AI integration secret is missing");

    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 1000) {
      return json({ error: { message: "A message of 1 to 1000 characters is required." } }, 400);
    }

    const response = await fetch(`${AI_BASE}/code/api/v1/ai/decisions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Enter-Project-ID": PROJECT_ID,
        "X-Session-ID": crypto.randomUUID(),
      },
      body: JSON.stringify({ model: MODEL, state: { message }, questions: QUESTIONS }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const upstream = result?.error?.message || `AI request failed: ${response.status}`;
      console.error("Triage upstream error", response.status, upstream);
      return json({ error: { message: upstream } }, response.status);
    }

    const answers = result?.answers ?? {};
    const route = choiceOf(answers.route, ROUTES);
    const line = choiceOf(answers.line, LINES);
    const action = choiceOf(answers.action, ACTIONS);
    const coverageChange = noulOf(answers.coverageChange);
    const frustrated = noulOf(answers.frustrated);
    const wantsHuman = noulOf(answers.wantsHuman);
    const addDriver = noulOf(answers.addDriver);
    const wantsCoi = noulOf(answers.wantsCoi);
    if (
      !route || !line || !action || coverageChange === null || frustrated === null ||
      wantsHuman === null || addDriver === null || wantsCoi === null
    ) {
      console.error("Triage returned an invalid judgment", JSON.stringify(result));
      return json({ error: { message: "Invalid AI judgment response" } }, 502);
    }

    const detectedLine = line.choice !== "none" && line.confidence >= DETAIL_AT ? line.choice : null;
    const tier2 = (reason: string, coverageAction: string | null = null) => ({
      tier: 2,
      reason,
      line: detectedLine,
      action: coverageAction,
    });

    let triage: Record<string, unknown>;
    if (
      coverageChange >= ESCALATE_AT ||
      (route.choice === "coverage_change" && route.confidence >= ESCALATE_AT)
    ) {
      triage = tier2(
        "immediate_coverage_change",
        action.choice !== "none" && action.confidence >= ESCALATE_AT ? action.choice : "change",
      );
    } else if (route.choice === "claim_or_underwriting" && route.confidence >= ESCALATE_AT) {
      triage = tier2("commercial_complex");
    } else if (route.choice === "medicare_plan_advice" && route.confidence >= ESCALATE_AT) {
      triage = tier2("medicare_comparison");
    } else if (frustrated >= SENTIMENT_AT) {
      triage = tier2("frustrated");
    } else if (wantsHuman >= SENTIMENT_AT) {
      triage = tier2("human_request");
    } else {
      const intent =
        route.confidence >= SELF_SERVE_AT ? (TIER1_INTENT[route.choice] ?? "fallback") : "fallback";
      triage = {
        tier: 1,
        intent,
        line: detectedLine,
        addDriver: addDriver >= DETAIL_AT,
        wantsCoi: wantsCoi >= DETAIL_AT,
      };
    }

    // Decision detail only; the client's wording is not written to the logs.
    console.log(
      "Triage decision",
      JSON.stringify({
        route,
        coverageChange,
        frustrated,
        wantsHuman,
        line,
        action,
        tier: triage.tier,
        outcome: triage.reason ?? triage.intent,
      }),
    );
    return json({ triage });
  } catch (error) {
    console.error("Triage failed", error);
    return json({ error: { message: error instanceof Error ? error.message : "Triage failed" } }, 500);
  }
});
