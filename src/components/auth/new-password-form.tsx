import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { MIN_PASSWORD_LENGTH, authErrorMessage } from "@/lib/auth/auth-errors";

/** Shown after a password-reset link is opened. */
export const NewPasswordForm = () => {
  const { t } = useTranslation();
  const { finishRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("auth.error.weak"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: failure } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (failure) {
      setError(authErrorMessage(t, failure));
      return;
    }
    toast.success(t("auth.passwordSaved"));
    finishRecovery();
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
        <Label htmlFor="new-password">{t("auth.password")}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="crimson" className="w-full" disabled={busy}>
        {t("auth.saveNewPassword")}
      </Button>
    </form>
  );
};
