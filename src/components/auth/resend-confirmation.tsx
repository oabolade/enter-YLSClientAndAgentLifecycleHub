import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { authRedirectUrl } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/auth-errors";

/** Sends the email-confirmation link again and reports the real outcome. */
export const ResendConfirmation = ({ email }: { email: string }) => {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);

  const resend = async () => {
    setSending(true);
    setOutcome(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    setSending(false);
    setOutcome(
      error
        ? { ok: false, text: authErrorMessage(t, error) }
        : { ok: true, text: t("auth.resent") },
    );
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" disabled={sending} onClick={() => void resend()}>
        {t("auth.resend")}
      </Button>
      {outcome ? (
        <p
          role="status"
          className={outcome.ok ? "text-sm text-success" : "text-sm font-medium text-destructive"}
        >
          {outcome.text}
        </p>
      ) : null}
    </div>
  );
};
