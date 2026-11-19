// Covey Agent 3, "YLS Agent Handoff Writer": writes the English inbox brief after the client
// confirms a callback. The model writes only title, summary_en and next_action_en; every
// copied or computed field is set in ./covey.ts from the request.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildHandoffPrompt,
  buildHandoffResponse,
  HANDOFF_RESPONSE_SCHEMA,
  HANDOFF_SYSTEM_INSTRUCTION,
  HttpError,
  validateHandoffRequest,
} from "./covey.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_BASE = "https://api.enter.pro";
const PROJECT_ID = "793f05d9f03b440f91543d698c802783";
const MODEL = "google/gemini-3.6-flash";

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

/** The signed-in account making the request, or null. The public key alone is not an account. */
async function signedInUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new HttpError(500, "Account check is not configured");
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
      return json({ error: { message: "Sign in to request a handoff." } }, 401);
    }

    const request = validateHandoffRequest(await req.json().catch(() => null));
    const answer = await generate({
      systemInstruction: { parts: [{ text: HANDOFF_SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: buildHandoffPrompt(request) }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: HANDOFF_RESPONSE_SCHEMA,
      },
    });
    const brief = buildHandoffResponse(answer, request);

    console.log(
      "Handoff brief",
      JSON.stringify({ packet_status: brief.packet_status, open_items: brief.open_item_ids.length }),
    );
    return json(brief);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error("Handoff brief failed", status, error instanceof Error ? error.message : error);
    return json(
      { error: { message: error instanceof Error ? error.message : "Summary failed" } },
      status,
    );
  }
});
