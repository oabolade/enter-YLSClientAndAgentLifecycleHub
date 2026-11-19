// Covey Agent 1, "YLS Document Intake Reviewer": checks the current uploads against the
// app's checklist. One model verdict per document; the result is assembled in ./covey.ts.
// Files stay in the private store; only checklist statuses leave this function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  aggregateIntake,
  buildDocumentPrompt,
  contentMode,
  DOCUMENT_SYSTEM_INSTRUCTION,
  documentVerdictSchema,
  HttpError,
  MAX_FILE_BYTES,
  MIME_TYPES,
  parseDocumentVerdict,
  pathOwner,
  reviewUnavailable,
  validateDocumentCheckRequest,
  type DocumentVerdict,
  type IntakeDocument,
} from "./covey.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_BASE = "https://api.enter.pro";
const PROJECT_ID = "793f05d9f03b440f91543d698c802783";
const MODEL = "google/gemini-3.6-flash";
const BUCKET = "yls-client-documents";
const CONCURRENCY = 4;

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

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

/** Runs task over items with at most `limit` in flight, keeping input order. */
async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new HttpError(500, "Document store access is not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Checked before any file is read or any AI call is made.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: account, error: accountError } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null }, error: null };
    const user = accountError ? null : account.user;
    if (!user) return json({ error: { message: "Sign in to check documents." } }, 401);

    const request = validateDocumentCheckRequest(await req.json().catch(() => null));

    // An account can only have its own uploads read, whatever paths the request names.
    if (request.documents.some((document) => document.path && pathOwner(document.path) !== user.id)) {
      console.error("Document check refused: file belongs to another account");
      return json({ error: { message: "A document belongs to another account." } }, 403);
    }
    if (request.checklist.length === 0) {
      return json(reviewUnavailable(request.submission_id, request.client_language));
    }

    /** The file as an inline part, or null when it cannot be opened or is too large. */
    const loadFile = async (path: string) => {
      const { data: file, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !file) {
        console.error("Document download failed", error?.message);
        return null;
      }
      if (file.size > MAX_FILE_BYTES) return null;
      const extension = path.split(".").pop() ?? "";
      const data = toBase64(new Uint8Array(await file.arrayBuffer()));
      return { inlineData: { mimeType: MIME_TYPES[extension], data } };
    };

    const review = async (document: IntakeDocument): Promise<DocumentVerdict> => {
      const file = document.access_status === "available" && document.path ? await loadFile(document.path) : null;
      const mode = contentMode(document, file !== null);
      const answer = await generate({
        systemInstruction: { parts: [{ text: DOCUMENT_SYSTEM_INSTRUCTION }] },
        contents: [
          {
            role: "user",
            parts: [{ text: buildDocumentPrompt(request, document, mode) }, ...(file ? [file] : [])],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema: documentVerdictSchema(request.checklist.map((item) => item.item_id)),
        },
      });
      return parseDocumentVerdict(answer, request, document.document_id, mode);
    };

    const verdicts = await mapLimit(request.documents, CONCURRENCY, review);
    const result = aggregateIntake(request, verdicts);

    // Statuses only; document content and client details are not logged.
    console.log(
      "Intake review",
      JSON.stringify({ packet_status: result.packet_status, statuses: result.items.map((item) => item.status) }),
    );
    return json(result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error("Document check failed", status, error instanceof Error ? error.message : error);
    return json(
      { error: { message: error instanceof Error ? error.message : "Document check failed" } },
      status,
    );
  }
});
