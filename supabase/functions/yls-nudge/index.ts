// Proactive Renewal & Cross-Sell Nudge agent: picks one suggestion a client is eligible
// for and writes a short message in their language. Eligibility is decided here in code,
// so the model can never suggest something the client already has.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_BASE = "https://api.enter.pro";
const PROJECT_ID = "793f05d9f03b440f91543d698c802783";
const MODEL = "google/gemini-3.6-flash";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  "zh-CN": "Simplified Chinese (Mandarin)",
  "zh-HK": "Traditional Chinese as written in Hong Kong (Cantonese)",
  vi: "Vietnamese",
  tl: "Filipino (Tagalog)",
};

const SUGGESTIONS: Record<string, { about: string; invite: string }> = {
  medicareReview: {
    about: "The client's Medicare plan is marked for a renewal review before its renewal date.",
    invite: "request a callback from a licensed agent to review it before the renewal date",
  },
  bundleHome: {
    about: "The client has Auto coverage with YLS but no Home or Renters policy.",
    invite: "start a Home quote so an agent can review both policies together",
  },
  group: {
    about: "The client's business has Commercial coverage, and YLS also offers Group Insurance for employees.",
    invite: "request a callback from a licensed agent to review Group Insurance options",
  },
};

const SYSTEM_INSTRUCTION = [
  "You write one short, friendly coverage reminder for a client of YLS Financial & Insurance Services, an insurance agency.",
  "Choose exactly one suggestion from the allowed list; an upcoming renewal outranks a cross-sell.",
  "Write two sentences, at most 240 characters in total, addressed directly to the client.",
  "Use only the facts provided.",
  "Never mention prices, savings, discounts, or guarantees.",
  "Never compare or recommend specific plans or carriers, and never say that coverage has changed or will change.",
  "End by inviting the client to take the stated next step for the suggestion you chose.",
].join(" ");

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Chunk = {
  error?: { message?: string };
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
};

/** Calls the model and returns the full text of its streamed answer. */
async function generate(body: Record<string, unknown>): Promise<string> {
  const token = Deno.env.get("AI_API_TOKEN_793f05d9f03b");
  if (!token) throw new HttpError(500, "AI integration secret is missing");

  const response = await fetch(
    `${AI_BASE}/code/api/ai/v1beta/models/${MODEL}:streamGenerateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": token,
        "Content-Type": "application/json",
        "X-Session-ID": crypto.randomUUID(),
        "X-Enter-Project-ID": PROJECT_ID,
      },
      body: JSON.stringify(body),
    },
  );
  const raw = await response.text();

  const chunks: Chunk[] = [];
  const collect = (payload: string) => {
    try {
      const parsed = JSON.parse(payload);
      chunks.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      // Keep-alive or partial lines carry no content.
    }
  };
  const dataLines = raw.split("\n").filter((line) => line.startsWith("data:"));
  if (dataLines.length > 0) {
    for (const line of dataLines) {
      const payload = line.slice(5).trim();
      if (payload && payload !== "[DONE]") collect(payload);
    }
  } else {
    collect(raw);
  }

  const upstreamError = chunks.find((chunk) => chunk.error)?.error?.message;
  if (!response.ok || upstreamError) {
    throw new HttpError(
      response.ok ? 502 : response.status,
      upstreamError || `AI request failed: ${response.status}`,
    );
  }
  return chunks
    .flatMap((chunk) => chunk.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text)
    .join("")
    .trim();
}

const daysUntil = (date: string) =>
  Math.ceil((new Date(`${date}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new HttpError(500, "Database access is not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Checked before any record is read or any AI call is made.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: account, error: accountError } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null }, error: null };
    const user = accountError ? null : account.user;
    if (!user) return json({ error: { message: "Sign in to see suggestions." } }, 401);

    const body = await req.json().catch(() => null);
    const clientId = typeof body?.clientId === "string" ? body.clientId : "";
    const language = typeof body?.language === "string" ? body.language : "";
    if (!/^[A-Za-z0-9-]{1,64}$/.test(clientId) || !(language in LANGUAGE_NAMES)) {
      return json({ error: { message: "A valid client and language are required." } }, 400);
    }

    // A client may only ask about their own record; staff may ask about any client.
    const { data: owned, error: ownedError } = await supabase
      .from("yls_clients")
      .select("id")
      .eq("id", clientId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownedError) throw new HttpError(500, "Access could not be checked");
    if (!owned) {
      // Staff access belongs to an approved account, never to an email address alone.
      const { data: staff, error: staffError } = await supabase
        .from("yls_staff")
        .select("email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (staffError) throw new HttpError(500, "Access could not be checked");
      if (!staff) {
        console.error("Nudge refused: client record belongs to another account");
        return json({ error: { message: "This client record belongs to another account." } }, 403);
      }
    }

    const { data: policies, error } = await supabase
      .from("yls_policies")
      .select("line, carrier, status, renewal_date")
      .eq("client_id", clientId);
    if (error) throw new HttpError(500, "Policies could not be read");

    const rows = policies ?? [];
    const lines = rows.map((policy) => policy.line);
    const eligible: string[] = [];
    if (rows.some((policy) => policy.line === "medicare" && policy.status === "renewal_review")) {
      eligible.push("medicareReview");
    }
    if (lines.includes("auto") && !lines.includes("home")) eligible.push("bundleHome");
    if (lines.includes("commercial")) eligible.push("group");

    if (eligible.length === 0) return json({ recommendation: null, body: null });

    const facts = [
      `Today's date: ${new Date().toISOString().slice(0, 10)}`,
      "Client's policies:",
      ...rows.map(
        (policy) =>
          `- ${policy.line} with ${policy.carrier}, status ${policy.status}, renews ${policy.renewal_date} (${daysUntil(policy.renewal_date)} days from today)`,
      ),
      "Allowed suggestions:",
      ...eligible.map(
        (id) => `- ${id}: ${SUGGESTIONS[id].about} Next step to invite: ${SUGGESTIONS[id].invite}.`,
      ),
      `Write the message in ${LANGUAGE_NAMES[language]}.`,
    ].join("\n");

    const answer = await generate({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: facts }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            recommendation: { type: "STRING", enum: eligible },
            body: { type: "STRING" },
          },
          required: ["recommendation", "body"],
        },
      },
    });

    let verdict: { recommendation?: unknown; body?: unknown };
    try {
      verdict = JSON.parse(answer.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      throw new HttpError(502, "The AI returned an unreadable suggestion");
    }
    if (typeof verdict.recommendation !== "string" || !eligible.includes(verdict.recommendation)) {
      throw new HttpError(502, "The AI chose a suggestion the client is not eligible for");
    }

    // The message is dropped, not edited, if it breaks the pricing rule or runs long;
    // the app then shows its standard wording for the chosen suggestion.
    const text = typeof verdict.body === "string" ? verdict.body.replace(/\s+/g, " ").trim() : "";
    const acceptable = text.length > 0 && text.length <= 400 && !/[$€£¥%]/.test(text);
    if (!acceptable) console.warn("Nudge message rejected by the content rules");

    console.log("Nudge decision", JSON.stringify({ eligible, chosen: verdict.recommendation, acceptable }));
    return json({ recommendation: verdict.recommendation, body: acceptable ? text : null });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error("Nudge failed", status, error instanceof Error ? error.message : error);
    return json(
      { error: { message: error instanceof Error ? error.message : "Nudge failed" } },
      status,
    );
  }
});
