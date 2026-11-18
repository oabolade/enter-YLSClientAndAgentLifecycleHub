import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { authRedirectUrl } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/auth-errors";

export const ForgotPasswordForm = ({ onSignIn }: { onSignIn: () => void }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    const address = email.trim();
    if (!address) {
      setError(t("auth.error.required"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: failure } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: authRedirectUrl(),
    });
    setBusy(false);
    if (failure) setError(authErrorMessage(t, failure));
    else setSentTo(address);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {sentTo ? (
        <p role="status" className="rounded-xl border border-success/40 bg-success-soft p-4 text-sm">
          {t("auth.resetSent", { email: sentTo })}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">{t("auth.email")}</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="crimson" className="w-full" disabled={busy}>
            {t("auth.sendReset")}
          </Button>
        </>
      )}
      <Button type="button" variant="link" className="h-auto p-0" onClick={onSignIn}>
        {t("auth.backToSignIn")}
      </Button>
    </form>
  );
};
