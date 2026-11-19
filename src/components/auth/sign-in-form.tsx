import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ResendConfirmation } from "@/components/auth/resend-confirmation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, isNotConfirmed } from "@/lib/auth/auth-errors";

// shortcut: public judge login shown on the page for the hackathon; remove before real clients use the hub.
const JUDGE_EMAIL = "judges@converge.com";
const JUDGE_PASSWORD = "winner@converge";

type SignInFormProps = {
  onForgot: () => void;
  onCreateAccount: () => void;
};

export const SignInForm = ({ onForgot, onCreateAccount }: SignInFormProps) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);

  const submit = async () => {
    const address = email.trim();
    if (!address || !password) {
      setError(t("auth.error.required"));
      return;
    }
    setBusy(true);
    setError(null);
    setUnconfirmed(null);
    // On success the session listener opens the hub; nothing more to do here.
    const { error: failure } = await supabase.auth.signInWithPassword({
      email: address,
      password,
    });
    setBusy(false);
    if (failure) {
      setError(authErrorMessage(t, failure));
      if (isNotConfirmed(failure)) setUnconfirmed(address);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="sign-in-email">{t("auth.email")}</Label>
        <Input
          id="sign-in-email"
          type="email"
          autoComplete="email"
          placeholder={JUDGE_EMAIL}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sign-in-password">{t("auth.password")}</Label>
        <Input
          id="sign-in-password"
          type="password"
          autoComplete="current-password"
          placeholder={JUDGE_PASSWORD}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {unconfirmed ? <ResendConfirmation email={unconfirmed} /> : null}

      <Button type="submit" variant="crimson" className="w-full" disabled={busy}>
        {t("auth.signIn")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("auth.judgeNote")}</p>
      <div className="flex flex-col items-start gap-1">
        <Button type="button" variant="link" className="h-auto p-0" onClick={onForgot}>
          {t("auth.forgotLink")}
        </Button>
        <Button type="button" variant="link" className="h-auto p-0" onClick={onCreateAccount}>
          {t("auth.toSignUp")}
        </Button>
      </div>
    </form>
  );
};
