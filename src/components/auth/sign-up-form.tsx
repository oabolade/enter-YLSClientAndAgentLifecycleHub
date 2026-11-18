import { useState } from "react";
import { MailCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ResendConfirmation } from "@/components/auth/resend-confirmation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fallbackLng, normalizeLanguage } from "@/i18n/config";
import { supabase } from "@/integrations/supabase/client";
import { authRedirectUrl } from "@/lib/auth/auth-context";
import { MIN_PASSWORD_LENGTH, authErrorMessage } from "@/lib/auth/auth-errors";

export const SignUpForm = ({ onSignIn }: { onSignIn: () => void }) => {
  const { t, i18n } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const submit = async () => {
    const address = email.trim();
    if (!fullName.trim() || !phone.trim() || !address || !password) {
      setError(t("auth.error.required"));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("auth.error.weak"));
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: failure } = await supabase.auth.signUp({
      email: address,
      password,
      options: {
        emailRedirectTo: authRedirectUrl(),
        // Used to create the client's profile the first time they sign in.
        data: {
          full_name: fullName.trim().slice(0, 120),
          phone: phone.trim().slice(0, 40),
          preferred_language: normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) ?? fallbackLng,
        },
      },
    });
    setBusy(false);
    if (failure) {
      setError(authErrorMessage(t, failure));
      return;
    }
    // An address that already has an account comes back without an identity.
    if (data.user && data.user.identities?.length === 0) {
      setError(t("auth.error.exists"));
      return;
    }
    // With a session the hub opens by itself; otherwise the address must be confirmed first.
    if (!data.session) setPendingEmail(address);
  };

  if (pendingEmail) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success-soft p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t("auth.confirmTitle")}</p>
            <p className="text-sm">{t("auth.confirmBody", { email: pendingEmail })}</p>
          </div>
        </div>
        <ResendConfirmation email={pendingEmail} />
        <Button type="button" variant="link" className="h-auto p-0" onClick={onSignIn}>
          {t("auth.backToSignIn")}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="sign-up-name">{t("auth.fullName")}</Label>
        <Input
          id="sign-up-name"
          autoComplete="name"
          maxLength={120}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sign-up-phone">{t("auth.phone")}</Label>
        <Input
          id="sign-up-phone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sign-up-email">{t("auth.email")}</Label>
        <Input
          id="sign-up-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sign-up-password">{t("auth.password")}</Label>
        <Input
          id="sign-up-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label>{t("auth.preferredLanguage")}</Label>
        <LanguageSwitcher className="w-full" />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="crimson" className="w-full" disabled={busy}>
        {t("auth.signUp")}
      </Button>
      <Button type="button" variant="link" className="h-auto p-0" onClick={onSignIn}>
        {t("auth.toSignIn")}
      </Button>
    </form>
  );
};
