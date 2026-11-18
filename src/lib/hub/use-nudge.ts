import { useEffect, useState } from "react";

import { fetchNudge, type Nudge, type NudgeId } from "./agents";
import type { Client, LangCode } from "./types";

/**
 * Which suggestion a client is eligible for. The nudge agent applies the same rules
 * before the AI chooses, so this also serves as the wording fallback if it is unavailable.
 */
export function eligibleNudge(client: Client): NudgeId | null {
  const lines = client.policies.map((policy) => policy.line);
  if (client.policies.some((p) => p.line === "medicare" && p.status === "renewal_review"))
    return "medicareReview";
  if (lines.includes("auto") && !lines.includes("home")) return "bundleHome";
  if (lines.includes("commercial")) return "group";
  return null;
}

// One request per client and language for the session.
const cache = new Map<string, Promise<Nudge>>();

export type NudgeState = {
  loading: boolean;
  recommendation: NudgeId | null;
  /** AI-written message in the client's language; null means use the standard wording. */
  body: string | null;
};

export function useNudge(client: Client | null, language: LangCode): NudgeState {
  const [result, setResult] = useState<{ key: string; nudge: Nudge } | null>(null);
  const clientId = client?.id ?? null;
  const fallback = client ? eligibleNudge(client) : null;
  const key = clientId && fallback ? `${clientId}:${language}` : null;

  useEffect(() => {
    if (!key || !clientId) return;
    let active = true;
    let request = cache.get(key);
    if (!request) {
      request = fetchNudge(clientId, language);
      cache.set(key, request);
    }
    request
      .then((nudge) => {
        if (active) setResult({ key, nudge });
      })
      .catch((error) => {
        cache.delete(key);
        console.error("Coverage suggestion agent unavailable", error);
        if (active) setResult({ key, nudge: { recommendation: fallback, body: null } });
      });
    return () => {
      active = false;
    };
  }, [key, clientId, language, fallback]);

  if (!key) return { loading: false, recommendation: null, body: null };
  if (result?.key !== key) return { loading: true, recommendation: fallback, body: null };
  return { loading: false, ...result.nudge };
}
